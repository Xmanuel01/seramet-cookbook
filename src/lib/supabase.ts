import { createClient } from "@supabase/supabase-js"

const sharedStagingUrl = "https://vnymbavsbxorwxpebkot.supabase.co"
const sharedStagingPublishableKey = "sb_publishable_hatvoaSWT-EUzoytKzd3-g_oWJAuHQy"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || sharedStagingUrl
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || sharedStagingPublishableKey

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
