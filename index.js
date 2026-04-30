// Get existing summary
const { data: memoryRow } = await supabase
  .from("user_memory")
  .select("*")
  .eq("user_id", userId)
  .single();

let summary = memoryRow?.summary || "";

// Build AI messages
const messagesForAI = [
  {
    role: "system",
    content: "You are Operion AI."
  }
];

if (summary) {
  messagesForAI.push({
    role: "system",
    content: "User memory: " + summary
  });
}

messagesForAI.push(...recentMessages);
