import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Ensure .env is loaded even if server.js hasn't run dotenv.config yet
try {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  // Go up one level: actual .env resides in backend/.env, not backend/lib/.env
  const envPath = path.join(__dirname, '..', '.env')
  dotenv.config({ path: envPath })
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('[SUPABASE] dotenv load failed (continuing):', e?.message)
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  // eslint-disable-next-line no-console
  console.warn('[SUPABASE] Missing envs SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY. Current:', {
    SUPABASE_URL: SUPABASE_URL ? 'SET' : 'MISSING',
    SUPABASE_ANON_KEY: SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
    SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING'
  })
}

// Public client for user-facing operations if needed
export const supabase = createClient(
  SUPABASE_URL || '',
  SUPABASE_ANON_KEY || ''
)

// Admin client for server-side DB and Storage operations
export const supabaseAdmin = createClient(
  SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY || ''
)

export const getUserFromToken = async (token) => {
  if (!token) return null
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    if (error) return null
    return data?.user || null
  } catch (_) {
    return null
  }
}
