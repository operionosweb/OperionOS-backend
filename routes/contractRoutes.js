import express from "express";
import fs from "fs";
import pdf from "pdf-parse";

import { upload } from "../services/uploadService.js";

import { extractClauses }
from "../services/clauseParser.js";

import { extractObligations }
from "../services/obligationParser.js";

import { analyzeContractRisk }
from "../services/contractRiskEngine.js";

import { benchmarkContract }
from "../services/benchmarkEngine.js";

import { saveContractToDB }
from "../services/contractService.js";

const router = express.Router();

// ======================================================
// CONTRACT UPLOAD PIPELINE
// ======================================================

router.post(
  "/upload",
  upload.single("file"),
  async (req, res) => {

    try {

      // ==================================================
      // VALIDATION
      // ==================================================

      if (!req.file) {

        return res.status(400).json({
          success: false,
          error: "No file uploaded"
        });
      }

      // ==================================================
      // LOAD FILE BUFFER
      // ==================================================

      const fileBuffer =
        fs.readFileSync(
          req.file.path
        );

      // ==================================================
      // PDF TEXT EXTRACTION
      // ==================================================

      let extractedText = "";

      try {

        const parsed =
          await pdf(fileBuffer);

        extractedText =
          parsed.text || "";

      } catch (pdfError) {

        console.error(
          "PDF PARSE ERROR:",
          pdfError
        );

        return res.status(500).json({

          success: false,

          error:
            "Failed to parse PDF"
        });
      }

      // ==================================================
      // SAFETY VALIDATION
      // ==================================================

      if (
        !extractedText ||
        extractedText.length < 100
      ) {

        return res.status(400).json({

          success: false,

          error:
            "No readable text found in PDF"
        });
      }

      // ==================================================
      // CLAUSE EXTRACTION
      // ==================================================

      const clauses =
        await extractClauses(
          extractedText
        );

      // ==================================================
      // OBLIGATION EXTRACTION
      // ==================================================

      const obligations =
        await extractObligations(
          clauses
        );

      // ==================================================
      // RISK ENGINE
      // ==================================================

      const risk =
        await analyzeContractRisk(
          clauses,
          obligations
        );

      // ==================================================
      // BENCHMARK ENGINE
      // ==================================================

      const benchmark =
        benchmarkContract(
          clauses,
          obligations
        );

      // ==================================================
      // EXECUTIVE METRICS
      // ==================================================

      const executiveMetrics =
        buildExecutiveMetrics(
          clauses,
          obligations,
          risk,
          benchmark
        );

      // ==================================================
      // FINAL PAYLOAD
      // ==================================================

      const finalPayload = {

        filename:
          req.file.originalname,

        extracted_text:
          extractedText,

        clauses,

        obligations,

        risk,

        benchmark,

        executive_metrics:
          executiveMetrics
      };

      // ==================================================
      // DATABASE SAVE
      // ==================================================

      const database =
        await saveContractToDB(
          finalPayload
        );

      // ==================================================
      // RESPONSE
      // ==================================================

      return res.json({

        success: true,

        extraction: {

          filename:
            req.file.originalname,

          extractedTextPreview:
            extractedText.slice(0, 1500),

          clausesDetected:
            clauses.length,

          obligationsDetected:
            obligations.length,

          clauses,

          obligations,

          risk,

          benchmark,

          executive_metrics:
            executiveMetrics
        },

        database
      });

    } catch (err) {

      console.error(
        "UPLOAD PIPELINE ERROR:",
        err
      );

      return res.status(500).json({

        success: false,

        error:
          err.message
      });
    }
  }
);

// ======================================================
// EXECUTIVE METRICS ENGINE
// ======================================================

function buildExecutiveMetrics(
  clauses,
  obligations,
  risk,
  benchmark
) {

  const highRiskClauses =
    clauses.filter(
      (c) =>
        (
          c.risk_level || ""
        ).toUpperCase() === "HIGH"
    );

  const mediumRiskClauses =
    clauses.filter(
      (c) =>
        (
          c.risk_level || ""
        ).toUpperCase() === "MEDIUM"
    );

  const highPriorityObligations =
    obligations.filter(
      (o) =>
        (
          o.priority || ""
        ).toUpperCase() === "HIGH"
    );

  const contractHealthScore =
    Math.max(
      0,
      100 -
      (
        risk.contract_risk_score || 0
      )
    );

  let executiveStatus =
    "HEALTHY";

  if (
    contractHealthScore < 70
  ) {

    executiveStatus =
      "MONITOR";
  }

  if (
    contractHealthScore < 40
  ) {

    executiveStatus =
      "CRITICAL";
  }

  let financialExposure =
    "LOW";

  if (
    risk.critical_flags?.includes(
      "uncapped_liability"
    )
  ) {

    financialExposure =
      "CRITICAL";
  }
  else if (
    risk.contract_risk_score > 60
  ) {

    financialExposure =
      "HIGH";
  }

  let operationalBurden =
    "LOW";

  if (
    obligations.length > 10
  ) {

    operationalBurden =
      "MEDIUM";
  }

  if (
    obligations.length > 20
  ) {

    operationalBurden =
      "HIGH";
  }

  return {

    contract_health_score:
      contractHealthScore,

    executive_status:
      executiveStatus,

    financial_exposure_level:
      financialExposure,

    operational_burden:
      operationalBurden,

    benchmark_score:
      benchmark.benchmark_score,

    contract_maturity:
      benchmark.contract_maturity,

    clause_metrics: {

      total_clauses:
        clauses.length,

      high_risk_clauses:
        highRiskClauses.length,

      medium_risk_clauses:
        mediumRiskClauses.length
    },

    obligation_metrics: {

      total_obligations:
        obligations.length,

      high_priority_obligations:
        highPriorityObligations.length
    },

    executive_snapshot: {

      primary_risk:
        risk.risks?.[0]?.issue ||
        "No major risk detected",

      top_recommendation:
        risk.executive_summary
          ?.recommended_actions?.[0] ||
        "No recommendation",

      missing_protection_count:
        benchmark.missing_protections
          ?.length || 0
    }
  };
}

export default router;
