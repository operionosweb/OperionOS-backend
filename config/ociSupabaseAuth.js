import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { assertDedicatedOciSupabaseUrl } from "./ociProjectTarget.js";

dotenv.config();

let client;

export function getOciSupabaseAuthClient() {
  if (client) return client;
  const supabaseUrl = assertDedicatedOciSupabaseUrl({
    target: process.env.OCI_DATABASE_TARGET,
    projectRef: process.env.OCI_SUPABASE_PROJECT_REF,
    supabaseUrl: process.env.OCI_SUPABASE_URL,
  });
  const anonKey = process.env.OCI_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error("OCI Supabase Auth anon key is not configured.");
  client = createClient(supabaseUrl.toString(), anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
