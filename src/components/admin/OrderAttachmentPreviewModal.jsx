import { useState, useEffect, useCallback } from 'react'

/**
 * ============================================================================
 * ARS Computers — Order Attachment Lightbox & Preview Modal
 * ============================================================================
 * Clean, modern inline lightbox for viewing order documents and photos safely.
 *
 * Invariants:
 * - NO automatic download triggered upon opening.
 * - Prominent Close (X) button and Escape key support (safe closure, no deletion).
 * - Next / Previous navigation when multiple files exist.
 * - Zoom in / Zoom out / Reset controls for images.
 * - Embedded PDF viewer for PDF documents.
 * - Optional explicit "Download File" button for when user explicitly requests download.
 * ============================================================================
 */
export default function OrderAttachmentPreviewModal({
  isOpen,
  onClose,
  attachments = [],
  initialIndex = 0,
  getOrderAttachmentUrl
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [currentUrl, setCurrentUrl] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)

  // Keep index synced with initialIndex on open
  useEffect(() => {
    let ignore = false
    Promise.resolve().then(() => {
      if (ignore) return
      if (isOpen) {
        setCurrentIndex(initialIndex >= 0 && initialIndex < attachments.length ? initialIndex : 0)
        setZoomLevel(1)
      }
    })
    return () => {
      ignore = true
    }
  }, [isOpen, initialIndex, attachments.length])

  const currentAttachment = attachments[currentIndex] || null

  // Resolve signed URL for inline viewing
  useEffect(() => {
    let isCancelled = false
    if (!isOpen || !currentAttachment) {
      Promise.resolve().then(() => {
        if (!isCancelled) setCurrentUrl(null)
      })
      return
    }

    const fetchUrl = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        if (typeof getOrderAttachmentUrl === 'function') {
          const url = await getOrderAttachmentUrl(currentAttachment.storage_path, currentAttachment.original_filename)
          if (!isCancelled) {
            setCurrentUrl(url)
          }
        } else {
          throw new Error('Attachment URL resolver not available.')
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('[OrderAttachmentPreviewModal] Failed to resolve URL:', err)
          setLoadError(err.message || 'Unable to load attachment preview.')
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchUrl()

    return () => {
      isCancelled = true
    }
  }, [isOpen, currentAttachment, getOrderAttachmentUrl])

  // Navigation handlers
  const handlePrev = useCallback(() => {
    if (attachments.length <= 1) return
    setZoomLevel(1)
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : attachments.length - 1))
  }, [attachments.length])

  const handleNext = useCallback(() => {
    if (attachments.length <= 1) return
    setZoomLevel(1)
    setCurrentIndex((prev) => (prev < attachments.length - 1 ? prev + 1 : 0))
  }, [attachments.length])

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))
  const handleResetZoom = () => setZoomLevel(1)

  // Explicit download handler
  const handleExplicitDownload = () => {
    if (!currentUrl) return
    const a = document.createElement('a')
    a.href = currentUrl
    a.download = currentAttachment?.original_filename || 'download'
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft') {
        handlePrev()
      } else if (e.key === 'ArrowRight') {
        handleNext()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, handlePrev, handleNext])

  if (!isOpen || !currentAttachment) return null

  const isPdf =
    currentAttachment.mime_type === 'application/pdf' ||
    (currentAttachment.original_filename && currentAttachment.original_filename.toLowerCase().endsWith('.pdf'))

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-sm transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-label="Attachment Preview"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-900/90 border-b border-slate-800 text-white">
        <div className="flex items-center space-x-3">
          <span className="text-sm font-semibold truncate max-w-md">
            {currentAttachment.original_filename || 'Attachment'}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            {currentIndex + 1} of {attachments.length}
          </span>
          {currentAttachment.file_size_bytes && (
            <span className="text-xs text-slate-400">
              ({(currentAttachment.file_size_bytes / 1024).toFixed(1)} KB)
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          {/* Zoom Controls for Images */}
          {!isPdf && (
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 space-x-1 mr-2">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
                className="px-2.5 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-700 rounded disabled:opacity-40"
                title="Zoom Out (-)"
              >
                −
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="px-2 py-1 text-xs text-slate-300 hover:text-white rounded"
                title="Reset Zoom"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3}
                className="px-2.5 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-700 rounded disabled:opacity-40"
                title="Zoom In (+)"
              >
                +
              </button>
            </div>
          )}

          {/* Explicit Download Action */}
          <button
            type="button"
            onClick={handleExplicitDownload}
            disabled={!currentUrl}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            title="Download file to device"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Download</span>
          </button>

          {/* Close (X) Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-rose-600 rounded-lg transition-colors"
            title="Close Preview (Esc)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Preview Area */}
      <div className="relative flex-1 flex items-center justify-center overflow-auto p-4 select-none">
        {/* Previous Button */}
        {attachments.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-6 z-10 p-3 text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 rounded-full shadow-lg transition-all"
            title="Previous (Left Arrow)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Content Body */}
        <div className="flex items-center justify-center w-full h-full">
          {isLoading && (
            <div className="flex flex-col items-center space-y-3 text-slate-400">
              <svg className="w-8 h-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="text-sm">Loading preview...</span>
            </div>
          )}

          {loadError && !isLoading && (
            <div className="text-center p-6 bg-slate-900 border border-slate-800 rounded-xl max-w-md">
              <svg className="w-10 h-10 text-rose-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-slate-300 mb-4">{loadError}</p>
              <button
                type="button"
                onClick={handleExplicitDownload}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg"
              >
                Try Direct Download
              </button>
            </div>
          )}

          {!isLoading && !loadError && currentUrl && (
            isPdf ? (
              <iframe
                src={`${currentUrl}#toolbar=0&navpanes=0`}
                title={currentAttachment.original_filename}
                className="w-full h-full max-w-5xl rounded-lg border border-slate-800 bg-white shadow-2xl"
              />
            ) : (
              <div className="overflow-auto max-w-full max-h-full flex items-center justify-center p-2">
                <img
                  src={currentUrl}
                  alt={currentAttachment.original_filename || 'Attachment preview'}
                  style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.15s ease-out' }}
                  className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl select-none"
                />
              </div>
            )
          )}
        </div>

        {/* Next Button */}
        {attachments.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-6 z-10 p-3 text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 rounded-full shadow-lg transition-all"
            title="Next (Right Arrow)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Thumbnail Strip (Bottom) */}
      {attachments.length > 1 && (
        <div className="px-6 py-3 bg-slate-900/95 border-t border-slate-800 flex items-center justify-center space-x-3 overflow-x-auto">
          {attachments.map((att, idx) => {
            const isSelected = idx === currentIndex
            const isAttPdf =
              att.mime_type === 'application/pdf' ||
              (att.original_filename && att.original_filename.toLowerCase().endsWith('.pdf'))
            return (
              <button
                key={att.id || idx}
                type="button"
                onClick={() => {
                  setZoomLevel(1)
                  setCurrentIndex(idx)
                }}
                className={`relative flex items-center justify-center w-14 h-14 rounded-lg border-2 overflow-hidden transition-all ${
                  isSelected ? 'border-blue-500 ring-2 ring-blue-500/50 bg-slate-800' : 'border-slate-700 opacity-60 hover:opacity-100 bg-slate-850'
                }`}
                title={att.original_filename}
              >
                {isAttPdf ? (
                  <span className="text-[10px] font-bold text-rose-400">PDF</span>
                ) : (
                  <span className="text-[10px] font-bold text-blue-400">IMG</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
