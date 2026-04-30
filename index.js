const express = require("express");
const fetch = require("node-fetch");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

// DEBUG: check env vars
console.log("SUPABASE_URL:", process.env.SUPABASE_URL);
console.log("SUPABASE_KEY:", process.env.SUPABASE_KEY ? "OK" : "MISSING");
console.log("MISTRAL_API_KEY:", process.env.MISTRAL_API_KEY ? "OK" : "MISSING");

// Create client safely
let supabase;
try {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );
  console.log("Supabase client created");
} catch (e) {
  console.error("Supabase init error:", e.message);
}

// Health check
app.get("/", (req, res) => {
  res.send("Operion Debug Mode Running");
});

// Minimal test route
app.post("/chat", async (req, res) => {
  try {
    res.json({ reply: "Backend is alive" });
  } catch (error) {
    console.error("Route error:", error);
    res.json({ reply: "Error: " + error.message });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server started on port " + PORT);
});
