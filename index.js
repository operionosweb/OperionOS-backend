import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

// ✅ ENV
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

// ✅ DEBUG
console.log("SUPABASE_URL:", SUPABASE_URL ? "Loaded" : "Missing");
console.log("SUPABASE_KEY:", SUPABASE_KEY ? "Loaded" : "Missing");
console.log("MISTRAL_API_KEY:", MISTRAL_API_KEY ? "Loaded" : "Missing");

if (!SUPABASE_URL || !SUPABASE_KEY || !MISTRAL_API_KEY) {
  throw new Error("Missing environment variables");
}

// ✅ SUPABASE
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// TEST
app.get("/", (req, res) => {
  res.send("Operion Backend Running ✅");
});

// MAIN
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon", domain = "general" } = req.body;

    // MEMORY
    const { data: memory } = await supabase
      .from("user_memory")
      .select("*")
      .eq("user_id", user_id)
      .limit(5);

    // ✅ USE BUILT-IN FETCH (Node 18+)
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "mistral-small",
        messages: [
          {
            role: "system",
            content: `Domain: ${domain}. Memory: ${JSON.stringify(memory)}`
          },
          {
            role: "user",
            content: message
          }
        ]
      })
    });

    const data = await response.json();

    const reply = data?.choices?.[0]?.message?.content || "No response";

    // SAVE
    await supabase.from("messages").insert([
      { user_id, message, reply, domain }
    ]);

    res.json({ reply });

  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// START
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
