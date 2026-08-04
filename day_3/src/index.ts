// day3-tool-agent.ts
//
// Hand-rolled tool-use loop — no framework, no Tool Runner SDK.
// The point is to feel every round trip yourself: request -> tool_use ->
// tool_result -> request. Week 2's Vercel AI SDK / Mastra replace this loop;
// Anthropic's own Tool Runner SDK can also automate it (see the note at the
// bottom) — but you should build it by hand at least once first.
//
// Setup:
//   npm install @anthropic-ai/sdk
//   mkdir docs && echo "Q3 revenue was up 12% YoY." > docs/notes.txt
//   npx tsx day3-tool-agent.ts

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export const anthropic = new Anthropic();
const SANDBOX_DIR = path.resolve("../day_3/docs"); // read_file can ONLY ever reach inside here

// ---------- 1. Define tools ----------
// strict: true compiles input_schema into a grammar (same pipeline as Day 2's
// structured outputs) — Claude's arguments are GUARANTEED to match this shape,
// not just validated after the fact.
export const TOOLS: Anthropic.Tool[] = [
  {
    name: "calculator",
    description: "Perform a single arithmetic operation on two numbers.",
    input_schema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["add", "subtract", "multiply", "divide"] },
        a: { type: "number" },
        b: { type: "number" },
      },
      required: ["operation", "a", "b"],
      additionalProperties: false,
    },
    strict: true,
  } as Anthropic.Tool,
  {
    name: "get_weather",
    description: "Get the current weather for a city. Mocked for this exercise.",
    input_schema: {
      type: "object",
      properties: {
        location: { type: "string", description: "City name, e.g. 'Paris'" },
      },
      required: ["location"],
      additionalProperties: false,
    },
    strict: true,
  } as Anthropic.Tool,
  {
    name: "read_file",
    description: "Read a text file by filename from the local notes sandbox.",
    input_schema: {
      type: "object",
      properties: {
        filename: { type: "string", description: "Filename only, e.g. 'notes.txt' — no paths" },
      },
      required: ["filename"],
      additionalProperties: false,
    },
    strict: true,
  } as Anthropic.Tool,
];

// ---------- 2. Execute tools ----------
// This is YOUR code. Claude never runs anything — it only ever asks.
export async function executeTool(
  name: string,
  input: any
): Promise<{ result: string; isError: boolean }> {
  try {
    switch (name) {
      case "calculator": {
        const { operation, a, b } = input;
        if (operation === "divide" && b === 0) {
          return { result: "Error: division by zero", isError: true };
        }
        const ops: Record<string, number> = {
          add: a + b,
          subtract: a - b,
          multiply: a * b,
          divide: a / b,
        };
        return { result: String(ops[operation]), isError: false };
      }
      case "get_weather": {
        return { result: `${input.location}: 18°C, partly cloudy.`, isError: false };
      }
      case "read_file": {
        // Guard against path traversal (e.g. "../../.env") — never trust a
        // model-provided path blindly, even from your own tool.
        const safePath = path.join(SANDBOX_DIR, path.basename(input.filename));
        console.log(`  [reading file: ${safePath}]`);
        const content = await fs.readFile(safePath, "utf-8");
        return { result: content, isError: false };
      }
      default:
        return { result: `Unknown tool: ${name}`, isError: true };
    }
  } catch (err) {
    return { result: `Tool execution failed: ${(err as Error).message}`, isError: true };
  }
}

function logUsage(usage: Anthropic.Usage): number {
  const { input_tokens, output_tokens } = usage;
  const cost = (input_tokens / 1_000_000) * 2 + (output_tokens / 1_000_000) * 10;
  console.log(`  [${input_tokens} in / ${output_tokens} out — ~$${cost.toFixed(6)}]`);
  return cost;
}

// ---------- 3. The hand-rolled agentic loop ----------
export async function runAgent(userMessage: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];
  let totalCost = 0;

  while (true) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      tools: TOOLS,
      messages,
      thinking: { type: "disabled" }, // optional, but recommended for better performance
    });

    totalCost += logUsage(response.usage);

    // Push Claude's FULL response — every content block, not just text —
    // back into history. Losing a tool_use block here breaks the next turn.
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      // Loop exits here on: end_turn, max_tokens, stop_sequence, or refusal.
      const finalText = response.content.find((b) => b.type === "text");
      console.log(`  [conversation total: ~$${totalCost.toFixed(6)}]`);
      return finalText && finalText.type === "text" ? finalText.text : "(no text response)";
    }

    // Handle EVERY tool_use block in this turn — Claude can call several
    // tools in parallel in a single response.
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        console.log(`  -> calling ${block.name}(${JSON.stringify(block.input)})`);
        const { result, isError } = await executeTool(block.name, block.input);
        return {
          type: "tool_result" as const,
          tool_use_id: block.id,
          content: result,
          is_error: isError,
        };
      })
    );

    // Tool results go back as a USER turn, not assistant — this trips
    // people up the first time. Claude "speaks," you "speak back" the results.
    messages.push({ role: "user", content: toolResults });
  }
}

// ---------- 4. Run it ----------
async function main() {
//   const answer = await runAgent(
//     "What's 84 divided by 7? Also, what's the weather in Paris, and what do my notes say about Q3?"
//   );
//   const answer = await runAgent(
//     "What's 84 divided by 7? Also, add 10 to that"
//   );
    // const answer = await runAgent(
    // "What's 84 divided by 7? Also, add 10 to that result"
    // );
    const answer = await runAgent(
    "Is it warmer in Paris or Tokyo right now?"
    );
  console.log(`\n[conversation total: ~$${answer}]`);
  console.log("\nFinal answer:\n" + answer);
}

// Only auto-run when this file is executed directly, not when imported by the eval script.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}