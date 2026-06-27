import { describe, it, expect, beforeEach } from 'vitest'
import { useLogs } from '../../src/store/useLogs'

beforeEach(() => useLogs.setState({ entries: [] }))

describe('useLogs', () => {
  it('push appends entries', () => {
    useLogs.getState().push({ stream: 'stdout', line: 'hi', ts: 1 })
    expect(useLogs.getState().entries).toHaveLength(1)
  })

  it('ring buffer caps at 2000', () => {
    for (let i = 0; i < 2010; i++) useLogs.getState().push({ stream: 'stdout', line: String(i), ts: i })
    expect(useLogs.getState().entries).toHaveLength(2000)
    expect(useLogs.getState().entries[0].line).toBe('10')
  })

  it('clear empties entries', () => {
    useLogs.getState().push({ stream: 'stdout', line: 'x', ts: 1 })
    useLogs.getState().clear()
    expect(useLogs.getState().entries).toHaveLength(0)
  })
})
