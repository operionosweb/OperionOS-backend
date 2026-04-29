import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Operion AI Backend Running");
});

app.post("/ai/chat", async (req, res) => {
  const { message } = req.body;

  // TEMP response (we'll upgrade later)
  res.json({
    reply: `Operion AI received: ${message}`
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});