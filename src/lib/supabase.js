import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : undefined)
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY : undefined)

/**
 * Checks whether valid Supabase environment credentials are present.
 * Prevents runtime errors when credentials are not yet configured in .env.local.
 */
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project-id.supabase.co' &&
  supabaseAnonKey !== 'your-supabase-anon-key-here'
)

/**
 * Singleton Supabase client instance.
 * Initialized only when valid environment credentials are provided.
 */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
