import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "Operion Backend Running" });
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    res.json({
      success: true,
      user: data.user,
      session: data.session,
    });

  } catch (err) {
    res.status(500).json({ error: "Login error" });
  }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on ${PORT}`);
});
