import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DetailShell } from '@/components/layout/DetailShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SettingsRow, SettingsSection } from '@/components/ui/settings-row'
import {
  useSystemSettings,
  useTestDecisionEndpoint,
  useUpdateSystemSettings,
} from '@/hooks/useSystemSettings'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { ApiError } from '@/lib/api-v2/client'
import type { SystemSettingsUpdate } from '@/types/api'

interface DecisionDraft {
  endpoint: string
  apiKey: string
  model: string
  minConfidence: string
}

const EMPTY_DRAFT: DecisionDraft = {
  endpoint: 'https://openrouter.ai/api/alpha/decisions',
  apiKey: '',
  model: '~typesafe/jev-latest',
  minConfidence: '0.7',
}

/**
 * The account's connection to a System One decision endpoint. Which groups
 * use it, and for which scenarios, is set on each group's settings tab.
 */
export function DecisionSettingsPage() {
  const { t, i18n } = useTranslation('settings')
  const settings = useSystemSettings()
  const update = useUpdateSystemSettings()
  const test = useTestDecisionEndpoint()
  const [draft, setDraft] = useState<DecisionDraft>(EMPTY_DRAFT)
  const [clearKey, setClearKey] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)

  useEffect(() => {
    if (!settings.data) return
    setDraft({
      endpoint: settings.data.decision_endpoint,
      apiKey: '',
      model: settings.data.decision_model,
      minConfidence: String(settings.data.decision_min_confidence),
    })
    setClearKey(false)
  }, [settings.data])

  useEffect(() => {
    document.title = t('decision.documentTitle')
  }, [i18n.resolvedLanguage, t])

  const server = settings.data
  const keyReady = Boolean(
    draft.apiKey.trim() || (server?.decision_api_key_configured && !clearKey),
  )
  const dirty = Boolean(
    server && (
      draft.apiKey.trim() ||
      clearKey ||
      draft.endpoint.trim() !== server.decision_endpoint ||
      draft.model.trim() !== server.decision_model ||
      Number(draft.minConfidence) !== server.decision_min_confidence
    )
  )
  useUnsavedChangesGuard(dirty)

  const change = (patch: Partial<DecisionDraft>) => {
    setDraft((current) => ({ ...current, ...patch }))
  }

  const onSave = async () => {
    setError(null)
    const minConfidence = Number(draft.minConfidence)
    const patch: SystemSettingsUpdate = {
      decision_endpoint: draft.endpoint.trim() || null,
      decision_model: draft.model.trim() || null,
      decision_min_confidence: Number.isFinite(minConfidence) ? minConfidence : null,
    }
    if (clearKey) patch.decision_api_key = null
    else if (draft.apiKey.trim()) patch.decision_api_key = draft.apiKey.trim()

    try {
      await update.mutateAsync(patch)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.network'))
    }
  }

  const onTest = async () => {
    setTestResult(null)
    try {
      const result = await test.mutateAsync({
        endpoint: draft.endpoint.trim() || null,
        model: draft.model.trim() || null,
        api_key: draft.apiKey.trim() || null,
      })
      setTestResult(
        result.ok
          ? t('decision.provider.testOk', {
              model: result.model ?? draft.model,
              dialect: t(`decision.dialects.${result.dialect}`),
              probability: result.sample_probability?.toFixed(2) ?? '?',
            })
          : t('decision.provider.testFailed', { message: result.message }),
      )
    } catch (err) {
      setTestResult(
        t('decision.provider.testFailed', {
          message: err instanceof ApiError ? err.message : t('errors.network'),
        }),
      )
    }
  }

  const busy = settings.isLoading || update.isPending

  return (
    <DetailShell
      title={t('decision.title')}
      subtitle={t('decision.subtitle')}
      actions={
        <Button size="sm" onClick={() => void onSave()} disabled={!dirty || update.isPending}>
          {update.isPending ? t('common:actions.saving') : t('common:actions.save')}
        </Button>
      }
    >
      <div className="space-y-10">
        <SettingsSection
          title={t('decision.provider.title')}
          description={t('decision.provider.description')}
          aside={
            <Badge
              variant="outline"
              className={keyReady ? 'border-primary/40 bg-primary/10 text-primary' : 'text-muted-foreground'}
            >
              {t(keyReady ? 'decision.configured' : 'decision.notConfigured')}
            </Badge>
          }
        >
          <SettingsRow
            label={t('decision.provider.endpoint')}
            description={t('decision.provider.endpointDescription')}
            htmlFor="decision-endpoint"
            stacked
          >
            <Input
              id="decision-endpoint"
              value={draft.endpoint}
              onChange={(event) => change({ endpoint: event.target.value })}
              placeholder="https://openrouter.ai/api/alpha/decisions"
              disabled={busy}
            />
          </SettingsRow>
          <SettingsRow
            label={t('decision.provider.apiKey')}
            description={
              clearKey
                ? t('decision.provider.keyWillClear')
                : server?.decision_api_key_configured
                  ? t('decision.provider.keyConfigured')
                  : t('decision.provider.keyMissing')
            }
            htmlFor="decision-api-key"
            stacked
          >
            <div className="flex w-full gap-2">
              <Input
                id="decision-api-key"
                type="password"
                value={draft.apiKey}
                onChange={(event) => {
                  change({ apiKey: event.target.value })
                  setClearKey(false)
                }}
                placeholder={
                  server?.decision_api_key_configured
                    ? t('decision.provider.configuredPlaceholder')
                    : 'sk-or-...'
                }
                disabled={busy}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  change({ apiKey: '' })
                  setClearKey(true)
                }}
                disabled={!server?.decision_api_key_configured || update.isPending}
              >
                {t('decision.provider.clearKey')}
              </Button>
            </div>
          </SettingsRow>
          <SettingsRow
            label={t('decision.provider.model')}
            description={t('decision.provider.modelDescription')}
            htmlFor="decision-model"
          >
            <Input
              id="decision-model"
              value={draft.model}
              onChange={(event) => change({ model: event.target.value })}
              placeholder="~typesafe/jev-latest"
              disabled={busy}
            />
          </SettingsRow>
          <SettingsRow
            label={t('decision.provider.minConfidence')}
            description={t('decision.provider.minConfidenceDescription')}
            htmlFor="decision-min-confidence"
          >
            <Input
              id="decision-min-confidence"
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={draft.minConfidence}
              onChange={(event) => change({ minConfidence: event.target.value })}
              disabled={busy}
            />
          </SettingsRow>
          <SettingsRow label={t('decision.provider.test')}>
            <div className="flex flex-col items-end gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void onTest()}
                disabled={busy || test.isPending || !keyReady}
              >
                {test.isPending ? t('decision.provider.testing') : t('decision.provider.test')}
              </Button>
              {testResult ? (
                <p className="text-xs text-muted-foreground" role="status">
                  {testResult}
                </p>
              ) : null}
            </div>
          </SettingsRow>
        </SettingsSection>

        <p className="text-xs text-muted-foreground">{t('decision.perGroup')}</p>
        <p className="text-xs text-muted-foreground">{t('decision.privacy')}</p>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </DetailShell>
  )
}
