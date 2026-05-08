import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://YOUR_PROJECT.supabase.co",
  "YOUR_SUPABASE_ANON_KEY"
);
