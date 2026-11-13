function plainUnformattedParagraph(node) {
  if (node?.type !== "paragraph" || !Array.isArray(node.content)) return null;
  if (node.content.some(child => child.type !== "text" || child.marks?.length)) return null;
  return node.content.map(child => child.text || "").join("");
}

export function applyParagraphSuggestion(content, originalText, suggestedText) {
  if (!Array.isArray(content) || !originalText || !suggestedText) return { content, applied: false };
  let matches = 0;
  function replaceNode(node) {
    if (!node || typeof node !== "object") return node;
    if (node.type === "paragraph" && node.text === originalText) {
      matches += 1;
      return { ...node, text: suggestedText };
    }
    if (node.type === "paragraph" && plainUnformattedParagraph(node) === originalText) {
      matches += 1;
      return { ...node, content: [{ type: "text", text: suggestedText }] };
    }
    return Array.isArray(node.content)
      ? { ...node, content: node.content.map(replaceNode) }
      : node;
  }
  const updated = content.map(replaceNode);
  return matches === 1 ? { content: updated, applied: true } : { content, applied: false };
}
