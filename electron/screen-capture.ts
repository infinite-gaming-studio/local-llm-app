import { desktopCapturer } from 'electron'

export class ScreenCapture {
  private interval: ReturnType<typeof setInterval> | null = null
  private lastFrame: string | null = null

  start(fps: number = 1, onFrame?: (dataUrl: string) => void): void {
    this.stop()
    this.interval = setInterval(async () => {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 },
      })

      if (sources.length > 0) {
        const thumbnail = sources[0].thumbnail
        const dataUrl = thumbnail.toDataURL()
        this.lastFrame = dataUrl
        onFrame?.(dataUrl)
      }
    }, 1000 / fps)
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    this.lastFrame = null
  }

  getLastFrame(): string | null {
    return this.lastFrame
  }
}
