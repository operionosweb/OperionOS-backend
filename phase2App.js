import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import contractRoutes from "./routes/contractRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import analysisRunRoutes from "./routes/analysisRunRoutes.js";
import { tenantContext } from "./middleware/tenantContext.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(tenantContext);

app.use("/api/contracts", contractRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/analysis-runs", analysisRunRoutes);

export { app };