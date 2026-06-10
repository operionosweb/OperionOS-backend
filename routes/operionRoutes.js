const express = require("express");
const router = express.Router();

const operionOrchestrator = require("../services/operionOrchestrator");

router.post("/analyze-contract", async (req, res) => {
  try {
    const result = await operionOrchestrator.analyzeContract(req.body);

    res.json({
      success: true,
      data: result
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: "Contract analysis failed"
    });
  }
});

module.exports = router;
