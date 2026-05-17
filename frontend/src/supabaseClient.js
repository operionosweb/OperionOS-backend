import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://gmlppdavgdomhsgxucgu.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbHBwZGF2Z2RvbWhzZ3h1Y2d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0ODgwMTcsImV4cCI6MjA5MzA2NDAxN30.l3rg0oG0SFP4D89a__GDF7HoDNWPmVysvdFuQUpT8x8"
);
