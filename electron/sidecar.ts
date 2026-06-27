import { ChildProcess, spawn } from 'child_process'
import path from 'path'
import { app } from 'electron'

export class SidecarManager {
  private process: ChildProcess | null = null
  private port: number = 0
  private restartCount = 0
  private maxRestarts = 3
  private stdoutBuf = ''
  private stderrBuf = ''
  private logListeners = new Set<(e: { stream: 'stdout' | 'stderr'; line: string; ts: number }) => void>()

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
    const portFile = path.join(app.getPath('userData'), 'sidecar-port.txt')
    const sidecarDir = app.isPackaged
      ? path.join(process.resourcesPath, 'sidecar')
      : path.join(__dirname, '..', 'sidecar')

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'

    this.process = spawn(pythonCmd, ['main.py', portFile], {
      cwd: sidecarDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    this.process.stdout?.on('data', (data: Buffer) => {
      this.bufferLine('stdout', data.toString())
    })

    this.process.stderr?.on('data', (data: Buffer) => {
      this.bufferLine('stderr', data.toString())
    })

    this.process.on('exit', (code) => {
      console.log(`[sidecar] exited with code ${code}`)
      this.process = null
      if (this.restartCount < this.maxRestarts) {
        this.restartCount++
        this.start()
      }
    })

    await this.waitForReady(portFile)
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
