import express from "express";
import fs from "fs";

import { upload } from "../services/uploadService.js";

import { extractClauses }
from "../services/clauseParser.js";

import { extractObligations }
from "../services/obligationParser.js";

import { analyzeContractRisk }
from "../services/contractRiskEngine.js";

import { saveContractToDB }
from "../services/contractService.js";

const router = express.Router();

// ======================================================
// EXECUTIVE CONTRACT PIPELINE
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
      // READ FILE
      // ==================================================

      const extractedText =
        fs.readFileSync(
          req.file.path,
          "utf8"
        );

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
      // EXECUTIVE METRICS
      // ==================================================

      const executiveMetrics =
        buildExecutiveMetrics(
          clauses,
          obligations,
          risk
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

          clausesDetected:
            clauses.length,

          obligationsDetected:
            obligations.length,

          clauses,

          obligations,

          risk,

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
  risk
) {

  const highRiskClauses =
    clauses.filter(
      (c) =>
        (
          c.risk_level || ""
        ).toLowerCase() === "high"
    );

  const mediumRiskClauses =
    clauses.filter(
      (c) =>
        (
          c.risk_level || ""
        ).toLowerCase() === "medium"
    );

  const highPriorityObligations =
    obligations.filter(
      (o) =>
        (
          o.priority || ""
        ).toLowerCase() === "high"
    );

  // ==================================================
  // HEALTH SCORE
  // ==================================================

  const contractHealthScore =
    Math.max(
      0,
      100 -
      (
        risk.contract_risk_score || 0
      )
    );

  // ==================================================
  // EXECUTIVE STATUS
  // ==================================================

  let executiveStatus =
    "Healthy";

  if (
    contractHealthScore < 70
  ) {

    executiveStatus =
      "Monitor";
  }

  if (
    contractHealthScore < 40
  ) {

    executiveStatus =
      "Critical";
  }

  // ==================================================
  // FINANCIAL EXPOSURE LEVEL
  // ==================================================

  let financialExposure =
    "Low";

  if (
    risk.critical_flags?.includes(
      "uncapped_liability"
    )
  ) {

    financialExposure =
      "Critical";
  }
  else if (
    risk.contract_risk_score > 60
  ) {

    financialExposure =
      "High";
  }

  // ==================================================
  // OPERATIONAL BURDEN
  // ==================================================

  let operationalBurden =
    "Low";

  if (
    obligations.length > 10
  ) {

    operationalBurden =
      "Medium";
  }

  if (
    obligations.length > 20
  ) {

    operationalBurden =
      "High";
  }

  // ==================================================
  // EXECUTIVE SUMMARY
  // ==================================================

  return {

    contract_health_score:
      contractHealthScore,

    executive_status:
      executiveStatus,

    financial_exposure_level:
      financialExposure,

    operational_burden:
      operationalBurden,

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
        risk.missing_protections
          ?.length || 0
    }
  };
}

export default router;
