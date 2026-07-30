import Anthropic from "@anthropic-ai/sdk";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const anthropic = new Anthropic();
const messages: Anthropic.MessageParam[] = [];
type ChatMessage = { role: "user" | "assistant"; content: string }; 

function logUsage(usage: Anthropic.Usage) {
  const { input_tokens, output_tokens } = usage;
  const cost = (input_tokens / 1_000_000) * 2 + (output_tokens / 1_000_000) * 10;
  console.log(`  [${input_tokens} in / ${output_tokens} out — ~$${cost.toFixed(6)}]`);
}

async function sendMessage(message: string) {
  messages.push({ role: "user", content: message });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    messages,
    thinking: {type: "disabled" }, // optional, but recommended for better performance
    output_config: { effort: "low" } // optional, but recommended for better performance
  });

  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  messages.push({ role: "assistant", content: text });

  console.log(text);
  logUsage(response.usage);
}

async function sendPredefinedMessages(inputs: [string, string]) {
    const [question, instruction] = inputs;
    const conversation: Anthropic.MessageParam[] = [
        { role: "user", content: `${question}\n\n${instruction}` }
    ];
    const response = await anthropic.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        messages: conversation
    });
    console.log(response.content);
    logUsage(response.usage);
}


async function chatStream() {
  const rl = readline.createInterface({ input, output });
 
  // THIS is "in-memory conversation history": just a variable.
  // No file, no database. Restart the process and it's gone.
  const history: ChatMessage[] = [];
 
  console.log("Chat with Claude. Type 'exit' to quit.\n");
 
  while (true) {
    const userInput = await rl.question("You: ");
    if (userInput.trim().toLowerCase() === "exit") break;
 
    // 1. Append the user's turn BEFORE calling the API
    history.push({ role: "user", content: userInput });
 
    process.stdout.write("Claude: ");
    let assistantReply = "";
 
    // 2. Stream the response. The .stream() helper gives you an event emitter
    //    instead of making you parse raw server-sent events yourself.
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system: "You are a helpful, concise assistant.",          // <-- system prompt lives here, NOT in `messages`
      messages: history,              // <-- the FULL history, every single call
    });
 
    stream.on("text", (textDelta) => {
      process.stdout.write(textDelta); // print each chunk as it arrives
      assistantReply += textDelta;     // and accumulate it for storage
    });
 
    // Wait for the stream to finish before moving on
    await stream.finalMessage();
    process.stdout.write("\n\n");
 
    // 3. Append Claude's FULL reply to history, with role "assistant"
    //    (only after streaming completes — you need the whole thing, not fragments)
    history.push({ role: "assistant", content: assistantReply });
  }
 
  rl.close();
  console.log("Goodbye!");
}

await sendMessage("My name is PG");
await sendMessage("What is the capital of France?");
await sendMessage("What is my name?");
// await sendPredefinedMessages(["What is latin for Ant? (A) Apoidea, (B) Rhopalocera, (C) Formicidae", "The answer is ("]);
// await chatStream();