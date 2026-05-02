app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    if (!message) {
      return res.status(400).json({ error: "message required" });
    }

    // 1. CREATE EMBEDDING
    const queryEmbedding = await getEmbedding(message);

    // 2. QUERY SUPABASE VECTOR MEMORY
    const { data: memories, error } = await supabase.rpc("match_memory", {
      query_embedding: queryEmbedding,
      match_user_id: user_id,
      match_count: 5,
    });

    // 3. DEBUG OUTPUT (CRITICAL)
    console.log("🔵 VECTOR SEARCH RESULT:", memories);
    console.log("🔴 VECTOR SEARCH ERROR:", error);

    // 4. RETURN RAW DEBUG RESPONSE
    return res.json({
      debug: true,
      memory_found: memories?.length || 0,
      memories: memories || [],
      error: error || null,
    });

  } catch (err) {
    console.error("FATAL ERROR:", err);

    return res.status(500).json({
      error: "server crash",
      details: err.message,
    });
  }
});
