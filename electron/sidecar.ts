import { ChildProcess, spawn, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

const REQUIRED_MODULES = 'fastapi, uvicorn, httpx, llama_cpp'

/** 查找系统可用的 Python 解释器 */
function findSystemPython(): string {
  if (process.platform === 'win32') {
    const candidates = ['python', 'python3']
    for (const cmd of candidates) {
      try {
        const p = execSync(`where ${cmd}`, { encoding: 'utf-8' }).trim().split('\n')[0]
        if (p && fs.existsSync(p)) return p
      } catch {}
    }
    return 'python'
  }
  const candidates = ['python3', 'python']
  for (const cmd of candidates) {
    try {
      const p = execSync(`which ${cmd}`, { encoding: 'utf-8' }).trim()
      if (p) return p
    } catch {}
  }
  return 'python3'
}

export class SidecarManager {
  private process: ChildProcess | null = null
  private port: number = 0
  private restartCount = 0
  private maxRestarts = 1
  private stdoutBuf = ''
  private stderrBuf = ''
  private logListeners = new Set<(e: { stream: 'stdout' | 'stderr'; line: string; ts: number }) => void>()
  private _startError: string | null = null
  private _sidecarDir: string = ''
  private _pythonPath: string = ''
  private _venvDir: string = ''

  get startError(): string | null { return this._startError }
  get sidecarDir(): string { return this._sidecarDir }
  get pythonPath(): string { return this._pythonPath }
  get venvDir(): string { return this._venvDir }

  onLog(cb: (e: { stream: 'stdout' | 'stderr'; line: string; ts: number }) => void) {
    this.logListeners.add(cb)
    return () => this.logListeners.delete(cb)
  }

  private emitLog(stream: 'stdout' | 'stderr', line: string) {
    const e = { stream, line, ts: Date.now() }
    this.logListeners.forEach((cb) => cb(e))
  }

  private bufferLine(stream: 'stdout' | 'stderr', chunk: string) {
    const buf = stream === 'stdout' ? this.stdoutBuf : this.stderrBuf
    const next = buf + chunk
    const lines = next.split('\n')
    const last = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed) this.emitLog(stream, trimmed)
    }
    if (stream === 'stdout') this.stdoutBuf = last
    else this.stderrBuf = last
  }

  get baseUrl(): string {
    return `http://127.0.0.1:${this.port}`
  }

  get isRunning(): boolean {
    return this.process !== null && this.process.exitCode === null
  }

  /** 虚拟环境 python 可执行文件路径 */
  private getVenvPython(venvDir: string): string {
    return process.platform === 'win32'
      ? path.join(venvDir, 'Scripts', 'python.exe')
      : path.join(venvDir, 'bin', 'python')
  }

  /** 验证给定 python 是否能导入所需模块 */
  private checkModules(pythonPath: string): boolean {
    try {
      execSync(`${pythonPath} -c "import ${REQUIRED_MODULES}"`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * 确保虚拟环境就绪：不存在则创建，缺依赖则安装。
   * 在 start() 之前调用，保障后续 sidecar 运行环境可用。
   */
  async ensureEnvironment(): Promise<void> {
    const isDev = !!process.env.VITE_DEV_SERVER_URL
    this._sidecarDir = isDev
      ? path.join(__dirname, '..', 'sidecar')
      : path.join(process.resourcesPath, 'sidecar')

    // 打包环境 venv 放在 userData，开发环境放在 sidecar/.venv
    this._venvDir = isDev
      ? path.join(this._sidecarDir, '.venv')
      : path.join(app.getPath('userData'), 'venv')

    const venvPython = this.getVenvPython(this._venvDir)

    // 1. 虚拟环境已存在且依赖齐全
    if (fs.existsSync(venvPython) && this.checkModules(venvPython)) {
      console.log(`[sidecar] venv ready: ${this._venvDir}`)
      this._pythonPath = venvPython
      return
    }

    // 2. 创建虚拟环境（继承系统已安装的包）
    const systemPython = findSystemPython()
    console.log(`[sidecar] creating venv with ${systemPython} --system-site-packages`)
    this.emitLog('stdout', `正在创建 Python 虚拟环境...`)
    try {
      execSync(`"${systemPython}" -m venv "${this._venvDir}" --system-site-packages`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      })
    } catch (err) {
      this._startError = `venv creation failed: ${err instanceof Error ? err.message : String(err)}`
      throw err
    }

    // 3. 验证依赖
    if (this.checkModules(venvPython)) {
      console.log(`[sidecar] venv ready (inherited system packages): ${this._venvDir}`)
      this.emitLog('stdout', `虚拟环境就绪`)
      this._pythonPath = venvPython
      return
    }

    // 4. 依赖不全，尝试 pip install
    const requirements = path.join(this._sidecarDir, 'requirements.txt')
    if (!fs.existsSync(requirements)) {
      this._startError = `requirements.txt not found: ${requirements}`
      throw new Error(this._startError)
    }

    console.log(`[sidecar] installing dependencies from ${requirements}`)
    this.emitLog('stdout', `正在安装依赖（首次可能需要较长时间）...`)
    try {
      execSync(`"${venvPython}" -m pip install -r "${requirements}"`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      })
    } catch (err) {
      this._startError = `pip install failed: ${err instanceof Error ? err.message : String(err)}`
      throw err
    }

    // 5. 再次验证
    if (!this.checkModules(venvPython)) {
      this._startError = `dependencies still missing after pip install`
      throw new Error(this._startError)
    }

    console.log(`[sidecar] venv ready (installed dependencies): ${this._venvDir}`)
    this.emitLog('stdout', `虚拟环境就绪`)
    this._pythonPath = venvPython
  }

  async start(): Promise<number> {
    this._startError = null

    // 确保运行环境就绪
    if (!this._pythonPath) {
      await this.ensureEnvironment()
    }

    const isDev = !!process.env.VITE_DEV_SERVER_URL
    const portFile = isDev
      ? path.join(this._sidecarDir, '.sidecar-port.txt')
      : path.join(app.getPath('userData'), 'sidecar-port.txt')

    // 先删除可能残留的 portFile，避免 waitForReady 读到上次启动的旧端口
    // （旧端口上可能还跑着上一个 sidecar 进程，healthCheck 会误判通过）
    try { fs.unlinkSync(portFile) } catch {}

    // 开发环境数据目录放项目下，避免 macOS sandbox 限制
    const dataDir = isDev
      ? path.join(this._sidecarDir, '.data')
      : path.join(app.getPath('userData'), 'data')
    fs.mkdirSync(dataDir, { recursive: true })

    try {
      this.process = spawn(this._pythonPath, ['main.py', portFile], {
        cwd: this._sidecarDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, LLM_APP_DATA_DIR: dataDir },
      })
    } catch (err) {
      this._startError = `spawn failed: ${err instanceof Error ? err.message : String(err)}`
      throw err
    }

    this.process.stdout?.on('data', (data: Buffer) => {
      this.bufferLine('stdout', data.toString())
    })

    this.process.stderr?.on('data', (data: Buffer) => {
      const text = data.toString()
      console.error('[sidecar:stderr]', text.trimEnd())
      this.bufferLine('stderr', text)
    })

    this.process.on('exit', (code) => {
      console.log(`[sidecar] exited with code ${code}`)
      this.process = null
      if (this.restartCount < this.maxRestarts) {
        this.restartCount++
        this.start()
      }
    })

    try {
      await this.waitForReady(portFile)
    } catch (err) {
      this._startError = `startup failed: ${err instanceof Error ? err.message : String(err)}`
      throw err
    }
    return this.port
  }

  private async waitForReady(portFile: string, timeoutMs = 30000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        const content = fs.readFileSync(portFile, 'utf-8').trim()
        this.port = parseInt(content, 10)
        if (!isNaN(this.port)) {
          await this.healthCheck()
          return
        }
      } catch {
        // file not ready yet
      }
      await new Promise((r) => setTimeout(r, 200))
    }
    throw new Error('Sidecar did not start in time')
  }

  private async healthCheck(): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < 10000) {
      try {
        const res = await fetch(`${this.baseUrl}/health`)
        if (res.ok) return
      } catch {
        await new Promise((r) => setTimeout(r, 200))
      }
    }
    throw new Error('Sidecar health check failed')
  }

  stop(): void {
    if (this.process) {
      this.process.kill('SIGTERM')
      setTimeout(() => {
        if (this.process) this.process.kill('SIGKILL')
      }, 5000)
    }
  }
}
