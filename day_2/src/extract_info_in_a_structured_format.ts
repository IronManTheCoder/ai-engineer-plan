import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const MODEL = "claude-sonnet-5";

async function extract_info_in_a_structured_format() {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content:
          "Extract the key information from this email: John Smith (john@example.com) is interested in our Enterprise plan and wants to schedule a demo for next Tuesday at 2pm.",
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string" },
            plan_interest: { type: "string" },
            demo_requested: { type: "boolean" },
          },
          required: ["name", "email", "plan_interest", "demo_requested"],
          additionalProperties: false,
        },
      },
    },
  });

  for (const block of response.content) {
    if (block.type === "text") {
      console.log(block.text);
    }
  }
}

extract_info_in_a_structured_format().catch((error) => {
    console.error("Error extracting information:", error);
});
