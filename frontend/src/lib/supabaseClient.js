import { createClient } from "@supabase/supabase-js";

/* ===============================
   SUPABASE CLIENT
   (uses environment variables)
=============================== */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/* ===============================
   SAFETY CHECK (helps debugging)
=============================== */

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Auth will not work until these are set."
  );
}

/* ===============================
   CLIENT EXPORT
=============================== */

export const supabase = createClient(
  supabaseUrl || "",
  supabaseAnonKey || "",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
