// day3-eval.ts
//
// 10 hand-written cases checking whether the agent reaches for the RIGHT
// tool(s) — this is a ROUTING eval, not an answer-quality eval. It checks
// "did it call the right function," not "was the final sentence good."
// Day 6 introduces the harder kind (answer-quality, citation-checking) for RAG.
//
// Run: npx tsx day3-eval.ts

import { anthropic, TOOLS } from "./index";
import Anthropic from "@anthropic-ai/sdk";

type EvalCase = {
  prompt: string;
  expectedTools: string[]; // order doesn't matter; empty array = "should need no tool"
};

const CASES: EvalCase[] = [
  { prompt: "What is 12 times 8?", expectedTools: ["calculator"] },
  { prompt: "What's the weather like in Tokyo?", expectedTools: ["get_weather"] },
  { prompt: "What does notes.txt say?", expectedTools: ["read_file"] },
  {
    prompt: "What is 100 divided by 4, and what's the weather in Rome?",
    expectedTools: ["calculator", "get_weather"],
  },
  { prompt: "What's the capital of France?", expectedTools: [] }, // stable knowledge — no tool needed
  { prompt: "Divide 10 by 0", expectedTools: ["calculator"] }, // routing still happens even though execution will error
  { prompt: "Summarize notes.txt and tell me what 5 + 5 is", expectedTools: ["read_file", "calculator"] },
  { prompt: "Is it warmer in Paris or Tokyo right now?", expectedTools: ["get_weather"] }, // 2 calls, same tool
  { prompt: "Write me a haiku about autumn", expectedTools: [] }, // creative task — no tool needed
  { prompt: "Multiply 6 and 7, then tell me what my notes say", expectedTools: ["calculator", "read_file"] },
];

// Single-turn check: which tools does Claude reach for on the FIRST response?
// Enough to test routing without running the full multi-turn loop for every case.
async function getToolCallsForPrompt(prompt: string): Promise<string[]> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    tools: TOOLS,
    messages: [{ role: "user", content: prompt }],
    thinking: {type: "disabled"}, // let Claude "think" before responding — this is the default in runAgent()
  });
  return response.content
    .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
    .map((b) => b.name);
}

function setsMatch(a: string[], b: string[]): boolean {
  const setA = new Set(a);
  const setB = new Set(b);
  return setA.size === setB.size && [...setA].every((x) => setB.has(x));
}

async function runEval() {
  let passed = 0;

  for (const { prompt, expectedTools } of CASES) {
    const actualTools = await getToolCallsForPrompt(prompt);
    const match = setsMatch(expectedTools, actualTools);

    console.log(`${match ? "✅" : "❌"} "${prompt}"`);
    console.log(
      `   expected: [${expectedTools.join(", ") || "none"}]  got: [${actualTools.join(", ") || "none"}]`
    );
    if (match) passed++;
  }

  console.log(`\n${passed}/${CASES.length} passed`);
}

runEval().catch(console.error);