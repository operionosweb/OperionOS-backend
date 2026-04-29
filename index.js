const express = require("express");
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Operion AI Backend Running");
});

app.post("/chat", (req, res) => {
  const message = req.body.message;

  res.json({
    reply: "You said: " + message
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
