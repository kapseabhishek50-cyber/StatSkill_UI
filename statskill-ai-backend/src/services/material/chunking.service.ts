export interface TextChunk {
  index: number;
  text: string;
}

/**
 * Simple paragraph-aware chunker with overlap (prompt §23). Keeps chunks
 * inside the LLM-friendly size window while preserving context between
 * neighbouring chunks.
 */
export const chunkText = (
  text: string,
  opts: { maxChars?: number; overlapChars?: number } = {}
): TextChunk[] => {
  const maxChars = opts.maxChars ?? 1200;
  const overlapChars = opts.overlapChars ?? 150;
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [{ index: 0, text: clean }];

  // Split on paragraph boundaries first.
  const paragraphs = clean.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > maxChars && current) {
      chunks.push(current.trim());
      // Start next chunk with the tail of the previous for continuity.
      current = current.slice(-overlapChars) + '\n\n' + para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
    // A single huge paragraph: hard-split it.
    while (current.length > maxChars) {
      chunks.push(current.slice(0, maxChars).trim());
      current = current.slice(maxChars - overlapChars);
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.map((text, index) => ({ index, text }));
};
