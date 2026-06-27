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
  ConversationMeta: class {},
  Conversation: class {},
}))

import { useConversations } from '../../src/store/useConversations'

beforeEach(() => {
  useConversations.setState({ conversations: [], activeId: null, activeConv: null, loading: false, streaming: false })
  fakeList.mockReset()
  fakeGet.mockReset()
  fakeSave.mockReset()
  fakeRename.mockReset()
  fakeDelete.mockReset()
})

describe('useConversations', () => {
  it('init populates conversations', async () => {
    fakeList.mockResolvedValue({ conversations: [{ id: '1', title: 't', updated_at: 1 }] })
    await useConversations.getState().init()
    expect(useConversations.getState().conversations).toHaveLength(1)
  })

  it('selectConversation loads activeConv', async () => {
    fakeGet.mockResolvedValue({ id: '2', title: 't', messages: [{ role: 'user', content: 'hi' }], updated_at: 1, created_at: 1 })
    await useConversations.getState().selectConversation('2')
    expect(useConversations.getState().activeId).toBe('2')
    expect(useConversations.getState().activeConv).not.toBeNull()
    expect(useConversations.getState().activeConv!.messages).toHaveLength(1)
  })

  it('createConversation calls save and returns id', async () => {
    fakeSave.mockResolvedValue({ id: 'new-id' })
    fakeList.mockResolvedValue({ conversations: [] })
    const id = await useConversations.getState().createConversation()
    expect(id).toBe('new-id')
    expect(useConversations.getState().activeId).toBe('new-id')
    expect(fakeSave).toHaveBeenCalled()
  })

  it('deleteConversation removes from list', async () => {
    useConversations.setState({ conversations: [{ id: '3', title: 't', updated_at: 1 }] })
    fakeDelete.mockResolvedValue({ status: 'ok' })
    fakeList.mockResolvedValue({ conversations: [] })
    await useConversations.getState().deleteConversation('3')
    expect(useConversations.getState().conversations).toHaveLength(0)
  })

  it('renameConversation updates title in activeConv', async () => {
    const conv = { id: '4', title: 'old', messages: [], created_at: 1, updated_at: 1 }
    useConversations.setState({ activeId: '4', activeConv: conv, conversations: [{ id: '4', title: 'old', updated_at: 1 }] })
    fakeRename.mockResolvedValue({ status: 'ok' })
    fakeList.mockResolvedValue({ conversations: [{ id: '4', title: 'new', updated_at: 1 }] })
    await useConversations.getState().renameConversation('4', 'new')
    expect(useConversations.getState().activeConv!.title).toBe('new')
  })
})
