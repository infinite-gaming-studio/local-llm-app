import { describe, it, expect, vi, beforeEach } from 'vitest'

const { fakeProgress, fakeDownload, fakeAvailable } = vi.hoisted(() => ({
  fakeProgress: vi.fn(),
  fakeDownload: vi.fn(),
  fakeAvailable: vi.fn(),
}))

vi.mock('../../src/api', () => ({
  api: {
    getDownloadProgress: fakeProgress,
    downloadModel: fakeDownload,
    getAvailableModels: fakeAvailable,
    getModelStatus: vi.fn(),
    getLocalModels: vi.fn(() => ({ models: [] })),
  },
}))

import { useModelDownloads } from '../../src/store/useModelDownloads'

beforeEach(() => {
  useModelDownloads.setState({ downloads: {}, polling: false })
  fakeProgress.mockReset()
  fakeDownload.mockReset()
  fakeAvailable.mockReset()
})

describe('useModelDownloads', () => {
  it('startDownload sets downloading and calls api', async () => {
    fakeDownload.mockResolvedValue({ status: 'started', model_id: 'm1' })
    await useModelDownloads.getState().startDownload('m1')
    expect(useModelDownloads.getState().downloads['m1'].status).toBe('downloading')
    expect(fakeDownload).toHaveBeenCalledWith('m1')
  })

  it('restore queries progress for known downloading ids', async () => {
    useModelDownloads.setState({ downloads: { m2: { status: 'downloading', progress: 0 } } })
    fakeProgress.mockResolvedValue({ status: 'completed', progress: 1 })
    await useModelDownloads.getState().restore()
    expect(fakeProgress).toHaveBeenCalledWith('m2')
    expect(useModelDownloads.getState().downloads['m2'].status).toBe('completed')
  })

  it('restore marks not_found as error', async () => {
    useModelDownloads.setState({ downloads: { m3: { status: 'downloading', progress: 0 } } })
    fakeProgress.mockResolvedValue({ status: 'not_found' })
    await useModelDownloads.getState().restore()
    expect(useModelDownloads.getState().downloads['m3'].status).toBe('error')
  })
})
