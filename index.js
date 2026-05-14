import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

import { logAudit } from "./db.js";

dotenv.config();

const app = express();

/* ===============================
   SUPABASE (ANON SAFE MODE)
=============================== */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/* ===============================
   MIDDLEWARE
=============================== */

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.url}`);
  next();
});

/* ===============================
   ROOT
=============================== */

app.get("/", (req, res) => {
  res.json({
    status: "Operion Backend Live",
    layer: "contracts + storage + ingestion ready"
  });
});

/* ===============================
   AUTH LOGIN
=============================== */

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password required"
      });
    }

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      return res.status(401).json({
        error: error.message
      });
    }

    res.json({
      success: true,
      user: data.user,
      session: data.session
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Login failed"
    });
  }
});

/* ===============================
   AUTH MIDDLEWARE
=============================== */

async function auth(req, res, next) {
  try {
    const token =
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        error: "Missing token"
      });
    }

    const { data, error } =
      await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({
        error: "Invalid token"
      });
    }

    req.user = data.user;
    next();

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Auth error"
    });
  }
}

/* ===============================
   PROFILE
=============================== */

async function getProfile(userId) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new Error("Profile not found");
  }

  return data;
}

/* ===============================
   CONTRACT UPLOAD TEST (FULL PIPELINE)
=============================== */

app.post("/api/contracts/test-upload", auth, async (req, res) => {
  try {
    const { file_base64, file_name } = req.body;

    if (!file_base64 || !file_name) {
      return res.status(400).json({
        error: "Missing file_base64 or file_name"
      });
    }

    const profile = await getProfile(req.user.id);
    const company_id = profile.company_id;

    const file_id = crypto.randomUUID();
    const fileBuffer = Buffer.from(file_base64, "base64");

    const filePath = `${company_id}/${file_id}_${file_name}`;

    /* ===============================
       1. UPLOAD TO SUPABASE STORAGE
    =============================== */

    const { error: uploadError } = await supabase.storage
      .from("contract-files")
      .upload(filePath, fileBuffer, {
        contentType: "application/pdf",
        upsert: false
      });

    if (uploadError) {
      return res.status(500).json({
        error: uploadError.message
      });
    }

    /* ===============================
       2. GET FILE URL
    =============================== */

    const { data: urlData } = supabase.storage
      .from("contract-files")
      .getPublicUrl(filePath);

    /* ===============================
       3. STORE IN DATABASE
    =============================== */

    const { data: inserted, error: dbError } =
      await supabase
        .from("contract_files")
        .insert([
          {
            id: file_id,
            company_id,
            file_name,
            file_url: urlData.publicUrl,
            extracted_text: null
          }
        ])
        .select()
        .single();

    if (dbError) {
      return res.status(500).json({
        error: dbError.message
      });
    }

    /* ===============================
       4. AUDIT LOG
    =============================== */

    await logAudit({
      user_id: req.user.id,
      company_id,
      action: "CONTRACT_FILE_UPLOADED",
      entity_type: "contract_file",
      entity_id: file_id,
      metadata: {
        file_name
      }
    });

    /* ===============================
       RESPONSE
    =============================== */

    res.json({
      success: true,
      file_id,
      file_url: urlData.publicUrl,
      db_record: inserted
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Upload failed"
    });
  }
});

/* ===============================
   HEALTH CHECK
=============================== */

app.get("/api/system/health", (req, res) => {
  res.json({
    status: "operational",
    system: "operion-contracts-v1"
  });
});

/* ===============================
   START SERVER
=============================== */

const PORT = process.env.PORT || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Operion Backend running on port ${PORT}`);
});
