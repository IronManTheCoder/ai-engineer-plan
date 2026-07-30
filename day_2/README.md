# Day 2 — Structured Outputs & Prompt Engineering

**Build:** A resume/invoice parser that emits strict, schema-validated JSON.

## Note on plan revision

The original Day 2 plan leaned on the old workaround for typed JSON: forcing a shape by defining a fake tool and setting `tool_choice`. Anthropic has since shipped a native **Structured Outputs** feature — a proper first-class API capability, generally available on Claude 4.5+ models (Sonnet 5 qualifies) — including a TypeScript helper that plugs directly into Zod. That's what today builds with instead.

---

## Reading block (~1 hr)

- [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — replaces the old tool-forcing hack
- [Prompt engineering overview and best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview) — still needed today, for a reason explained below

## Planning block (~30 min)

- Pick **resume or invoice** as today's target (do one well rather than both half-done) and sketch the Zod schema for the fields you actually want back.
- Write down 2–3 test inputs on purpose:
  1. One clean input
  2. One with a missing field (no email listed)
  3. One messy/inconsistently formatted input

  You'll need these to test something structured outputs doesn't solve.

## Build block (~3 hrs)

1. Install a recent SDK version — you need it for the helpers/zod module:
   ```
   npm install @anthropic-ai/sdk@latest zod
   ```
2. Define your Zod schema, then use `client.messages.parse()` with `output_config: { format: zodOutputFormat(schema) }` to get a typed, validated object back directly — no more `JSON.parse()` and hoping.
3. Handle the two stop reasons that mean the schema guarantee didn't hold: `"refusal"` and `"max_tokens"` — structured outputs guarantees shape, not that Claude actually answered.
4. Wire in your Day 1 `logUsage` function. Worth knowing before you do: using structured outputs makes Claude receive an additional injected system prompt explaining the format, so your input token count will tick up slightly versus yesterday's plain calls. Good, since you're already tracking this.

## Debug/extend block (~45 min)

- Run it against your clean sample first, confirm the shape is right, then swap in your messy and missing-field test inputs.
- Watch what happens to the email field when it's genuinely absent from the text — does it return `""` like the schema asks, or does it fabricate a plausible-looking one? This is the important thing structured outputs doesn't solve: it guarantees valid shape, not correct content. That's exactly why today's prompt-engineering reading still matters — a schema stops Claude from returning malformed JSON, but only good prompting stops it from confidently inventing a `yearsOfExperience` number when the resume doesn't state one.
- Try improving accuracy on the messy input using what you read:
  - Add an explicit instruction like "if a field isn't stated in the text, use the schema default rather than estimating"
  - Add one few-shot example of input → correct output directly in the prompt
  - Compare before/after.

## Dev log (~30 min)

Write down:
- What did the old tool-forcing approach look like conceptually?
- Why is grammar-constrained decoding a stronger guarantee than "asking nicely" in a prompt?
- Where exactly does the guarantee stop mattering (refusal, max_tokens, or just plain wrong facts in a valid shape)?

## Preview tomorrow (~15 min)

Skim [Strict tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use) — it's the same grammar-constrained mechanism used today, applied to tool inputs instead of final JSON responses. You'll want that on Day 3 once your hand-rolled tool loop needs to guarantee it never gets malformed arguments back from the model.
