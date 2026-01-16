
import { createClient } from '@supabase/supabase-js';

// URL do projeto fornecida pelo usuário
const supabaseUrl = 'https://rmoiwobfdvqtnbqjnesi.supabase.co';

// Chave de API (Anon/Public) fornecida pelo usuário
const supabaseKey = 'sb_publishable_xo5VYyhNFR8M-MuCwzwKzg_vdD1l1wq';

export const supabase = createClient(supabaseUrl, supabaseKey);
