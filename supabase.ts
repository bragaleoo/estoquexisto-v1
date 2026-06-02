
import { createClient } from '@supabase/supabase-js';

// URL do projeto fornecida pelo usuário
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://rmoiwobfdvqtnbqjnesi.supabase.co';

// Chave de API (Anon/Public) fornecida pelo usuário
const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_xo5VYyhNFR8M-MuCwzwKzg_vdD1l1wq';

export const supabase = createClient(supabaseUrl, supabaseKey);
