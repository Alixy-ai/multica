/**
 * Queued messages store — messages parked while a reply is still streaming.
 *
 * With `reply_insert_mode: 'queue'`, a message typed mid-reply waits for the
 * current stream to end. The queue previously lived in `ConversationChatView`'s
 * local `useRef` and was explicitly cleared on conversation switch, so
 * switching groups and back silently destroyed the user's queued text. The
 * queue is per-conversation state, not per-component state: it belongs in a
 * module-level store keyed by the full send target and survives navigation.
 */

import { create } from 'zustand'

import type { MessageSendInput } from '@/types/api'

export function queuedMessagesKey(
  scope: 'groups' | 'direct-chats',
  conversationId: string,
  threadId?: string,
): string {
  // Note: a retained thread id must never let a different conversation claim
  // its queue during navigation. Include the destination, not just UI state.
  return JSON.stringify([scope, conversationId, threadId ?? null])
}

interface QueueDispatch {
  input: MessageSendInput
}

interface QueuedMessagesState {
  /** Queued inputs per conversation state key, insertion-ordered. */
  byStateId: Record<string, MessageSendInput[]>
  /** Guards one queue release against StrictMode's repeated effect setup. */
  dispatchingByStateId: Record<string, QueueDispatch>

  enqueue: (stateId: string, input: MessageSendInput[]) => void
  /** Reserve and remove the first queued input, if no release is in flight. */
  beginDispatch: (stateId: string) => QueueDispatch | undefined
  /** Finish a release, optionally returning a failed input to the queue front. */
  finishDispatch: (stateId: string, dispatch: QueueDispatch, retry?: boolean) => void
  clear: (stateId: string) => void
  clearAll: () => void
}

export const useQueuedMessagesStore = create<QueuedMessagesState>((set, get) => ({
  byStateId: {},
  dispatchingByStateId: {},

  enqueue: (stateId, inputs) =>
    set((state) => ({
      byStateId: {
        ...state.byStateId,
        [stateId]: [...(state.byStateId[stateId] ?? []), ...inputs],
      },
    })),

  beginDispatch: (stateId) => {
    const state = get()
    if (state.dispatchingByStateId[stateId]) return undefined
    const current = state.byStateId[stateId] ?? []
    if (current.length === 0) return undefined
    const [next, ...rest] = current
    const dispatch = { input: next }
    set((currentState) => {
      const byStateId = { ...currentState.byStateId }
      if (rest.length === 0) delete byStateId[stateId]
      else byStateId[stateId] = rest
      return {
        byStateId,
        dispatchingByStateId: {
          ...currentState.dispatchingByStateId,
          [stateId]: dispatch,
        },
      }
    })
    return dispatch
  },

  finishDispatch: (stateId, dispatch, retry) =>
    set((state) => {
      // Note: clear/stop/logout invalidate the release, even if a new send has
      // started under the same key. Old callbacks cannot restore or unlock it.
      if (state.dispatchingByStateId[stateId] !== dispatch) return {}
      const dispatchingByStateId = { ...state.dispatchingByStateId }
      delete dispatchingByStateId[stateId]
      if (!retry) return { dispatchingByStateId }
      return {
        dispatchingByStateId,
        byStateId: {
          ...state.byStateId,
          [stateId]: [dispatch.input, ...(state.byStateId[stateId] ?? [])],
        },
      }
    }),

  clear: (stateId) =>
    set((state) => {
      if (!(stateId in state.byStateId) && !(stateId in state.dispatchingByStateId)) return {}
      const next = { ...state.byStateId }
      const dispatchingByStateId = { ...state.dispatchingByStateId }
      delete next[stateId]
      delete dispatchingByStateId[stateId]
      return { byStateId: next, dispatchingByStateId }
    }),

  clearAll: () => set({ byStateId: {}, dispatchingByStateId: {} }),
}))

/** Reactive count for the queue banner; non-reactive reads use the store directly. */
export function queuedCountOf(stateId: string): number {
  return useQueuedMessagesStore.getState().byStateId[stateId]?.length ?? 0
}
