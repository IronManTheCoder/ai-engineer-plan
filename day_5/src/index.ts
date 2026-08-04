// day5-semantic-search.ts
//
// Semantic search over your own markdown notes — no framework, embedded
// LanceDB (no server to run), Voyage AI for embeddings.
//
// Setup:
//   npm install @lancedb/lancedb
//   export VOYAGE_API_KEY=pa-...   (sign up at voyageai.com — free tier exists)
//   Put your own .md files in ./notes, or use the three sample ones provided.
//
// Usage:
//   npx tsx day5-semantic-search.ts index
//   npx tsx day5-semantic-search.ts search "what did I decide about the billing migration"

import * as lancedb from "@lancedb/lancedb";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const NOTES_DIR = path.resolve("./notes");
const DB_DIR = path.resolve("./data/notes-lancedb");

// input_type matters: Voyage tunes "document" and "query" embeddings
// differently even for the same model — always set it correctly for which
// side of the search you're embedding.
async function embed(texts: string[], inputType: "document" | "query"): Promise<number[][]> {
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: texts,
      model: "voyage-3.5",
      input_type: inputType,
    }),
  });
  if (!response.ok) {
    throw new Error(`Voyage API error: ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  return data.data.map((d: any) => d.embedding);
}

// LanceDB computes distance internally — this exists purely so you see the
// actual formula once. dot product of two vectors, divided by the product of
// their magnitudes. 1.0 = identical direction, 0 = unrelated, -1 = opposite.
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

type NoteRow = { id: string; text: string; source: string; vector: number[] };

async function loadAndChunkNotes(): Promise<{ text: string; source: string }[]> {
  const files = await fs.readdir(NOTES_DIR);
  const chunks: { text: string; source: string }[] = [];
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const content = await fs.readFile(path.join(NOTES_DIR, file), "utf-8");
    // Naive chunking on purpose: split on blank lines. Day 6 replaces this
    // with a real chunking strategy — don't over-engineer it today.
    const paragraphs = content
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    for (const p of paragraphs) chunks.push({ text: p, source: file });
  }
  return chunks;
}

async function buildIndex() {
  const rawChunks = await loadAndChunkNotes();
  console.log(`Loaded ${rawChunks.length} chunks from ${NOTES_DIR}`);

  const vectors = await embed(rawChunks.map((c) => c.text), "document");

  const rows: NoteRow[] = rawChunks.map((c, i) => ({
    id: `chunk-${i}`,
    text: c.text,
    source: c.source,
    vector: vectors[i],
  }));

  const db = await lancedb.connect(DB_DIR);
  await db.createTable("notes", rows, { mode: "overwrite" });
  console.log(`Indexed ${rows.length} chunks into LanceDB at ${DB_DIR}`);
}

async function search(query: string, topK = 3) {
  const db = await lancedb.connect(DB_DIR);
  const table = await db.openTable("notes");

  const [queryVector] = await embed([query], "query");
  const results = await table.vectorSearch(queryVector).limit(topK).toArray();

  console.log(`\nQuery: "${query}"\n`);
  for (const r of results) {
    // _distance is LanceDB's default (L2). Voyage embeddings are unit-normalized,
    // so L2 and cosine ranking agree in practice — fine for this exercise.
    console.log(`[${r.source}]  (distance: ${r._distance.toFixed(4)})`);
    console.log(`  ${r.text}\n`);
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === "index") {
    await buildIndex();
  } else if (command === "search") {
    const query = rest.join(" ");
    if (!query) throw new Error('Usage: npx tsx day5-semantic-search.ts search "your query"');
    await search(query);
  } else {
    console.log(
      'Usage:\n  npx tsx day5-semantic-search.ts index\n  npx tsx day5-semantic-search.ts search "your query"'
    );
  }
}

main().catch(console.error);