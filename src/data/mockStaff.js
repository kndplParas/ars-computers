/**
 * ============================================================================
 * ARS Computers — Fictional Demo Staff Data
 * ============================================================================
 * Clearly labeled mock staff directory records for offline evaluation and UI
 * state demonstration.
 *
 * NOTE: All names, emails, and credentials below are synthetic demo data.
 * Real administrative users reside in Supabase auth.users and public.admin_users.
 * ============================================================================
 */

export const INITIAL_DEMO_STAFF = [
  {
    id: 'demo-staff-superadmin-001',
    email: 'superadmin.demo@arscomputers.example.com',
    full_name: 'Principal Superadmin',
    role: 'superadmin',
    is_active: true,
    created_at: '2026-10-19T06:00:00Z',
    updated_at: '2026-10-19T06:00:00Z',
    is_demo: true
  },
  {
    id: 'demo-staff-admin-002',
    email: 'operations.admin@arscomputers.example.com',
    full_name: 'Store Service Engineer',
    role: 'engineer',
    is_active: true,
    created_at: '2026-10-19T08:30:00Z',
    updated_at: '2026-10-19T08:30:00Z',
    is_demo: true
  },
  {
    id: 'demo-staff-hr-005',
    email: 'hr.lead@arscomputers.example.com',
    full_name: 'Personnel HR Lead',
    role: 'hr',
    is_active: true,
    created_at: '2026-10-20T09:00:00Z',
    updated_at: '2026-10-20T09:00:00Z',
    is_demo: true
  },
  {
    id: 'demo-staff-technical-006',
    email: 'tech.support@arscomputers.example.com',
    full_name: 'Lead Diagnostic Specialist',
    role: 'technical',
    is_active: true,
    created_at: '2026-10-20T10:00:00Z',
    updated_at: '2026-10-20T10:00:00Z',
    is_demo: true
  },
  {
    id: 'demo-staff-inventory-003',
    email: 'inventory.lead@arscomputers.example.com',
    full_name: 'Warehouse Stock Lead',
    role: 'inventory_staff',
    is_active: true,
    created_at: '2026-10-19T09:45:00Z',
    updated_at: '2026-10-19T09:45:00Z',
    is_demo: true
  },
  {
    id: 'demo-staff-inactive-004',
    email: 'former.staff@arscomputers.example.com',
    full_name: 'Former Support Associate',
    role: 'inventory_staff',
    is_active: false,
    created_at: '2026-10-15T10:00:00Z',
    updated_at: '2026-10-18T14:20:00Z',
    is_demo: true
  }
]
