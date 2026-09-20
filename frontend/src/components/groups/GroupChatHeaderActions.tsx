import { CompactActions } from '@/components/layout/CompactActions'
import { useState, type FormEvent } from 'react'
import { Archive, ArchiveRestore, ChevronRight, Eraser, ListPlus, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { GroupTaskSwitcher } from '@/components/groups/GroupTaskSwitcher'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useArchiveGroupThread, useCreateGroupThread, useDeleteGroupThread, useRenameGroupThread, useRestoreGroupThread } from '@/hooks/useGroupThreads'
import { useGroupWorkspaceGitBranches } from '@/hooks/useWorkspaceGit'
import { useClearGroupThreadMessages, useConversationPrefetch } from '@/hooks/useGroupMessages'
import type { GroupThread } from '@/types/api'

interface GroupChatHeaderActionsProps {
  groupId: string
  threads: GroupThread[]
  selectedThread: GroupThread | undefined
  onSelect: (threadId: string) => void
  onArchived: (threadId: string) => void
  onDeleted: (threadId: string, deletedIds?: string[]) => void
  disabled?: boolean
}

export function GroupChatHeaderActions({
  groupId,
  threads,
  selectedThread,
  onSelect,
  onArchived,
  onDeleted,
  disabled = false,
}: GroupChatHeaderActionsProps) {
  const { t } = useTranslation(['groups', 'common'])
  const createThread = useCreateGroupThread(groupId)
  const archiveThread = useArchiveGroupThread(groupId)
  const restoreThread = useRestoreGroupThread(groupId)
  const deleteThread = useDeleteGroupThread(groupId)
  const renameThread = useRenameGroupThread(groupId)
  const clearThread = useClearGroupThreadMessages(groupId)
  const prefetchConversation = useConversationPrefetch()
  const [createOpen, setCreateOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTargets, setDeleteTargets] = useState<GroupThread[]>([])
  const [deleteBulk, setDeleteBulk] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [renameTarget, setRenameTarget] = useState<GroupThread | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [clearOpen, setClearOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [gitBranch, setGitBranch] = useState('')
  const gitBranches = useGroupWorkspaceGitBranches(createOpen ? groupId : undefined)
  const selectedArchived = selectedThread?.status === 'archived'
  const displayTitle = (thread: GroupThread) => thread.title || t('tasks.untitled')
  const boundBranches = new Set(threads.map((thread) => thread.git_branch).filter(Boolean))
  const availableBranches = (gitBranches.data?.branches ?? []).filter(
    (branch) => branch.kind === 'local' && !branch.current && !boundBranches.has(branch.name),
  )
  const mutating = createThread.isPending
    || archiveThread.isPending
    || restoreThread.isPending
    || deleteThread.isPending
    || clearThread.isPending
    || renameThread.isPending
    || deleting

  const openRename = (thread: GroupThread) => {
    renameThread.reset()
    setRenameTitle(thread.title ?? '')
    setRenameTarget(thread)
  }

  const openDelete = (targets: GroupThread[], bulk: boolean) => {
    setDeleteTargets([
      ...targets.filter((thread) => thread.id !== selectedThread?.id),
      ...targets.filter((thread) => thread.id === selectedThread?.id),
    ])
    setDeleteBulk(bulk)
    setDeleteOpen(true)
  }

  const rename = async (event: FormEvent) => {
    event.preventDefault()
    if (!renameTarget || !renameTitle.trim() || renameThread.isPending) return
    try {
      await renameThread.mutateAsync({ threadId: renameTarget.id, title: renameTitle.trim() })
      setRenameTarget(null)
    } catch {
      // Keep the entered title and show the mutation error for retry.
    }
  }

  const create = async (event: FormEvent) => {
    event.preventDefault()
    const nextTitle = title.trim()
    if (!nextTitle) return
    try {
      const created = await createThread.mutateAsync({
        title: nextTitle,
        git_branch: gitBranch.trim() || null,
      })
      onSelect(created.id)
      setTitle('')
      setGitBranch('')
      setCreateOpen(false)
    } catch {
      // The mutation error is rendered below the field.
    }
  }

  return (
    <div className="chat-thread-controls flex min-w-0 items-center gap-0.5">
      <ChevronRight
        className="mx-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50"
        aria-hidden="true"
      />
      <GroupTaskSwitcher
        groupId={groupId}
        threads={threads}
        selectedThread={selectedThread}
        disabled={mutating}
        onSelect={(threadId) => {
          prefetchConversation('groups', groupId, threadId)
          onSelect(threadId)
        }}
        onPrefetch={(threadId) => prefetchConversation('groups', groupId, threadId)}
        onRename={openRename}
        onDelete={openDelete}
      />

      <CompactActions label={t('actions.taskActions')} icon={<ListPlus className="h-5 w-5" />}>
      <Dialog open={createOpen} onOpenChange={(open) => {
        setCreateOpen(open)
        if (open) {
          createThread.reset()
          setGitBranch('')
        }
      }}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            disabled={mutating}
            aria-label={t('actions.newTask')}
            title={t('actions.newTask')}
          >
            <ListPlus className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DialogTrigger>
        <DialogContent closeLabel={t('common:actions.close')} className="sm:max-w-sm">
          <form onSubmit={create} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t('tasks.createTitle')}</DialogTitle>
              <DialogDescription>{t('tasks.createDescription')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="group-task-title">{t('tasks.title')}</Label>
              <Input
                id="group-task-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={80}
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-task-git-branch">{t('tasks.gitBranch')}</Label>
              <Input
                id="group-task-git-branch"
                list="group-task-git-branches"
                value={gitBranch}
                onChange={(event) => setGitBranch(event.target.value)}
                maxLength={255}
                autoComplete="off"
                placeholder={t('tasks.gitBranchPlaceholder')}
                aria-describedby="group-task-git-branch-hint"
              />
              <datalist id="group-task-git-branches">
                {availableBranches.map((branch) => (
                  <option key={branch.full_name} value={branch.name} />
                ))}
              </datalist>
              <p id="group-task-git-branch-hint" className="text-xs text-muted-foreground">
                {gitBranches.isLoading
                  ? t('tasks.gitBranchesLoading')
                  : gitBranches.error
                    ? t('tasks.gitBranchesUnavailable')
                    : t('tasks.gitBranchHint')}
              </p>
            </div>
            {createThread.error ? (
              <p role="alert" className="text-xs text-destructive">
                {t('tasks.createError', { message: String(createThread.error) })}
              </p>
            ) : null}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">{t('common:actions.cancel')}</Button>
              </DialogClose>
              <Button type="submit" disabled={!title.trim() || createThread.isPending}>
                {createThread.isPending ? t('tasks.creating') : t('actions.newTask')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground"
        disabled={mutating || !selectedThread}
        onClick={() => { if (selectedThread) openRename(selectedThread) }}
        aria-label={t('tasks.rename')}
        title={t('tasks.rename')}
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground"
        disabled={disabled || mutating || !selectedThread}
        onClick={() => setClearOpen(true)}
        aria-label={t('tasks.clearMessages')}
        title={t('tasks.clearMessages')}
      >
        <Eraser className="h-4 w-4" aria-hidden="true" />
      </Button>

      {selectedArchived ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            disabled={mutating}
            onClick={() => {
              if (!selectedThread) return
              void restoreThread.mutateAsync(selectedThread.id)
            }}
            aria-label={t('tasks.restore')}
            title={t('tasks.restore')}
          >
            <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            disabled={mutating}
            onClick={() => { if (selectedThread) openDelete([selectedThread], false) }}
            aria-label={t('tasks.delete')}
            title={t('tasks.delete')}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          disabled={disabled || mutating || !selectedThread}
          onClick={() => setArchiveOpen(true)}
          aria-label={t('tasks.archive')}
          title={t('tasks.archive')}
        >
          <Archive className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
      </CompactActions>
      <Dialog open={renameTarget !== null} onOpenChange={(open) => { if (!open) setRenameTarget(null) }}>
        <DialogContent closeLabel={t('common:actions.close')} className="sm:max-w-sm">
          <form onSubmit={rename} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t('tasks.rename')}</DialogTitle>
              <DialogDescription>{t('tasks.renameDescription')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="group-task-rename-title">{t('tasks.title')}</Label>
              <Input
                id="group-task-rename-title"
                value={renameTitle}
                onChange={(event) => setRenameTitle(event.target.value)}
                maxLength={80}
                autoFocus
                onFocus={(event) => event.target.select()}
                disabled={renameThread.isPending}
                required
              />
            </div>
            {renameThread.error ? (
              <p role="alert" className="text-xs text-destructive">
                {t('tasks.renameError', { message: String(renameThread.error) })}
              </p>
            ) : null}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">{t('common:actions.cancel')}</Button>
              </DialogClose>
              <Button type="submit" disabled={!renameTitle.trim() || renameThread.isPending}>
                {renameThread.isPending ? t('common:actions.working') : t('common:actions.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title={t('tasks.clearMessagesTitle', { title: selectedThread ? displayTitle(selectedThread) : '' })}
        description={t('tasks.clearMessagesDescription')}
        confirmLabel={t('tasks.clearMessages')}
        destructive
        onConfirm={async () => {
          if (selectedThread) await clearThread.mutateAsync(selectedThread.id)
        }}
      />
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={t('tasks.archiveTitle', { title: selectedThread ? displayTitle(selectedThread) : '' })}
        description={t('tasks.archiveDescription')}
        confirmLabel={t('tasks.archive')}
        onConfirm={async () => {
          if (!selectedThread) return
          const archived = await archiveThread.mutateAsync(selectedThread.id)
          onArchived(archived.id)
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={deleteBulk ? t('tasks.deleteAllArchivedTitle', { count: deleteTargets.length }) : t('tasks.deleteTitle', { title: deleteTargets[0] ? displayTitle(deleteTargets[0]) : '' })}
        description={t(deleteBulk ? 'tasks.deleteAllArchivedDescription' : 'tasks.deleteDescription')}
        confirmLabel={t(deleteBulk ? 'tasks.deleteAllArchived' : 'tasks.delete')}
        destructive
        onConfirm={async () => {
          setDeleting(true)
          try {
            // Note: Delete the selected task last: changing it remounts the chat.
            // Stop on failure and keep only unfinished targets for a safe retry.
            for (const target of deleteTargets) {
              await deleteThread.mutateAsync(target.id)
              setDeleteTargets((remaining) => remaining.filter((thread) => thread.id !== target.id))
              if (target.id === selectedThread?.id) {
                if (deleteBulk) onDeleted(target.id, deleteTargets.map((thread) => thread.id))
                else onDeleted(target.id)
              }
            }
          } finally {
            setDeleting(false)
          }
        }}
      />
    </div>
  )
}
