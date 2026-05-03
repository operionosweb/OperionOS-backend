app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    if (!message) {
      return res.status(400).json({ error: "message required" });
    }

    // 1. MEMORY
    const { data: memory } = await supabase
      .from("user_memory")
      .select("summary")
      .eq("user_id", user_id)
      .limit(5);

    const context = (memory || [])
      .map(m => m.summary)
      .join("\n");

    // 2. SINGLE LLM CALL (ALL AGENTS INSIDE)
    const reply = await llm(
      "You are a multi-expert AI system (aviation, finance, operations).",
      `
Context:
${context}

User:
${message}

Respond with:
1. Aviation perspective
2. Finance perspective
3. Operations perspective
4. Final combined answer
`
    );

    // 3. STORE MEMORY (non-blocking)
    supabase.from("user_memory").insert([
      { user_id, summary: message }
    ]).then(() => {}).catch(() => {});

    return res.json({
      reply
    });

  } catch (err) {
    console.error("FATAL:", err);
    return res.status(500).json({ error: err.message });
  }
});
