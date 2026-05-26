import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/* ======================================================
   ROUTES
====================================================== */

import healthRoutes from "./routes/healthRoutes.js";
import contractRoutes from "./routes/contractRoutes.js";
import blogRoutes from "./routes/blogRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import mediaRoutes from "./routes/mediaRoutes.js";
import providerRoutes from "./routes/providerRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";

/* ======================================================
   APP INIT
====================================================== */

const app = express();

/* ======================================================
   SECURITY + PERFORMANCE BASELINE
====================================================== */

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({
  limit: "50mb"
}));

app.use(express.urlencoded({
  extended: true,
  limit: "50mb"
}));

/* ======================================================
   SAFE FILE SYSTEM INIT
====================================================== */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, "uploads");

try {

  if (!fs.existsSync(uploadsDir)) {

    fs.mkdirSync(uploadsDir, {
      recursive: true
    });

    console.log("✅ uploads folder created");

  } else {

    console.log("✅ uploads folder exists");
  }

} catch (err) {

  console.error(
    "❌ Uploads folder init failed:",
    err
  );
}

/* ======================================================
   ROOT
====================================================== */

app.get("/", (req, res) => {

  res.json({
    status: "alive",
    service: "OperionOS Backend",
    timestamp: new Date().toISOString()
  });

});

/* ======================================================
   ROUTES
====================================================== */

app.use("/health", healthRoutes);

app.use("/api/contracts", contractRoutes);

app.use("/api/blog", blogRoutes);

app.use("/api/auth", authRoutes);

app.use("/api/media", mediaRoutes);

app.use("/api/providers", providerRoutes);

app.use("/api/search", searchRoutes);

/* ======================================================
   404 HANDLER
====================================================== */

app.use((req, res) => {

  res.status(404).json({
    success: false,
    error: "Route not found"
  });

});

/* ======================================================
   GLOBAL ERROR HANDLER
====================================================== */

app.use((err, req, res, next) => {

  console.error("❌ Global error:", err);

  res.status(500).json({
    success: false,
    error: "Internal server error"
  });

});

/* ======================================================
   SERVER START
====================================================== */

const PORT = process.env.PORT;

if (!PORT) {

  console.error(
    "❌ PORT missing"
  );

  process.exit(1);
}

const server = app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `🚀 OperionOS running on port ${PORT}`
    );

    console.log(
      `🟢 Environment: ${
        process.env.NODE_ENV ||
        "development"
      }`
    );
  }
);

/* ======================================================
   GRACEFUL SHUTDOWN
====================================================== */

process.on("SIGTERM", () => {

  console.log(
    "⚠️ SIGTERM received"
  );

  server.close(() => {

    console.log("✅ Server closed");

    process.exit(0);
  });
});

process.on("SIGINT", () => {

  console.log(
    "⚠️ SIGINT received"
  );

  server.close(() => {

    console.log("✅ Server closed");

    process.exit(0);
  });
});
