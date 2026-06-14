import { createClient } from '@supabase/supabase-js'

console.log('Creando cliente Supabase')

const supabaseUrl = 'https://qcuvbogtojtmtbukdzyg.supabase.co'

const supabaseAnonKey = 'sb_publishable_eDVkULUV2RB4IFs9s6M1CA_yLi5vH-h'

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)