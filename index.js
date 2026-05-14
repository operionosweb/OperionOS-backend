import { generateNegotiationSimulation } from "./contractNegotiationSimulator.js";

/* ===============================
   NEGOTIATION SIMULATOR API
=============================== */

app.get("/api/contracts/:id/negotiation", auth, async (req, res) => {
  try {
    const contract_id = req.params.id;

    const { data: latest, error } = await supabase
      .from("contract_versions")
      .select("*")
      .eq("contract_id", contract_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !latest) {
      return res.status(404).json({
        error: "Contract not found",
      });
    }

    const simulation = await generateNegotiationSimulation({
      contract: latest,
    });

    res.json({
      contract_id,
      negotiation: simulation,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Negotiation simulation failed",
    });
  }
});
