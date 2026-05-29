import express from "express";

const router = express.Router();

router.get(
  "/dashboard",
  async (req, res) => {
    return res.status(200).json({
      success: true,
      message: "Welcome Super Admin",
      user: req.user,
    });
  }
);

router.get(
  "/health",
  async (req, res) => {
    return res.status(200).json({
      success: true,
      admin_system: "operational",
      timestamp: new Date().toISOString(),
    });
  }
);

export default router;
