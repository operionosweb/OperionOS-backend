import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import pdfParse from "pdf-parse";

import { createClient } from "@supabase/supabase-js";

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
   MULTER
=============================== */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

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
   HEALTH
=============================== */

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "Operion Backend",
    timestamp: new Date()
  });
});

/* ===============================
   AUTH
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
      error: "Auth failed"
    });

  }

}

/* ===============================
   GET CONTRACT
=============================== */

async function getLatestContract(contract_id) {

  const { data, error } =
    await supabase
      .from("contract_versions")
      .select("*")
      .eq("contract_id", contract_id)
      .order("created_at", {
        ascending: false
      })
      .limit(1)
      .single();

  if (error || !data) {
    throw new Error("Contract not found");
  }

  return data;

}

/* ===============================
   CONTRACT UPLOAD + PDF EXTRACTION
=============================== */

app.post(
  "/api/contracts/upload",
  auth,
  upload.single("file"),
  async (req, res) => {

    try {

      if (!req.file) {
        return res.status(400).json({
          error: "No file uploaded"
        });
      }

      const file = req.file;

      const fileName =
        `${Date.now()}-${file.originalname}`;

      let extractedText = "";

      if (
        file.mimetype === "application/pdf"
      ) {

        try {

          const parsed =
            await pdfParse(file.buffer);

          extractedText =
            parsed.text || "";

        } catch (pdfError) {

          console.error(
            "PDF parsing failed",
            pdfError
          );

        }

      }

      const {
        data: storageData,
        error: storageError
      } =
        await supabase.storage
          .from("contracts")
          .upload(
            fileName,
            file.buffer,
            {
              contentType: file.mimetype,
              upsert: false
            }
          );

      if (storageError) {

        console.error(storageError);

        return res.status(500).json({
          error: "Storage upload failed"
        });

      }

      const {
        data: contractData,
        error: dbError
      } =
        await supabase
          .from("contracts")
          .insert([
            {
              user_id: req.user.id,
              file_name: file.originalname,
              storage_path: storageData.path,
              mime_type: file.mimetype,
              file_size: file.size,
              extracted_text: extractedText,
              status: "processed"
            }
          ])
          .select()
          .single();

      if (dbError) {

        console.error(dbError);

        return res.status(500).json({
          error: "Database insert failed"
        });

      }

      res.json({
        success: true,
        contract: contractData,
        extracted_text_preview:
          extractedText.slice(0, 1000)
      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error: "Contract upload failed"
      });

    }

  }
);

/* ===============================
   CONTRACT LIST
=============================== */

app.get(
  "/api/contracts",
  auth,
  async (req, res) => {

    try {

      const { data, error } =
        await supabase
          .from("contracts")
          .select("*")
          .order("created_at", {
            ascending: false
          });

      if (error) {
        throw error;
      }

      res.json({
        contracts: data
      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error: "Failed to fetch contracts"
      });

    }

  }
);

/* ===============================
   DECISION OS
=============================== */

app.get(
  "/api/contracts/:id/decision",
  auth,
  async (req, res) => {

    try {

      const contract =
        await getLatestContract(
          req.params.id
        );

      const [
        stressTest,
        transition
      ] =
        await Promise.all([
          generateAviationFinancialStressTest({
            contract
          }),
          generateAircraftTransition({
            contract
          })
        ]);

      const decision =
        await generateDecisionOS({
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

  }
);

/* ===============================
   START SERVER
=============================== */

const PORT =
  process.env.PORT || 4000;

app.listen(PORT, "0.0.0.0", () => {

  console.log(
    `🚀 Operion Decision OS running on port ${PORT}`
  );

});
