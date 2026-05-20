import express from "express";
import cors from "cors";

import healthRoutes from "./routes/healthRoutes.js";
import contractRoutes from "./routes/contractRoutes.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.get("/", (req, res) => {
  res.json({ status: "alive" });
});

app.use("/health", healthRoutes);
app.use("/api/contracts", contractRoutes);

const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on", PORT);
});
