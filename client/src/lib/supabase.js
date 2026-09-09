import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey)
  : null

export const CAMPAIGN = 'I Support Blue Economy — Gujarat Fisheries'
export const CONSENT_TEXT =
  'I consent to my photo being stored and used by the Gujarat Fisheries campaign.'
export const CAPTION =
  'I Support Blue Economy 🌊 Create yours → https://isupportblueeconomy.click\n\n#BlueEconomy'