import express from "express";
import { processContract } from "../contractPipeline.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const contract = req.body;

    const result = await processContract(contract);

    res.json(result);
  } catch (err) {
    console.error("Contract route error:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

export default router;
