// index.js

const express = require("express");
const app = express();

// Middleware
app.use(express.json());

// Root route (browser test)
app.get("/", (req, res) => {
  res.send("Operion AI Backend Running");
});

// ✅ CLEAN TEST ENDPOINT
app.post("/test3", (req, res) => {
  res.json({
    ok: true,
    message: "test3 endpoint works ✅",
    received: req.body
  });
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
