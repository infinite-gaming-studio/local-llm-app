import { describe, it, expect, vi, beforeEach } from 'vitest'

const { fakeList, fakeGet, fakeSave, fakeRename, fakeDelete } = vi.hoisted(() => ({
  fakeList: vi.fn(),
  fakeGet: vi.fn(),
  fakeSave: vi.fn(),
  fakeRename: vi.fn(),
  fakeDelete: vi.fn(),
}))

vi.mock('../../src/api', () => ({
  api: {
    listConversations: fakeList,
    getConversation: fakeGet,
    saveConversation: fakeSave,
    renameConversation: fakeRename,
    deleteConversation: fakeDelete,
    chatStream: vi.fn(() => () => {}),
  },
}))

import { useConversations } from '../../src/store/useConversations'

beforeEach(() => {
  useConversations.setState({ list: [], currentId: null, messages: [], streaming: false })
  fakeList.mockReset()
  fakeGet.mockReset()
  fakeSave.mockReset()
  fakeRename.mockReset()
  fakeDelete.mockReset()
})

describe('useConversations', () => {
  it('loadList populates list', async () => {
    fakeList.mockResolvedValue({ conversations: [{ id: '1', title: 't', updated_at: 1 }] })
    await useConversations.getState().loadList()
    expect(useConversations.getState().list).toHaveLength(1)
  })

  it('select loads messages', async () => {
    fakeGet.mockResolvedValue({ id: '2', title: 't', messages: [{ role: 'user', content: 'hi' }], updated_at: 1, created_at: 1 })
    await useConversations.getState().select('2')
    expect(useConversations.getState().currentId).toBe('2')
    expect(useConversations.getState().messages).toHaveLength(1)
  })

  it('newChat clears current', () => {
    useConversations.setState({ currentId: 'x', messages: [{ id: '1', role: 'user', content: 'x' }] })
    useConversations.getState().newChat()
    expect(useConversations.getState().currentId).toBeNull()
    expect(useConversations.getState().messages).toHaveLength(0)
  })

  it('remove deletes from list', async () => {
    useConversations.setState({ list: [{ id: '3', title: 't', updated_at: 1 }] })
    fakeDelete.mockResolvedValue({ status: 'ok' })
    fakeList.mockResolvedValue({ conversations: [] })
    await useConversations.getState().remove('3')
    expect(useConversations.getState().list).toHaveLength(0)
  })
})
