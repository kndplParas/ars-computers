import { useState, useId } from 'react'

function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return '0 B'
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

function formatDocType(type) {
  if (!type) return 'Document'
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export default function CustomerEmailModal({
  isOpen,
  onClose,
  title = 'Customer Email Preview',
  recipientEmail,
  subject,
  bodyText,
  shareableAttachments = [],
  totalAttachmentCount = 0
}) {
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState(
    () => new Set(shareableAttachments.map((a) => a.id))
  )
  const [sendAttempted, setSendAttempted] = useState(false)
  const titleId = useId()

  if (!isOpen) return null

  const internalCount = Math.max(0, totalAttachmentCount - shareableAttachments.length)

  const toggleAttachment = (id) => {
    setSelectedAttachmentIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleOpenMailto = () => {
    if (!recipientEmail) return
    const encodedSubject = encodeURIComponent(subject || '')
    const encodedBody = encodeURIComponent(bodyText || '')
    const url = `mailto:${recipientEmail}?subject=${encodedSubject}&body=${encodedBody}`
    window.location.assign(url)
  }

  const handleDirectSendClick = () => {
    setSendAttempted(true)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 id={titleId} className="text-lg font-semibold text-white">
                {title}
              </h3>
              <p className="text-xs text-zinc-400">
                Review email draft and customer-shareable attachments before dispatch
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            aria-label="Close Email Preview"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Recipient */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              To (Customer Email)
            </label>
            {recipientEmail ? (
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl">
                <span className="text-sm font-medium text-emerald-400 font-mono">
                  {recipientEmail}
                </span>
                <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">
                  Registered Customer
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>No registered customer email found on this record.</span>
              </div>
            )}
          </div>

          {/* Subject Line */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Subject
            </label>
            <input
              type="text"
              readOnly
              value={subject || ''}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-200 font-medium cursor-default focus:outline-none"
            />
          </div>

          {/* Customer-Shareable Attachments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Customer-Shareable Attachments (Head Approved)
              </label>
              {internalCount > 0 && (
                <span className="text-[11px] text-zinc-500 font-medium">
                  {internalCount} internal document(s) excluded for privacy
                </span>
              )}
            </div>

            {shareableAttachments.length === 0 ? (
              <div className="p-4 bg-zinc-950/60 border border-zinc-800/80 rounded-xl text-xs text-zinc-400 text-center">
                <svg className="w-6 h-6 mx-auto mb-1.5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>No customer-shareable documents attached. Internal and sensitive files are strictly hidden.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {shareableAttachments.map((att) => {
                  const isChecked = selectedAttachmentIds.has(att.id)
                  return (
                    <label
                      key={att.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-blue-500/5 border-blue-500/40 text-white'
                          : 'bg-zinc-950/50 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleAttachment(att.id)}
                        className="w-4 h-4 rounded border-zinc-700 text-blue-500 focus:ring-blue-500 bg-zinc-900"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate text-zinc-200">
                            {att.original_filename}
                          </span>
                          <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                            {formatDocType(att.document_type)}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-500">
                          {formatFileSize(att.file_size || att.file_size_bytes)}
                        </span>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">
                        Shareable
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* Email Body Preview */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Authoritative Customer Message
            </label>
            <pre className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto select-all">
              {bodyText || ''}
            </pre>
          </div>

          {/* Send Attempt Notice (Truthful disclosure when provider is not configured) */}
          {sendAttempted && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs leading-relaxed animate-fade-in">
              <div className="flex items-start gap-2.5">
                <svg className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold text-amber-200 mb-1">
                    AUTOMATIC EMAIL ATTACHMENT SENDING IS NOT YET ENABLED.
                  </p>
                  <p className="text-zinc-300">
                    Direct server-side email dispatch with binary attachments requires a configured email service (e.g. Supabase Edge Functions with Amazon SES or Resend).
                    Please use the <strong>Open in Email Client</strong> button to draft this message in your email software.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/90 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors"
          >
            Close
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleOpenMailto}
              disabled={!recipientEmail}
              className={`px-4 py-2 text-sm font-medium rounded-xl flex items-center gap-2 transition-all ${
                recipientEmail
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
                  : 'bg-zinc-800/40 text-zinc-600 border border-zinc-800/40 cursor-not-allowed'
              }`}
              title={recipientEmail ? 'Open in default email app (draft only)' : 'No customer email registered'}
            >
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span>Open in Email Client (mailto:)</span>
            </button>

            <button
              type="button"
              onClick={handleDirectSendClick}
              disabled={!recipientEmail}
              className={`px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-2 shadow-lg transition-all ${
                recipientEmail
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span>Send Email with Attachments</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
