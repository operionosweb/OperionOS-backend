import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    status: "healthy",
    service: "operion-backend",
    timestamp: new Date().toISOString()
  });
});

export default router;
