import express from "express";
import { saveContractToDB } from "../services/contractService.js";

const router = express.Router();

router.post("/save", async (req, res) => {
  try {
    const result = await saveContractToDB(req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ⚠️ IMPORTANT: default export MUST exist
export default router;
