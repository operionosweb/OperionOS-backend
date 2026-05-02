import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

// ✅ READ ENV VARIABLES CORRECTLY
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

// ✅ DEBUG (VERY IMPORTANT)
console.log("SUPABASE_URL:", SUPABASE_URL ? "Loaded" : "Missing");
console.log("SUPABASE_KEY:", SUPABASE_KEY ? "Loaded" : "Missing");

// ✅ PREVENT CRASH
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing Supabase environment variables");
}

// ✅ CREATE CLIENT
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// TEST ROUTE
app.get("/", (req, res) => {
  res.send("Operion Backend Running ✅");
});

// MAIN MESSAGE ROUTE
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anonymous", domain = "general" } = req.body;

    // 🔹 GET MEMORY
    const { data: memory } = await supabase
      .from("user_memory")
      .select("*")
      .eq("user_id", user_id)
      .limit(5);

    // 🔹 CALL MISTRAL
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "mistral-small",
        messages: [
          {
            role: "system",
            content: `Domain: ${domain}. Use memory if relevant: ${JSON.stringify(memory)}`
          },
          {
            role: "user",
            content: message
          }
        ]
      })
    });

    const data = await response.json();

    const reply =
      data?.choices?.[0]?.message
