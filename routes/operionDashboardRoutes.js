import express from "express";
import supabase from "../supabaseClient.js";

const router = express.Router();

/* =========================================
GET ALL AUDIT LOGS
========================================= */

router.get("/audit", async (req, res) => {
  try {
    const { company_id } = req.query;

    const query = supabase.from("contract_audit_log").select("*");

    if (company_id) {
      query.eq("company_id", company_id);
    }

    const { data, error } = await query.order("timestamp", {
      ascending: false,
    });

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/* =========================================
GET CONTRACT DECISIONS (LATEST FIRST)
========================================= */

router.get("/decisions", async (req, res) => {
  try {
    const { company_id } = req.query;

    const { data, error } = await supabase
      .from("contract_audit_log")
      .select("contract_id, output_snapshot, risk_score, timestamp")
      .order("timestamp", { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    const filtered = company_id
      ? data.filter((d) => d.company_id === company_id)
      : data;

    res.json({
      success: true,
      data: filtered,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================
RISK SUMMARY (AIRLINE VIEW)
========================================= */

router.get("/risk-summary", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("contract_audit_log")
      .select("risk_score");

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    const summary = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    data.forEach((item) => {
      if (summary[item.risk_score] !== undefined) {
        summary[item.risk_score]++;
      }
    });

    res.json({
      success: true,
      summary,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;