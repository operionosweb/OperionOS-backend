import express from "express";
import supabase from "../supabaseClient.js";
import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { requireOrganizationMembership } from "../middleware/organizationMiddleware.js";
import { requireOrganizationPermission } from "../middleware/authorizationMiddleware.js";

const router = express.Router();

router.use(
  authenticateUser,
  requireOrganizationMembership,
  requireOrganizationPermission("audit:read")
);

/* =========================================
GET ALL AUDIT LOGS
========================================= */

router.get("/audit", async (req, res) => {
  try {
    const query = supabase
      .from("contract_audit_log")
      .select("*")
      .eq("org_id", req.organization.id);

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
    const { data, error } = await supabase
      .from("contract_audit_log")
      .select("contract_id, output_snapshot, risk_score, timestamp")
      .eq("org_id", req.organization.id)
      .order("timestamp", { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      data,
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
      .select("risk_score")
      .eq("org_id", req.organization.id);

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