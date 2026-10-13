import { useEffect, useRef, useState } from 'react'
import { exportBackup, getLastBackup, restoreBackup } from '../services/backup'
import { getSyncKey, setSyncKey, syncAvailable } from '../services/syncService'

const DAY_MS = 24 * 3600 * 1000
const REMINDER_AFTER_MS = 7 * DAY_MS

function formatAgo(ms: number): string {
  const sec = Math.floor((Date.now() - ms) / 1000)
  if (sec < 60) return 'just now'
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

// ─── Shared dialog shell ─────────────────────────────────────────────────────

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const titleId = `dialog-${title.replace(/\W+/g, '-').toLowerCase()}`

  // Mount-only: focus the first control, close on Escape, restore focus on close
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.querySelector<HTMLElement>('input, button')?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-primary/60 backdrop-blur-sm" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 bg-panel rounded-2xl border border-border shadow-2xl p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-bold text-primary mb-4">{title}</h2>
        {children}
      </div>
    </div>
  )
}

// ─── Sync status (header) ────────────────────────────────────────────────────

export function SyncStatus({
  connected,
  lastSyncAt,
  isSyncing,
  error,
  onSyncNow,
  onConnect,
}: {
  connected: boolean
  lastSyncAt: number | null
  isSyncing: boolean
  error: string | null
  onSyncNow: () => void
  onConnect: () => void
}) {
  if (!syncAvailable()) return null

  if (!connected) {
    return (
      <button
        onClick={onConnect}
        className="text-sm px-3 py-2 rounded-lg bg-card hover:bg-accent/20 border border-border text-muted hover:text-accent transition-colors font-semibold"
      >
        Connect cloud
      </button>
    )
  }

  const label = isSyncing
    ? 'Syncing…'
    : error
      ? 'Sync failed'
      : lastSyncAt
        ? `Synced ${formatAgo(lastSyncAt)}`
        : 'Not synced yet'
  const color = error ? 'text-danger' : lastSyncAt ? 'text-success' : 'text-muted'
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onConnect}
        className={`text-sm font-medium ${color} hover:underline`}
        title={error ?? 'Cloud sync settings'}
        aria-live="polite"
      >
        {label}
      </button>
      <button
        onClick={onSyncNow}
        disabled={isSyncing}
        className="text-sm px-2.5 py-1.5 rounded-lg bg-card hover:bg-accent/20 border border-border text-muted hover:text-accent disabled:opacity-50 transition-colors"
      >
        Sync now
      </button>
    </div>
  )
}

// ─── Connect / disconnect this device ────────────────────────────────────────

export function ConnectSyncModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const existing = getSyncKey()
  const [key, setKey] = useState('')

  const save = () => {
    if (!key.trim()) return
    setSyncKey(key)
    onChanged()
    onClose()
  }

  const disconnect = () => {
    setSyncKey(null)
    onChanged()
    onClose()
  }

  return (
    <Dialog title="Cloud sync" onClose={onClose}>
      <p className="text-sm text-muted mb-4 leading-relaxed">
        {existing
          ? 'This device is connected. Records sync automatically every 30 seconds while online.'
          : 'Paste the clinic sync key to back up records to the cloud and share them with your other devices. You only need to do this once per device.'}
      </p>
      <label className="block text-sm font-semibold text-primary mb-1" htmlFor="sync-key">
        {existing ? 'Replace sync key' : 'Sync key'}
      </label>
      <input
        id="sync-key"
        type="password"
        autoComplete="off"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save() }}
        className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-base text-primary focus:outline-none focus:border-accent mb-4"
      />
      <div className="flex gap-3">
        {existing && (
          <button
            onClick={disconnect}
            className="border border-danger/40 text-danger rounded-xl px-4 py-3 font-semibold text-sm hover:bg-danger/10 transition-colors"
          >
            Disconnect
          </button>
        )}
        <button
          onClick={onClose}
          className="flex-1 border border-border text-muted rounded-xl py-3 font-semibold text-sm hover:bg-card transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={!key.trim()}
          className="flex-1 bg-accent hover:bg-accent-hover text-white rounded-xl py-3 font-bold text-sm shadow-sm disabled:opacity-50 transition-colors"
        >
          Connect
        </button>
      </div>
    </Dialog>
  )
}

// ─── Backup & restore ────────────────────────────────────────────────────────

export function BackupModal({ onClose, onRestored }: { onClose: () => void; onRestored: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const lastBackup = getLastBackup()

  const handleExport = async () => {
    setBusy(true)
    setMessage(null)
    try {
      await exportBackup()
      setMessage({ kind: 'ok', text: 'Backup downloaded. Keep the .json file safe — it can restore everything.' })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Export failed' })
    } finally {
      setBusy(false)
    }
  }

  const handleRestore = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setMessage(null)
    try {
      const r = await restoreBackup(file)
      setMessage({
        kind: 'ok',
        text: `Restored ${r.patientsWritten} patient(s) and ${r.visitsWritten} visit(s). Newer records on this device were kept.`,
      })
      onRestored()
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Restore failed' })
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Dialog title="Backup & restore" onClose={onClose}>
      <p className="text-sm text-muted mb-4 leading-relaxed">
        Download a copy of every patient and visit. The <strong className="text-primary">.json</strong> file can restore
        this register on any device; the <strong className="text-primary">.csv</strong> file opens in Excel.
        {lastBackup ? ` Last backup: ${formatAgo(lastBackup)}.` : ' No backup taken on this device yet.'}
      </p>
      <div className="flex flex-col gap-3">
        <button
          onClick={handleExport}
          disabled={busy}
          className="bg-accent hover:bg-accent-hover text-white rounded-xl py-3 font-bold text-base shadow-sm disabled:opacity-50 transition-colors"
        >
          Download backup
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="border border-border text-primary rounded-xl py-3 font-semibold text-base hover:bg-card disabled:opacity-50 transition-colors"
        >
          Restore from backup file…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Backup file to restore"
          onChange={(e) => handleRestore(e.target.files?.[0])}
        />
      </div>
      {message && (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={`mt-4 text-sm font-medium ${message.kind === 'error' ? 'text-danger' : 'text-success'}`}
        >
          {message.text}
        </p>
      )}
      <button onClick={onClose} className="mt-4 w-full text-sm text-muted hover:text-primary py-2">
        Close
      </button>
    </Dialog>
  )
}

// ─── Reminder banner ─────────────────────────────────────────────────────────

/** True when neither a backup nor a successful cloud sync happened in the last 7 days. */
export function needsBackupReminder(lastBackup: number | null, lastSyncOk: number | null, now = Date.now()): boolean {
  const latest = Math.max(lastBackup ?? 0, lastSyncOk ?? 0)
  return now - latest > REMINDER_AFTER_MS
}

export function BackupReminder({ onBackup, onDismiss }: { onBackup: () => void; onDismiss: () => void }) {
  return (
    <div role="status" className="shrink-0 flex items-center justify-between gap-3 px-5 py-2 bg-warning/10 border-b border-warning/30">
      <span className="text-sm font-medium text-warning">
        Your records have not been backed up in over 7 days.
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onBackup}
          className="text-sm px-3 py-1.5 rounded-lg bg-warning text-white font-semibold hover:bg-warning/90 transition-colors"
        >
          Back up now
        </button>
        <button onClick={onDismiss} className="text-sm px-2 py-1.5 text-muted hover:text-primary" aria-label="Remind me later">
          Later
        </button>
      </div>
    </div>
  )
}
