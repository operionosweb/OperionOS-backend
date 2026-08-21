import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

let client;

export function getSupabaseClient() {
  if (client) return client;

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service-role storage is not configured");
  }

  client = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  return client;
}

const supabase = new Proxy(
  {},
  {
    get(_target, property) {
      const value = getSupabaseClient()[property];
      return typeof value === "function"
        ? value.bind(getSupabaseClient())
        : value;
    },
  }
);

export default supabase;
