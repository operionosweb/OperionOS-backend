import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

// ENV VARIABLES
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

// DEBUG CHECK
console.log("SUPABASE_URL:", SUPABASE_URL ? "Loaded" : "Missing");
console.log("SUPABASE_KEY:", SUPABASE_KEY ? "Loaded" : "Missing");
console.log("MISTRAL_API_KEY:", MISTRAL_API_KEY ? "Loaded" : "Missing");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing Supabase environment variables");
}

// INIT SUPABASE
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// TEST ROUTE
app.get("/", (req, res) => {
  res.send("Operion Backend Running ✅");
});

// MAIN ROUTE
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anonymous", domain = "general" } = req.body;

    // GET MEMORY
    const { data: memory } = await supabase
      .from("user_memory")
      .select("*")
      .eq("user_id", user_id)
      .limit(5);

    // CALL MISTRAL
    const aiResponse = await
