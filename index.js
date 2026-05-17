import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import multer from "multer";
import fs from "fs";
import crypto from "crypto";

/* ===============================
   IMPORT ALL ENGINES
=============================== */

import { generateAircraftTransition } from "./aircraftTransitionEngine.js";
import { generateAviationFinancialStressTest } from "./aviationFinancialStressTestEngine.js";
import { generateDecisionOS } from "./decisionOS.js";

dotenv.config();

const app = express();

/* ===============================
   SUPABASE
=============================== */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/* ===============================
   MIDDLEWARE
=============================== */

app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.url}`);
  next();
});

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

/* ===============================
   ROOT
=============================== */

app.get("/", (req, res) => {
  res.json({
    status: "Operion Decision OS Live",
    layer: "Unified Aviation Intelligence System"
  });
});

/* ===============================
   AUTH
=============================== */

async function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Missing token" });
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = data.user;
    next();

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Auth failed" });
  }
}

/* ===============================
   GET CONTRACT
=============================== */

async function getLatestContract(contract_id) {
  const { data, error } = await supabase
    .from("contract_versions")
    .select("*")
    .eq("contract_id", contract_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) throw new Error("Contract not found");

  return data;
}

/* ===============================
   DECISION OS ENDPOINT
=============================== */

app.get("/api/contracts/:id/decision", auth, async (req, res) => {
  try {
    const contract = await getLatestContract(req.params.id);

    const [stressTest, transition] = await Promise.all([
      generateAviationFinancialStressTest({ contract }),
      generateAircraftTransition({ contract })
    ]);

    const decision = await generateDecisionOS({
      contract,
      stressTest,
      transition
    });

    res.json({
      contract_id: req.params.id,
      decision
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Decision OS failed"
    });
  }
});

/* ===============================
   🚀 FILE INGESTION SYSTEM
=============================== */

const upload = multer({ dest: "uploads/" });

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

/**
 * POST /api/contracts/upload
 * Upload contract file (PDF/DOCX/etc.)
 */
app.post("/api/contracts/upload", auth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileBuffer = fs.readFileSync(req.file.path);

    const contractRecord = {
      id: crypto.randomUUID(),
      fileName: req.file.originalname,
      uploadedAt: new Date().toISOString(),

      status: "UPLOADED",

      // raw file (temporary placeholder for OCR/AI step)
      rawFileBase64: fileBuffer.toString("base64"),

      parsed: null,
      obligations: [],
      riskScore: null
    };

    // cleanup temp file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: "Contract uploaded successfully",
      contract: contractRecord
    });

  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* ===============================
   HEALTH CHECK
=============================== */

app.get("/api/system/health", (req, res) => {
  res.json({
    status: "operational",
    layer: "decision-os + ingestion",
    timestamp: new Date()
  });
});

/* ===============================
   START SERVER
=============================== */

const PORT = process.env.PORT || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Operion Decision OS running on port ${PORT}`);
});
