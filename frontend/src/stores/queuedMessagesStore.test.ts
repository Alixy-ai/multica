import { beforeEach, describe, expect, it } from 'vitest'

import { queuedMessagesKey, useQueuedMessagesStore } from './queuedMessagesStore'

describe('queued message ownership', () => {
  const first = { content: 'first', attachments: [] }
  const second = { content: 'second', attachments: [] }
  const key = queuedMessagesKey('groups', 'group-a', 'thread-a')

  beforeEach(() => useQueuedMessagesStore.getState().clearAll())

  it('isolates destinations by scope, conversation, and task', () => {
    const queue = useQueuedMessagesStore.getState()
    queue.enqueue(key, [first])
    for (const other of [
      queuedMessagesKey('groups', 'group-b', 'thread-a'),
      queuedMessagesKey('groups', 'group-a', 'thread-b'),
      queuedMessagesKey('groups', 'group-a'),
      queuedMessagesKey('direct-chats', 'group-a', 'thread-a'),
    ]) {
      expect(queue.beginDispatch(other)).toBeUndefined()
    }
    expect(queue.beginDispatch(key)?.input).toEqual(first)
  })

  it('reserves one dispatch and restores failures in FIFO order', () => {
    const queue = useQueuedMessagesStore.getState()
    queue.enqueue(key, [first, second])
    const dispatch = queue.beginDispatch(key)!
    expect(queue.beginDispatch(key)).toBeUndefined()
    queue.finishDispatch(key, dispatch, true)
    expect(useQueuedMessagesStore.getState().byStateId[key]).toEqual([first, second])
  })

  it('clearing the last in-flight item prevents rejection from restoring it', () => {
    const queue = useQueuedMessagesStore.getState()
    queue.enqueue(key, [first])
    const dispatch = queue.beginDispatch(key)!
    expect(useQueuedMessagesStore.getState().byStateId[key]).toBeUndefined()
    queue.clear(key)
    queue.finishDispatch(key, dispatch, true)
    expect(useQueuedMessagesStore.getState().byStateId[key]).toBeUndefined()
    expect(useQueuedMessagesStore.getState().dispatchingByStateId[key]).toBeUndefined()
  })

  it.each(['clear', 'clearAll'] as const)('ignores old callbacks after %s and a new release', (clear) => {
    const queue = useQueuedMessagesStore.getState()
    queue.enqueue(key, [first])
    const old = queue.beginDispatch(key)!
    queue[clear](key)
    queue.enqueue(key, [second])
    const current = queue.beginDispatch(key)!

    queue.finishDispatch(key, old, true)
    queue.finishDispatch(key, old)
    expect(useQueuedMessagesStore.getState().byStateId[key]).toBeUndefined()
    expect(useQueuedMessagesStore.getState().dispatchingByStateId[key]).toBe(current)
    queue.finishDispatch(key, current, true)
    expect(useQueuedMessagesStore.getState().byStateId[key]).toEqual([second])
  })
})
