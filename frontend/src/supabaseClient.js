import { createClient } from "@supabase/supabase-js";

// 🔴 REPLACE THESE WITH YOUR SUPABASE VALUES
const SUPABASE_URL = "https://gmlppdavgdomhsgxucgu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbHBwZGF2Z2RvbWhzZ3h1Y2d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0ODgwMTcsImV4cCI6MjA5MzA2NDAxN30.l3rg0oG0SFP4D89a__GDF7HoDNWPmVysvdFuQUpT8x8";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
