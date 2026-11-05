# WhatsApp Purchasing Enquiries

ARS Computers uses WhatsApp for purchase discussions and requirement gathering.
It is **not** an order, checkout, reservation, or payment flow. The website only
opens a WhatsApp chat with real catalogue details prefilled.

## Business number

| Format | Value |
| --- | --- |
| International / `wa.me` | `917078382213` |
| Display | `+91 7078382213` |

Links open `https://wa.me/917078382213` and WhatsApp chooses the app on supported
mobile devices or WhatsApp Web/browser on desktop. The message is passed as the
URL-encoded `text` query parameter.

## Where the CTA appears

| Page | Behaviour |
| --- | --- |
| Category product cards | **Buy on WhatsApp** plus **Add to enquiry** on every active product in Computers & Laptops, CCTV, Printers, Biometric, and Accessories. |
| Search result cards | **Buy on WhatsApp** plus **Add to enquiry** on every matching product. |
| Product details page | Prominent **Buy on WhatsApp** CTA with a no-order/no-payment note. |
| Related products | A compact **WhatsApp** link on each related product. |
| Selection tray | Appears after selecting products and sends one combined WhatsApp message. |

All pages read their product data from the existing Supabase/static catalogue.
New products added through the admin catalogue automatically receive the same
buttons; no per-product configuration is required.

## Message content

A single-product enquiry contains only values present in the catalogue:

```text
Hello ARS Computers,

I am interested in purchasing the following product:

Product: <catalogue name>
Product ID: <SKU, otherwise product id>
Category: <category title>
Brand/Model: <brand and model, when available>
Quantity: 1
Product Link: https://arscomputer.com/products/<slug>

Please share the latest price, availability and purchase details.

My additional requirements:
[Customer can type here]

Thank you.
```

Missing optional fields are omitted. Prices, stock, brands, models, and
specifications are never invented. The message deliberately does not claim that
an order is confirmed or that payment was completed.

## Multiple products

There is no cart or checkout. Product cards expose **Add to enquiry**, which
stores a lightweight selection in `sessionStorage` for the current browser
session. Selecting products displays a tray with:

- the selected product count and a short name preview,
- **Clear**,
- **Send WhatsApp enquiry (N)**.

Sending opens one WhatsApp conversation with numbered product blocks:

```text
Hello ARS Computers,

I am interested in purchasing the following products:

1. Product: ...
   Product ID: ...
   Category: ...
   Brand/Model: ...
   Quantity: 1
   Product Link: ...

2. Product: ...

Please share the latest price, availability and purchase details for these items.

My additional requirements:
[Customer can type here]

Thank you.
```

The selection is capped at 20 products to keep the message practical. Duplicate
products are ignored, and the selection is not an order or booking.

## Implementation

| File | Purpose |
| --- | --- |
| `src/lib/whatsappPurchase.js` | Pure message and `wa.me` URL builders, number constants, category/brand fallbacks. |
| `src/components/WhatsAppButton.jsx` | Reusable CTA with inline WhatsApp icon, safe new-tab link, and accessible label. |
| `src/components/WhatsAppSelectionBar.jsx` | Floating multi-product tray with the no-order disclaimer. |
| `src/lib/useProductSelection.js` | Session-scoped selection state, deduplication, and 20-product cap. |
| `src/pages/CategoryPage.jsx` | Category card CTAs and selection tray. |
| `src/pages/SearchResultsPage.jsx` | Search result CTAs and selection tray. |
| `src/pages/ProductDetailsPage.jsx` | Details CTA, disclaimer, and related-product links. |
| `src/App.css` | WhatsApp-green buttons, CTA layout, related links, and responsive tray. |

No database migration, RLS change, staff-account change, customer-record change,
approval-workflow change, or notification-system change is required.

## Validation

```bash
npm run test:whatsapp
npm run lint
npm run test:security
npm run test:notifications
npm run build
npm run check:deploy
```

`test/whatsapp-purchase.test.js` covers the business number, single- and
multi-product messages, optional fields, URL encoding, all five catalogue
categories, future admin-added products, and page/component integration.
