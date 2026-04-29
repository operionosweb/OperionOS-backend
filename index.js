const express = require("express");

const app = express();

// MUST be here or req.body will be empty
app.use(express.json());

// Health check route
app.get("/", (req, res) => {
  res.send("Operion AI Backend Running");
});

// CHAT ROUTE (POST ONLY)
app.post("/chat", (req, res) => {
  const message = req.body.message;

  console.log("Received message:", message);

  if (!message) {
    return res.json({
      reply: "No message received"
    });
  }

  res.json({
    reply: "You said: " + message
  });
});

// Start server (Render requires this)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
