import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const anthropic = new Anthropic();

const SYSTEM_PROMPT =
  "You are skilled at extracting structured information from resumes. When you are " +
  "unsure about a particular data point, flag it as uncertain (using the field's null " +
  "option, where available) rather than making up a value.";

// 1. The schema is the contract. Every .describe() is read by the model as an
//    instruction, not documentation for humans — so it has to be unambiguous,
//    not just non-empty.
const ResumeSchema = z.object({
  name: z.string().describe("Full name of the candidate"),
  email: z.string().describe("Contact email; empty string if not present in the text"),
  yearsOfExperience: z.number().nullable().describe(
    "Total years of professional experience, calculated as the sum of individual role " +
    "durations (not counting gaps between roles). Order roles by actual date, not by " +
    "the order they're listed in. Return 0 if the resume lists roles but they sum to " +
    "zero years. Return null if the resume doesn't contain enough dated work history " +
    "to calculate this with confidence — do not guess."
  ),
  skills: z.array(z.string()).describe("Technical skills explicitly mentioned"),
  workHistory: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      startYear: z.number(),
      endYear: z.number().nullable().describe("null if this is the current role"),
    })
  ),
});

type Resume = z.infer<typeof ResumeSchema>;

// 2. Four resumes chosen specifically to break a naive prompt, not to flatter it.
const TEST_RESUMES: Record<string, string> = {
  "Clean, contiguous experience": `
PG Sharma
pg@example.com
Staff Engineer, Acme Corp (2022 - Present)
Software Engineer, Globex Inc (2019 - 2022)
Skills: TypeScript, Kubernetes, PostgreSQL, gRPC
`,

  // Different companies and years than the few-shot examples below, on purpose —
  // if the model only pattern-matched the example text, this exposes it.
  "Reordered listing with a real employment gap": `
Jamie Chen
jamie@example.com
Product Engineer, Initech (2023 - Present)
Backend Developer, Umbrella Corp (2020 - 2021)
Skills: Go, React, AWS
`,

  // A confident, correct ZERO — not the same thing as "unknown."
  "New grad, single zero-length internship": `
Sam Okafor
sam@example.com
Summer Intern, DataCorp (2025 - 2025)
Skills: Python, SQL
`,

  // No dates anywhere — this should trigger null, not a guess.
  "No dated work history at all": `
Riley Novak
riley@example.com
Experienced backend engineer with a background in distributed systems and cloud infrastructure.
Skills: Go, Kubernetes, AWS, PostgreSQL
`,
};

async function parseResume(rawText: string): Promise<Resume | null> {
  const today = new Date().toISOString().slice(0, 10);

  const message = await anthropic.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `<resume>
${rawText}
</resume>

Extract structured data from this resume. Today's date is ${today}.

<examples>
<example>
<input>Staff Engineer, Acme Corp (2022 - Present), Software Engineer, Globex Inc (2019 - 2022)</input>
<output>{"yearsOfExperience": 7}</output>
</example>
<example>
<input>Software Engineer, Globex Inc (2019 - 2020), Staff Engineer, Acme Corp (2022 - Present)</input>
<output>{"yearsOfExperience": 5}</output>
</example>
</examples>`,
      },
    ],
    output_config: {
      format: zodOutputFormat(ResumeSchema),
    },
  });

  // Level 1 null: total failure. Nothing usable came back at all.
  if (message.stop_reason === "refusal") {
    console.warn("Claude refused this request — no valid structured output.");
    return null;
  }
  if (message.stop_reason === "max_tokens") {
    console.warn("Response was cut off — raise max_tokens and retry.");
    return null;
  }

  logUsage(message.usage);
  return message.parsed_output;
}

function logUsage(usage: Anthropic.Usage) {
  const { input_tokens, output_tokens } = usage;
  const cost = (input_tokens / 1_000_000) * 2 + (output_tokens / 1_000_000) * 10;
  console.log(`  [${input_tokens} in / ${output_tokens} out — ~$${cost.toFixed(6)}]`);
}

async function main() {
  for (const [label, rawText] of Object.entries(TEST_RESUMES)) {
    console.log(`\n=== ${label} ===`);
    const resume = await parseResume(rawText);

    if (resume === null) {
      console.log("Could not parse this resume — no output to show.");
      continue;
    }

    console.log(JSON.stringify(resume, null, 2));

    // Level 2 null: we HAVE a resume, but this one field is flagged uncertain.
    if (resume.yearsOfExperience === null) {
      console.warn("⚠️  yearsOfExperience uncertain — routing for human review.");
    }
  }
}

main().catch(console.error);