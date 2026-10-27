# ARS Computers

> A modern, full-stack IT hardware, security systems, product catalogue, customer enquiry, service request, and administration platform.

[![Project Status: Active](https://img.shields.io/badge/status-active%20development-blue.svg)](https://github.com/kndplParas/ars-computers)
[![React](https://img.shields.io/badge/React-19.2-61dafb.svg?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646cff.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e.svg?logo=supabase&logoColor=white)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## About the Project

**ARS Computers** is an enterprise-grade digital platform designed specifically for an IT hardware retail, networking, and security solutions business. Built to serve both public customers and internal store personnel, the application bridges commercial hardware discovery with structured after-sales technical support.

The platform handles real-world business verticals including:
- **Computers & Laptops**: Business workstations, gaming desktops, high-performance laptops, and computing peripherals.
- **CCTV & Security Solutions**: IP bullet cameras, dome cameras, DVRs, NVRs, and surveillance infrastructure.
- **Printers & Imaging**: Ink tank, laser, thermal, and multifunction printers with consumables.
- **Biometric Attendance & Access Control**: Time-attendance scanners, door controllers, and RFID solutions.
- **Commercial Inquiries & Service Tickets**: Structured quote requests, contact messages, and after-sales repair requests.
- **Administrative Store Operations**: Comprehensive inventory tracking, category taxonomies, workflow-driven enquiry management, and role-based staff administration.

---

## Key Features

### Customer Website
- **Modern Responsive Design**: Dynamic layout with custom ARS brand identity, rotating brand logo, and responsive navigation header and footer.
- **Hardware Showcase & Hero Section**: Storefront hero presentation with categorized service highlights.
- **Service Offerings Section**: Comprehensive breakdown of IT maintenance, networking, CCTV installations, and hardware repairs.
- **Storefront & Contact Details**: Verified location maps, business hours, emergency technical assistance contacts, and interactive inquiry forms.

### Product Catalogue & Search
- **Taxonomy & Category Browsing**: Dedicated category pages for laptops, desktops, security cameras, printers, and biometrics.
- **Rich Product Specifications**: Individual product detail pages featuring technical specifications, model numbers, warranty terms, and brand identifiers.
- **Direct Quote Inquiries**: Integrated quote-request drawer on product detail pages allowing customers to inquire about specific models.
- **Active Real-Time Search**:
  - Live query parsing matching product names, brands, models, categories, and technical attributes.
  - Ranked search results with case-insensitivity and whitespace tolerance.
  - Fully keyboard-accessible navigation with dedicated search results route (`/search`).
- **Resilient Fallback Layer**: Production catalog engine with client-side caching and fallback dataset ensuring high availability.

### Customer Enquiries & Service Requests
- **Structured General Inquiries**: Public contact enquiry submission validating customer names, mobile numbers, and messages.
- **After-Sales Service & Repair Form**:
  - Structured service ticket generator creating standard ticket references (`ARS-SR-YYYYMMDD-XXXX`).
  - Conditional hardware diagnostic checklists tailored for CCTV installations and PC/laptop diagnostics.
  - Anti-spam honeypot fields and client abuse rate limiting.
- **Unified Processing**: Automatic routing of service requests into administrative tracking pipelines.

### Admin Portal
- **Centralized Dashboard**: Real-time business metrics, catalog summaries, active stock counts, and pending inquiry alerts.
- **Product Management**: Full catalog creation and editing interface, image management, specifications editor, and safe soft-deletions.
- **Inventory Control**: Real-time stock quantity adjustments with minimum stock thresholds and alert indicators.
- **Category Taxonomies**: Product taxonomy management interface for category slugs, descriptions, and feature icons.
- **7-Stage Enquiry Workflow**:
  - Status progression: `New` &rarr; `In Progress` &rarr; `Rejection Requested` &rarr; `Approved/Rejected` &rarr; `Resolved` &rarr; `Archived`.
  - Immutable activity trail, supervisor notes, and audit tracking.
  - Protected 7-day Bin lifecycle for archived inquiries with automatic expiration guards.
- **Staff Administration**: Superadmin panel for managing employee accounts, updating access roles, and managing account statuses.

### Role-Based Access Control (RBAC)
- **Superadmin**: Full administrative authority, staff account provisioning, role updates, product/category mutations, rejection approvals, bin purge/restoration, and audit trail inspection. Guarded against accidental self-demotion or removing the last active superadmin.
- **Admin (Employee)**: Operational inquiry processing, progress updates, internal customer notes, and read-only catalog browsing. Mutation forms and administrative staff panels are disabled.
- **Inventory Staff**: Targeted access restricted strictly to inventory stock counts and warehouse updates; commercial catalog modifications and customer inquiries are restricted.

---

## Security

The platform follows a defense-in-depth, fail-closed security architecture:
- **Authentication**: Session management and email/password authentication powered by Supabase Auth.
- **Row Level Security (RLS)**: Enforced across all PostgreSQL tables. Public clients are restricted to authorized read paths and constrained enquiry insertions.
- **RPC Privilege Hardening**: Sensitive database functions and state mutations use dedicated PostgreSQL stored procedures with execution privileges revoked from anonymous and public roles.
- **Client Route Guards**: Protected client-side routing (`AdminRouteGuard`) verifying authenticated session states and matching role permissions.
- **Storage Security**: Strict MIME-type whitelisting and 5 MB file size limitations on image upload buckets; SVG files are excluded to prevent stored XSS attacks.
- **Data Immutability**: Dedicated database triggers preventing modification or deletion of historical audit logs and original customer enquiry submissions.
- **Zero Secrets Tracked**: Strictly excludes `.env`, `.env.local`, and backup files from version control.

---

## Technology Stack

### Frontend & Core
- **Framework**: [React 19](https://react.dev/) (`^19.2.8`)
- **Build Tool**: [Vite 8](https://vitejs.dev/) (`^8.3.0`)
- **Routing**: [React Router 7](https://reactrouter.com/) (`^7.18.4`)
- **Styling**: Vanilla CSS design system with custom properties, responsive grids, and animations.

### Backend & Database
- **Platform**: [Supabase](https://supabase.com/) (`@supabase/supabase-js ^2.118.0`)
- **Database**: PostgreSQL with Row Level Security (RLS), advisory locking, and triggers.
- **Authentication**: Supabase GoTrue Auth with secure session persistence.
- **Storage**: Supabase Storage with bucket-level security policies.

### Quality & Testing
- **Linter**: [Oxlint](https://oxc.rs/) (`^1.81.0`)
- **Test Runners**: Native Node.js test suites with custom asset loaders.

---

## Project Architecture

```text
ARS-Computers/
├── public/                     # Static media, icons, brand assets, and headers
│   ├── .htaccess               # Apache URL rewrite rules for SPA client routing
│   ├── _headers                # Security headers and frame guard policies
│   ├── icons.svg               # System vector icon sprites
│   └── logo.svg                # ARS brand vector mark
├── src/
│   ├── assets/                 # Verified hardware showcase photos and branding
│   ├── components/             # Reusable UI components
│   │   ├── admin/              # Admin layout, navigation sidebar, and route guards
│   │   ├── common/             # Error boundaries and layout wrappers
│   │   ├── CustomerServiceRequestForm.jsx
│   │   ├── ProductSearch.jsx   # Live search bar component
│   │   ├── SiteFooter.jsx
│   │   └── SiteHeader.jsx      # Navigation header with rotating brand mark
│   ├── context/                # Authentication & data providers
│   │   ├── AdminAuthProvider.jsx
│   │   └── AdminDataProvider.jsx
│   ├── data/                   # Category taxonomies, product templates, and fallbacks
│   ├── lib/                    # Supabase client instance and catalog fallback engine
│   ├── pages/                  # Public customer pages
│   │   ├── admin/              # Admin portal views (Dashboard, Products, Enquiries, Staff, etc.)
│   │   ├── CategoryPage.jsx
│   │   ├── CustomerHomePage.jsx
│   │   ├── ProductDetailsPage.jsx
│   │   └── SearchResultsPage.jsx
│   ├── utils/                  # Enquiry parsing and search helper utilities
│   ├── App.jsx                 # Route configurations and provider tree
│   ├── App.css                 # Application styles and design tokens
│   └── main.jsx                # Application root mount point
├── supabase/
│   ├── migrations/             # Version-controlled SQL migration scripts
│   ├── snippets/               # Diagnostic SQL queries
│   └── seed.sql                # Default hardware catalog seed data
├── test/                       # Security, catalog fallback, and service test suites
├── .env.example                # Safe environment variable configuration template
├── .oxlintrc.json              # Static code analysis configuration
└── vite.config.js              # Vite toolchain configuration
```

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18.0.0 or higher recommended)
- [npm](https://www.npmjs.com/) (version 9.0.0 or higher)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/kndplParas/ars-computers.git
   cd ars-computers
   ```

2. **Install project dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Copy the example environment configuration template to create your local environment file:
   ```bash
   cp .env.example .env.local
   ```
   Populate `.env.local` with your Supabase credentials (see [Environment Variables](#environment-variables)).

4. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:5173`.

---

## Environment Variables

Configuration is handled through environment variables. Safe defaults and placeholders are provided in [`.env.example`](.env.example):

| Variable | Description | Example Format |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | The HTTPS URL of your Supabase project instance | `https://your-project-id.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Public anonymous API key for client queries | `your-supabase-anon-key-here` |

> **Note:** Never commit `.env.local` or expose administrative service-role keys to client-side code.

---

## Available Scripts

The following npm scripts are defined in `package.json`:

- **`npm run dev`**: Launches the Vite development server with Hot Module Replacement (HMR).
- **`npm run build`**: Compiles and bundles production-ready assets into the `dist/` directory.
- **`npm run preview`**: Serves the local production build for pre-deployment verification.
- **`npm run lint`**: Runs fast static analysis across all JavaScript source files using Oxlint.
- **`npm run test:security`**: Executes the comprehensive automated security and RBAC test suite.

---

## Testing

The project includes multi-tiered automated verification suites covering security invariants, catalog resilience, search accuracy, and service workflows:

- **Security & RBAC Test Suite**:
  ```bash
  npm run test:security
  ```
  Validates 100+ assertions across authentication routines, least-privilege role boundaries, storage policies, and audit immutability triggers.

- **Catalog Fallback Test Suite**:
  ```bash
  node --env-file=.env.local --loader ./test/asset-loader.js test/catalog-fallback.test.js
  ```
  Tests catalog normalization, client caching, and offline fallback mechanisms.

- **Product Search Verification**:
  ```bash
  node --env-file=.env.local --loader ./test/asset-loader.js test/product-search.test.js
  ```
  Verifies query ranking, case-insensitivity, whitespace trimming, and zero-fabrication invariants.

- **Service Request Workflow Test**:
  ```bash
  node test/service-requests.test.js
  ```
  Verifies ticket sequence generation, customer form validation, and admin workflow transitions.

---

## Database & Supabase

Database schema evolutions are version-controlled through sequential SQL files located in [`supabase/migrations/`](supabase/migrations/):

- `20261018000001_initial_schema.sql`: Base tables for categories, products, and customer enquiries with RLS.
- `20261019000001_extend_product_catalog.sql`: Hardware specifications and structured attributes.
- `20261019000002_admin_roles_and_permissions.sql`: Admin roles, advisory locks, and bootstrap guards.
- `20261019000003_storage_security_policies.sql`: Storage bucket policies with MIME and size constraints.
- `20261022000001_enforce_admin_employee_read_only_and_superadmin_guard.sql`: Least-privilege role controls.
- `20261022000002_audit_logs_activities_and_customer_immutability.sql`: Immutable audit logs and enquiry trails.
- `20261022000004_enquiry_workflow_and_approvals.sql`: Multi-stage enquiry workflows and approval RPCs.
- `20261022000005_employee_task_completion_and_bin_workflow.sql`: Task completion and 7-day bin lifecycle.
- `20261024000003_service_request_system.sql`: Dedicated after-sales service tickets and activity logging.
- `20261026000001_extend_enquiries_for_service_requests.sql`: Unified enquiry and service request mapping.

---

## Repository Security

- **Row-Level Security**: All database access is locked down by default.
- **No Secrets in History**: All commits undergo automated secret audits to ensure zero credentials, tokens, or private configurations are tracked.
- **Fail-Closed Design**: If database connections fail or are misconfigured, the catalog and administrative UI fail safely to isolated fallbacks without exposing sensitive stack traces.

---

## Contributors

- **Paras Kandpal** — Project Author & Maintainer ([@kndplParas](https://github.com/kndplParas))
- **Agastya** — Project Collaborator ([@agastya793](https://github.com/agastya793))

---

## Project Status

This project is currently under **active development**. Features and architectural components are continuously refined and tested.
