import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://brxgkmnxkxumgozthnkh.supabase.co'
const supabaseAnonKey = 'sb_publishable_M1JUOVtuXWWiYaYmnAf_cg_Ah5s9Vma'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)