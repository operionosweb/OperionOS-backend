import express from "express";
import { processContract } from "../contractPipeline.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const result = await processContract(req.body);

    res.json(result);
  } catch (err) {
    console.error("Contract error:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

export default router;
