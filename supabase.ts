
import { createClient } from '@supabase/supabase-js';

// URL do projeto fornecida pelo usuário
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

// Chave de API (Anon/Public) fornecida pelo usuário
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
