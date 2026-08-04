// day4-reflection-agent.ts
//
// Evaluator-Optimizer pattern (Anthropic's "Building Effective Agents"):
// one LLM call generates a response, a SEPARATE call critiques it, and the
// loop retries with that feedback until the evaluator is satisfied or a
// retry cap is hit. This is the formal name behind "reflection/self-critique."
//
// Built ON TOP of day3-tool-agent.ts — nothing there changes. TOOLS,
// executeTool, and the base client are reused, not duplicated.
//
// Setup:
//   npm install @anthropic-ai/sdk zod
//   npx tsx day4-reflection-agent.ts

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { anthropic, TOOLS, executeTool } from "../../day_3/src/index.js";

// The evaluator's verdict is itself a structured output (Day 2) — a clean
// shape to branch on, instead of parsing free-form critique text.
const EvaluationSchema = z.object({
  satisfactory: z.boolean().describe(
    "true only if the answer fully and correctly addresses EVERY part of the " +
    "original question using the actual tool results returned — not just if " +
    "it sounds confident or well-written"
  ),
  feedback: z.string().describe(
    "If not satisfactory: a specific, actionable note on exactly what part of " +
    "the question was missed or answered wrong. Empty string if satisfactory."
  ),
});

async function evaluateAnswer(question: string, answer: string) {
  console.log(`  [evaluating answer: ${question} -> ${answer}]`);
  const message = await anthropic.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 512,
    system:
      "You are a strict reviewer, not the assistant who wrote this answer. Check that " +
      "every part of the question was actually addressed. Be skeptical of confident-" +
      "sounding answers that quietly skip part of a multi-part question.",
    messages: [
      {
        role: "user",
        content: `<question>${question}</question>\n<answer>${answer}</answer>\n\nDoes this answer fully and correctly address the question?`,
      },
    ],
    output_config: { format: zodOutputFormat(EvaluationSchema) },
  });
  // Fail OPEN, not closed: if the evaluator call itself errors, don't loop forever
  // on an answer we never actually got to judge.
  return message.parsed_output ?? { satisfactory: true, feedback: "" };
}

// One pass of Day 3's tool loop, but taking/mutating an EXISTING messages
// array rather than always starting fresh — needed so a revision request can
// be appended to the same conversation instead of starting the loop over.
async function runToolLoop(messages: Anthropic.MessageParam[]): Promise<string> {
  while (true) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      tools: TOOLS,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      const finalText = response.content.find((b) => b.type === "text");
      return finalText && finalText.type === "text" ? finalText.text : "(no text response)";
    }

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
    messages.push({ role: "user", content: toolResults });
  }
}

export async function runAgentWithReflection(
  userMessage: string,
  maxRetries = 2
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];
  let attempt = 0;

  while (true) {
    const answer = await runToolLoop(messages);
    const evaluation = await evaluateAnswer(userMessage, answer);

    console.log(
      `  [attempt ${attempt + 1}] evaluator: ${evaluation.satisfactory ? "✅ satisfactory" : "❌ needs revision"}`
    );

    if (evaluation.satisfactory || attempt >= maxRetries) {
      return answer;
    }

    console.log(`  [feedback: ${evaluation.feedback}]`);
    messages.push({
      role: "user",
      content: `Your previous answer had an issue: ${evaluation.feedback}\n\nPlease revise your answer, using tools again if needed.`,
    });
    attempt++;
  }
}

async function main() {
  const answer = await runAgentWithReflection(
    "What's 84 divided by 7? Also, what's the weather in Paris, and what do my notes say about Q3?"
  );
  console.log("\nFinal answer:\n" + answer);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}