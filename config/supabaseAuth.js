import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

let supabaseAuthClient;

export function getSupabaseAuthClient() {
  if (supabaseAuthClient) {
    return supabaseAuthClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase Auth is not configured");
  }

  supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAuthClient;
}
