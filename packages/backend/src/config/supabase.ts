import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Cargar variables de entorno antes de usarlas
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Faltan variables de entorno de Supabase');
}

// Cliente con permisos de servicio (para el backend)
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Cliente para verificar tokens de usuario
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

export const supabaseAuth = supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
