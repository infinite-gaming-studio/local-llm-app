import { ChildProcess, spawn, execSync } from 'child_process'
import path from 'path'
import { app } from 'electron'

function resolvePython(): string {
  if (process.platform === 'win32') return 'python'
  const candidates = ['python3', 'python']
  for (const cmd of candidates) {
    try {
      const p = execSync(`which ${cmd}`, { encoding: 'utf-8' }).trim()
      if (!p) continue
      // Verify it can import required modules
      execSync(`${p} -c "import fastapi, uvicorn, httpx, llama_cpp"`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      })
      console.log(`[sidecar] resolved python: ${p}`)
      return p
    } catch {}
  }
  const fallback = 'python3'
  console.error(`[sidecar] no working python found, falling back to "${fallback}"`)
  return fallback
}

const RESOLVED_PYTHON = resolvePython()

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

  get startError(): string | null { return this._startError }
  get sidecarDir(): string { return this._sidecarDir }
  get pythonPath(): string { return RESOLVED_PYTHON }

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

  async start(): Promise<number> {
    this._startError = null
    const portFile = path.join(app.getPath('userData'), 'sidecar-port.txt')
    this._sidecarDir = app.isPackaged
      ? path.join(process.resourcesPath, 'sidecar')
      : path.join(__dirname, '..', 'sidecar')

    try {
      this.process = spawn(RESOLVED_PYTHON, ['main.py', portFile], {
        cwd: this._sidecarDir,
        stdio: ['ignore', 'pipe', 'pipe'],
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
        const fs = require('fs')
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
