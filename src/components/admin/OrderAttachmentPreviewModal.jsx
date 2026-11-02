import { useState, useEffect, useCallback } from 'react'

/**
 * ============================================================================
 * ARS Computers — Order Attachment Lightbox & Document Preview Modal
 * ============================================================================
 * Self-contained, responsive inline lightbox for previewing photos and PDFs
 * without depending on external utility classes.
 *
 * Invariants:
 * - NO automatic download triggered upon opening (inline viewing only).
 * - Photos open in high-clarity in-app viewer with zoom in/out/reset controls.
 * - PDFs open in embedded reader with readable pages, fullscreen option,
 *   and graceful fallback if browser plugin is disabled.
 * - Prominent Close (✕) button and Escape key support.
 * - Left/Right arrows and thumbnail strip for multi-file navigation.
 * - Clear error states with manual open / download fallback buttons.
 * - Does not expose internal credentials or service-role keys.
 * ============================================================================
 */
export default function OrderAttachmentPreviewModal({
  isOpen,
  onClose,
  attachments = [],
  initialIndex = 0,
  getOrderAttachmentPreviewUrl,
  getOrderAttachmentDownloadUrl,
  getOrderAttachmentUrl // Backwards-compatibility alias
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [isDownloading, setIsDownloading] = useState(false)

  // Sync index when modal opens or initialIndex changes
  useEffect(() => {
    let ignore = false
    Promise.resolve().then(() => {
      if (ignore) return
      if (isOpen) {
        setCurrentIndex(initialIndex >= 0 && initialIndex < attachments.length ? initialIndex : 0)
        setZoomLevel(1)
        setLoadError(null)
      }
    })
    return () => {
      ignore = true
    }
  }, [isOpen, initialIndex, attachments.length])

  const currentAttachment = attachments[currentIndex] || null

  // Resolve preview and download URLs whenever current attachment changes
  useEffect(() => {
    let isCancelled = false
    if (!isOpen || !currentAttachment) {
      Promise.resolve().then(() => {
        if (!isCancelled) {
          setPreviewUrl(null)
          setDownloadUrl(null)
        }
      })
      return
    }

    const resolveUrls = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const previewResolver = getOrderAttachmentPreviewUrl || getOrderAttachmentUrl
        if (typeof previewResolver !== 'function') {
          throw new Error('Document preview service is currently unavailable.')
        }

        const pUrl = await previewResolver(
          currentAttachment.storage_path,
          currentAttachment.original_filename
        )

        if (!pUrl) {
          throw new Error('Unable to resolve a secure preview link for this file.')
        }

        if (!isCancelled) {
          setPreviewUrl(pUrl)
        }

        // Pre-resolve download URL if available
        if (typeof getOrderAttachmentDownloadUrl === 'function') {
          const dUrl = await getOrderAttachmentDownloadUrl(
            currentAttachment.storage_path,
            currentAttachment.original_filename
          )
          if (!isCancelled) {
            setDownloadUrl(dUrl || pUrl)
          }
        } else {
          if (!isCancelled) {
            setDownloadUrl(pUrl)
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('[OrderAttachmentPreviewModal] Error loading attachment:', err)
          setLoadError(err.message || 'Unable to load file preview.')
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    resolveUrls()

    return () => {
      isCancelled = true
    }
  }, [isOpen, currentAttachment, getOrderAttachmentPreviewUrl, getOrderAttachmentDownloadUrl, getOrderAttachmentUrl])

  // Navigation handlers
  const handlePrev = useCallback(() => {
    if (attachments.length <= 1) return
    setZoomLevel(1)
    setLoadError(null)
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : attachments.length - 1))
  }, [attachments.length])

  const handleNext = useCallback(() => {
    if (attachments.length <= 1) return
    setZoomLevel(1)
    setLoadError(null)
    setCurrentIndex((prev) => (prev < attachments.length - 1 ? prev + 1 : 0))
  }, [attachments.length])

  // Zoom controls for images
  const handleZoomIn = () => setZoomLevel((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))
  const handleResetZoom = () => setZoomLevel(1)

  // Direct download trigger
  const handleDownload = async () => {
    const targetUrl = downloadUrl || previewUrl
    if (!targetUrl || isDownloading) return
    setIsDownloading(true)
    try {
      const a = document.createElement('a')
      a.href = targetUrl
      a.download = currentAttachment?.original_filename || 'order-attachment'
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } finally {
      setTimeout(() => setIsDownloading(false), 800)
    }
  }

  // Open in new tab
  const handleOpenInNewTab = () => {
    const targetUrl = previewUrl || downloadUrl
    if (!targetUrl) return
    window.open(targetUrl, '_blank', 'noopener,noreferrer')
  }

  // Keyboard navigation & accessibility
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

  const filename = currentAttachment.original_filename || 'Attachment'
  const ext = (filename.split('.').pop() || '').toLowerCase()
  const isPdf =
    currentAttachment.mime_type === 'application/pdf' ||
    ext === 'pdf' ||
    Boolean(currentAttachment.original_filename?.toLowerCase().endsWith('.pdf'))

  const formattedSize = currentAttachment.file_size || currentAttachment.file_size_bytes
    ? `${((currentAttachment.file_size || currentAttachment.file_size_bytes) / 1024).toFixed(1)} KB`
    : null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Order Attachment Preview"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'rgba(15, 23, 42, 0.96)',
        backdropFilter: 'blur(6px)',
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, sans-serif',
        userSelect: 'none'
      }}
    >
      {/* Top Action Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          backgroundColor: '#0f172a',
          borderBottom: '1px solid #1e293b',
          gap: '12px',
          flexWrap: 'wrap',
          flexShrink: 0
        }}
      >
        {/* Document Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: isPdf ? '#7f1d1d' : '#0369a1',
              color: '#ffffff',
              letterSpacing: '0.04em'
            }}
          >
            {isPdf ? 'PDF' : ext.toUpperCase() || 'IMAGE'}
          </span>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#f8fafc',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '380px'
            }}
            title={filename}
          >
            {filename}
          </span>
          {attachments.length > 1 && (
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: '#1e293b',
                color: '#94a3b8',
                border: '1px solid #334155'
              }}
            >
              {currentIndex + 1} of {attachments.length}
            </span>
          )}
          {formattedSize && (
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              ({formattedSize})
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Zoom Controls for Photos */}
          {!isPdf && previewUrl && !loadError && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: '#1e293b',
                borderRadius: '6px',
                border: '1px solid #334155',
                padding: '2px'
              }}
            >
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
                title="Zoom Out (-)"
                style={{
                  padding: '4px 8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: zoomLevel <= 0.5 ? '#475569' : '#f8fafc',
                  background: 'none',
                  border: 'none',
                  cursor: zoomLevel <= 0.5 ? 'not-allowed' : 'pointer'
                }}
              >
                −
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                title="Reset to 100%"
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#94a3b8',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3}
                title="Zoom In (+)"
                style={{
                  padding: '4px 8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: zoomLevel >= 3 ? '#475569' : '#f8fafc',
                  background: 'none',
                  border: 'none',
                  cursor: zoomLevel >= 3 ? 'not-allowed' : 'pointer'
                }}
              >
                +
              </button>
            </div>
          )}

          {/* Open in New Window Button */}
          <button
            type="button"
            onClick={handleOpenInNewTab}
            disabled={!previewUrl && !downloadUrl}
            title="Open attachment in full browser window"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 500,
              backgroundColor: '#1e293b',
              color: '#cbd5e1',
              border: '1px solid #334155',
              borderRadius: '6px',
              cursor: (!previewUrl && !downloadUrl) ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <span>↗</span>
            <span>Open in Tab</span>
          </button>

          {/* Explicit Download Button */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={(!previewUrl && !downloadUrl) || isDownloading}
            title="Download original file to your device"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: '1px solid #3b82f6',
              borderRadius: '6px',
              cursor: ((!previewUrl && !downloadUrl) || isDownloading) ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>📥</span>
            <span>{isDownloading ? 'Saving...' : 'Download'}</span>
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            title="Close Preview (Esc)"
            style={{
              padding: '6px 12px',
              fontSize: '14px',
              fontWeight: 700,
              backgroundColor: '#334155',
              color: '#ffffff',
              border: '1px solid #475569',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Preview Viewing Area */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto',
          padding: '16px'
        }}
      >
        {/* Previous Navigation Arrow */}
        {attachments.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            title="Previous Document (Left Arrow)"
            style={{
              position: 'absolute',
              left: '20px',
              zIndex: 10,
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid #334155',
              color: '#ffffff',
              fontSize: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)'
            }}
          >
            ‹
          </button>
        )}

        {/* Content Viewer Body */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            overflow: 'hidden'
          }}
        >
          {/* Loading Indicator */}
          {isLoading && (
            <div style={{ textAlign: 'center', color: '#94a3b8' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  border: '3px solid #334155',
                  borderTopColor: '#3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 12px'
                }}
              />
              <div style={{ fontSize: '13px', fontWeight: 500 }}>Loading secure document preview...</div>
            </div>
          )}

          {/* Error Message with Fallback Actions */}
          {loadError && !isLoading && (
            <div
              style={{
                backgroundColor: '#1e293b',
                border: '1px solid #ef4444',
                borderRadius: '10px',
                padding: '24px 28px',
                maxWidth: '460px',
                textAlign: 'center',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚠️</div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#f8fafc', fontWeight: 600 }}>
                Unable to Display Document Preview
              </h4>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>
                {loadError}
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleOpenInNewTab}
                  disabled={!previewUrl && !downloadUrl}
                  style={{
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: '#1e3a8a',
                    color: '#ffffff',
                    border: '1px solid #3b82f6',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Try Opening in New Window ↗
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={!previewUrl && !downloadUrl}
                  style={{
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Download File Directly
                </button>
              </div>
            </div>
          )}

          {/* Successful Render */}
          {!isLoading && !loadError && previewUrl && (
            isPdf ? (
              /* PDF In-App Viewer */
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  maxWidth: '1180px',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                  border: '1px solid #334155'
                }}
              >
                {/* PDF Header Subbar */}
                <div
                  style={{
                    padding: '6px 14px',
                    backgroundColor: '#1e293b',
                    borderBottom: '1px solid #334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: '#94a3b8'
                  }}
                >
                  <span>📄 PDF Document ({filename})</span>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 500 }}
                  >
                    Open in Full Window ↗
                  </a>
                </div>

                {/* PDF Embedded Object */}
                <object
                  data={`${previewUrl}#toolbar=1&navpanes=0`}
                  type="application/pdf"
                  style={{ width: '100%', flex: 1, minHeight: '68vh', border: 'none' }}
                >
                  <iframe
                    src={`${previewUrl}#toolbar=1&navpanes=0`}
                    title={filename}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                  />
                  <div
                    style={{
                      padding: '32px 20px',
                      textAlign: 'center',
                      backgroundColor: '#0f172a',
                      color: '#f8fafc'
                    }}
                  >
                    <p style={{ margin: '0 0 14px 0', fontSize: '14px' }}>
                      Your browser does not support inline PDF rendering.
                    </p>
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-block',
                        padding: '8px 16px',
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        fontSize: '13px',
                        fontWeight: 600
                      }}
                    >
                      Open PDF Document
                    </a>
                  </div>
                </object>
              </div>
            ) : (
              /* Photo / Image In-App Viewer */
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'auto',
                  padding: '8px'
                }}
              >
                <img
                  src={previewUrl}
                  alt={filename}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '78vh',
                    objectFit: 'contain',
                    borderRadius: '6px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    transform: `scale(${zoomLevel})`,
                    transition: 'transform 0.15s ease-out'
                  }}
                  onError={() => {
                    setLoadError('Failed to display image. The image link may have expired or is corrupted.')
                  }}
                />
              </div>
            )
          )}
        </div>

        {/* Next Navigation Arrow */}
        {attachments.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            title="Next Document (Right Arrow)"
            style={{
              position: 'absolute',
              right: '20px',
              zIndex: 10,
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid #334155',
              color: '#ffffff',
              fontSize: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)'
            }}
          >
            ›
          </button>
        )}
      </div>

      {/* Thumbnail Bar (Multi-file Navigation Strip) */}
      {attachments.length > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 16px',
            backgroundColor: '#0f172a',
            borderTop: '1px solid #1e293b',
            overflowX: 'auto',
            flexShrink: 0
          }}
        >
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
                  setLoadError(null)
                  setCurrentIndex(idx)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: isSelected ? '2px solid #3b82f6' : '1px solid #334155',
                  backgroundColor: isSelected ? '#1e293b' : 'transparent',
                  color: isSelected ? '#f8fafc' : '#94a3b8',
                  fontSize: '11px',
                  fontWeight: isSelected ? 600 : 400,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  maxWidth: '180px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                title={att.original_filename}
              >
                <span>{isAttPdf ? '📄' : '🖼️'}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {att.original_filename || `Attachment ${idx + 1}`}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
