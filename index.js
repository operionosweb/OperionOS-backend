const express = require("express");

const app = express();

// IMPORTANT: allows JSON body from your Android app
app.use(express.json());

// Health check (browser test)
app.get("/", (req, res) => {
  res.send("Operion AI Backend Running");
});

// Chat endpoint (your Android app will use this)
app.post("/chat", (req, res) => {
  const message = req.body.message;

  if (!message) {
    return res.json({
      reply: "No message received"
    });
  }

  res.json({
    reply: "You said: " + message
  });
});

// Start server (required for Render)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Operion backend running on port " + PORT);
});
