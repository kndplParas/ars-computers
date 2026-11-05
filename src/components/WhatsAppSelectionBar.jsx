import WhatsAppButton from './WhatsAppButton'

/**
 * Floating summary for the lightweight multi-product selection. It only opens
 * a WhatsApp conversation with the selected products prefilled; it is not a
 * cart, checkout, order confirmation, or payment flow.
 */
export default function WhatsAppSelectionBar({ selected = [], onClear = null }) {
  if (!Array.isArray(selected) || selected.length === 0) return null

  const names = selected.map((product) => product.rawName || product.name).filter(Boolean)
  const preview = names.slice(0, 3).join(', ')
  const remaining = Math.max(0, names.length - 3)

  return (
    <section
      className="whatsapp-selection-bar"
      role="region"
      aria-label="Selected products for a WhatsApp enquiry"
      aria-live="polite"
    >
      <div className="whatsapp-selection-info">
        <span className="whatsapp-selection-count">
          {selected.length} product{selected.length === 1 ? '' : 's'} selected
        </span>
        <span className="whatsapp-selection-names">
          {preview}
          {remaining > 0 ? ` +${remaining} more` : ''}
        </span>
        <span className="whatsapp-selection-note">
          Opens a WhatsApp chat only — no order or payment is placed here.
        </span>
      </div>

      <div className="whatsapp-selection-actions">
        {onClear && (
          <button type="button" className="whatsapp-selection-clear" onClick={onClear}>
            Clear
          </button>
        )}
        <WhatsAppButton
          products={selected}
          label={`Send WhatsApp enquiry (${selected.length})`}
          className="whatsapp-selection-send"
        />
      </div>
    </section>
  )
}
