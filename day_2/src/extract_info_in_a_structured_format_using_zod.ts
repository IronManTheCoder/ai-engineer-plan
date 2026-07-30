import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const client = new Anthropic();
const MODEL = "claude-sonnet-5";

const ContactInfoSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  plan_interest: z.string(),
  demo_requested: z.boolean(),
});

async function extract_info_in_a_structured_format() {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content:
          "Extract the key information from this email: John Smith (john@example.com) is interested in our Enterprise plan and wants to schedule a demo for next Tuesday at 2pm.",
      },
    ],
    output_config: { format: zodOutputFormat(ContactInfoSchema) }
  });

  console.log("Extracted Information:", response.parsed_output);
}

extract_info_in_a_structured_format().catch((error) => {
    console.error("Error extracting information:", error);
});
