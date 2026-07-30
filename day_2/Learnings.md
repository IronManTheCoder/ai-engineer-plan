# Hardening a Structured Extraction Prompt: A Day 2 Case Study

*How one field in a resume parser — `yearsOfExperience` — went from "looks done" to actually robust, and what each round of stress-testing revealed about prompt engineering along the way.*

---

## How to read this

This isn't a lecture. It's a reconstruction of a real back-and-forth, where each "fix" got tested and usually turned out to be half-right. If you want the experience this is trying to recreate, don't skip straight to the fixes — at each **🤔 Pause and think** box, stop and actually decide what you'd do before reading on. The value here is in getting caught by the same things I got caught by, not in reading the corrected version.

The starting point: a Day 2 goal to build a resume parser using [Claude's native Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — a Zod schema, compiled into a grammar that guarantees the response is valid JSON matching that shape. Structured outputs solve one problem completely: Claude *cannot* return malformed JSON. They solve a second problem not at all: nothing stops Claude from confidently returning a *valid-shaped, wrong* answer. This case study is entirely about that second problem, using one field as the vehicle.

---

## The starting point

```typescript
yearsOfExperience: z.number().describe("Total years of professional experience"),
```

And the prompt sending a resume in for extraction:

```typescript
content: `Extract structured data from this resume.\n\n<resume>\n${rawText}\n</resume>`,
```

This looks finished. It compiles, it runs, it returns a number. The rest of this document is what happened when we stopped asking "does it run" and started asking "would it survive a resume I didn't write to be easy."

---

## Lesson 1 — Ordering isn't free, but it isn't universal either

**🤔 Pause and think:** The resume text goes *after* the instruction in the prompt above. Anthropic's own prompting guidance says long documents should go *before* the instruction, not after. Is this prompt wrong?

**💡 What we found:** Technically, yes — but the *reason* the rule exists is the interesting part, not the rule itself. The "put longform data first" guidance specifically targets large documents — 20k+ tokens — where a model has to build context before it can usefully act on an instruction that references that context. A resume is maybe 50–80 tokens. At that size, reordering has no measurable effect; Claude isn't losing track of a 15-line document either way. The lesson isn't "always follow this rule everywhere" — it's "understand *why* a rule exists so you know when it actually applies." It's still worth doing here as a habit, because the same code will handle genuinely long documents once RAG shows up later in the roadmap, and rebuilding the habit then is wasted effort.

**The fix:**
```typescript
content: `<resume>\n${rawText}\n</resume>\n\nExtract structured data from this resume.`
```

---

## Lesson 2 — "Total years of experience" is not one instruction, it's an unstated algorithm

**🤔 Pause and think:** Here's a resume:
```
- Staff Engineer, Acme Corp (2022 - Present)
- Software Engineer, Globex Inc (2019 - 2022)
```
Nowhere does it say "6 years of experience" as a number. The field description just says `"Total years of professional experience"`. What number does Claude return, and is it the number you actually wanted?

**💡 What we found:** Claude has to guess an interpretation, and it'll guess *confidently* — a plausible-looking wrong number is indistinguishable at a glance from a right one. That's the core danger: structured outputs guarantee the field will contain *a* number. They guarantee nothing about which number.

**The first fix attempt** was a prose rule: *"if there is no specific total number mentioned, take the start year of the first job and the end year of the last job, and if not provided, use the current year, then sum them up."*

This felt complete. It wasn't.

---

## Lesson 3 — A prompt can read as unambiguous to you while encoding two different algorithms

**🤔 Pause and think:** Apply that new rule to the *same* resume above, literally as written on the page (Acme listed first, Globex second). What does "the start year of the first job" mean — first *as listed*, or first *chronologically*? And separately: does "sum them up" mean the same thing as "span from earliest start to latest end"? Would those two readings ever give different answers?

**💡 What we found:** Two real ambiguities were hiding in one sentence:
1. **Order.** Resumes are almost always written most-recent-job-first. Taken literally against list position, "first job" = Acme (2022) and "last job" = Globex (2019-2022) — producing a nonsensical or zero span. The rule never said "chronological order."
2. **Sum vs. span.** "Start of first to end of last" describes a *span*. "Sum them up" describes *adding individual durations*. These agree only when roles are back-to-back with no gap — true by coincidence in this one example, false for anyone with a career gap or overlapping roles.

The pattern worth keeping: a single clean test case doesn't prove a prompt is solid, because multiple different algorithms can agree on one example while disagreeing everywhere else. The way to actually check a prompt is to try to break it, not to confirm it.

---

## Lesson 4 — Examples teach differently than instructions do

**🤔 Pause and think:** Rather than writing a longer, more careful paragraph to close both gaps above, what's a *different kind* of fix — one that doesn't rely on prose at all?

**💡 What we found:** Few-shot examples. A prose instruction tells Claude the rule; an example shows Claude the behavior directly and lets it generalize the underlying pattern — often more reliably, because you don't have to anticipate and spell out every edge case in words. Examples live in the actual prompt content, wrapped in `<example>` tags (or `<examples>` for several), not inside the Zod `.describe()`, which stays a short field-level label.

**First attempt:**
```
<example>
<input>Staff Engineer, Acme Corp (2022 - Present) - Software Engineer, Globex Inc (2019 - 2022)</input>
<output>{"yearsOfExperience": 6}</output>
</example>
<example>
<input>Engineer III, Acme Corp (2022 - Present) - Engineer II, Globex Inc (2019 - 2021)</input>
<output>{"yearsOfExperience": 5}</output>
</example>
```

This genuinely taught something real by *contrast*: example 1 has no gap and returns a higher number; example 2 has a one-year gap and returns a lower one, which teaches "exclude idle time" without ever saying so in words. That was a real win.

---

## Lesson 5 — A good example still might not test what you think it tests

**🤔 Pause and think:** Both examples above list the more recent role first. Is the model learning "compute from actual dates" — or could it just as easily be learning "subtract the *last listed* year from the *first listed* year"? Both rules agree on every example given so far. How would you tell them apart?

**💡 What we found:** You can't, from this pair — you need an example where those two rules would *disagree*, and see which answer comes out. The fix was reversing the listing order in the second example while keeping the dates otherwise sensible:

```
<example>
<input>Staff Engineer, Acme Corp (2022 - Present), Software Engineer, Globex Inc (2019 - 2022)</input>
<output>{"yearsOfExperience": 7}</output>
</example>
<example>
<input>Software Engineer, Globex Inc (2019 - 2020), Staff Engineer, Acme Corp (2022 - Present)</input>
<output>{"yearsOfExperience": 5}</output>
</example>
```

Now the two examples disagree on *list position* (which job is written first) while staying consistent on *what the dates say* — so a model that got the right answer on both can only have done it by actually reading dates, not position. That's the difference between an example that merely demonstrates the right behavior and one that's actually diagnostic of *why* the model got there.

---

## Lesson 6 — Examples teach algorithms; they don't anchor facts

**🤔 Pause and think:** Both example outputs above (`7` and `5`) were computed against *today's* real date. Nothing in the prompt states what "today" is. What happens when this exact code runs a year from now?

**💡 What we found:** The examples silently baked in "Present = this particular year" through the output number, without ever stating it. A few-shot example teaches an *algorithm* — it generalizes. "What year is it right now" isn't an algorithm to infer from a pattern; it's a fact, and a fact frozen inside a hardcoded example goes stale rather than generalizing. Run the same code twelve months later and it stays anchored to whatever year the examples imply, silently producing wrong answers with no warning.

**The fix:** state it explicitly, separately from the examples:
```typescript
`Today's date is ${new Date().toISOString().slice(0, 10)}.`
```
Two different tools for two different jobs: examples for teaching *how* to compute something, an explicit stated fact for anything that changes with wall-clock time and can't be inferred from a pattern.

---

## Lesson 7 — A system-prompt "role" only matters where the schema can carry it out

**🤔 Pause and think:** Add a role to the system prompt: *"You are a helpful assistant. If you're unsure about a data point, call it out rather than making something up."* Given the schema at this point still has `yearsOfExperience: z.number()` (required, no escape hatch) — does this instruction actually change anything for that field?

**💡 What we found:** No — and this is a structural problem, not a wording one. `z.number()` is a hard grammar constraint. There is no legal token sequence for "I don't know" inside a required number field, no matter how clearly the system prompt asks for honesty. A system prompt can't override what the compiled grammar will and won't allow through. The schema itself has to make room for the behavior you're asking for, or the instruction is asking for something structurally impossible.

(Separately: "You are a helpful assistant" as an opener wasn't doing any work — the value was entirely in the second half of the sentence. Boilerplate roles don't hurt, but they don't help either, once the schema already locks down output shape.)

---

## Lesson 8 — Reusing a valid value as a sentinel creates a silent collision

**🤔 Pause and think:** The proposed fix: change the type to allow `0` as a fallback, and treat any `0` as "the model was uncertain, flag for human review." What's wrong with using `0` this way?

**💡 What we found:** `0` is already a legitimate, confident answer for some real resumes — a new graduate with no professional roles listed genuinely has zero years of experience, and that's correct, not uncertain. Using `0` as *both* "confident zero" and "unknown" means every new-grad resume gets wrongly flagged for review, while a case where Claude is truly unsure but guesses a *nonzero* number sails through untouched. This is the same shape of bug as the email field earlier in the schema — before it was fixed, `""` was used to mean "not present," which worked fine specifically because no real email is ever an empty string. The fix already existed elsewhere in the same schema, for `endYear`:
```typescript
endYear: z.number().nullable().describe("null if this is the current role"),
```
`null` there can never collide with a real year, because no real year is ever `null`. That's the pattern to copy.

---

## Lesson 9 — A schema fix without an instruction is only half a fix

**🤔 Pause and think:** The corrected field:
```typescript
yearsOfExperience: z.number().nullable().describe(""),
```
The type now legally allows `null`. Is the field actually fixed?

**💡 What we found:** No — the `.describe("")` is empty. `.describe()` isn't documentation for humans reading the code; it's the literal instruction Claude reads to decide how to fill the field. The type now *permits* "I don't know," but nothing tells the model *when* to reach for that option instead of guessing. This is the exact same bug as Lesson 2, relocated: an escape hatch exists structurally, but nothing routes behavior toward it.

**The actual fix:**
```typescript
yearsOfExperience: z.number().nullable().describe(
  "Total years of professional experience, calculated as the sum of individual role " +
  "durations (not counting gaps between roles). Order roles by actual date, not by " +
  "the order they're listed in. Return 0 if the resume lists roles but they sum to " +
  "zero years. Return null if the resume doesn't contain enough dated work history " +
  "to calculate this with confidence — do not guess."
),
```

---

## Lesson 10 — Two different `null`s need two different responses

**🤔 Pause and think:** `parseResume()` already returns `Resume | null` at the top level — a top-level `null` there means total failure (a refusal, or a truncated response with `stop_reason: "max_tokens"`). Now `resume.yearsOfExperience` can *also* be `null`, one level down, inside an otherwise-successful result. Are these the same kind of "unknown," and should calling code treat them the same way?

**💡 What we found:** No. Top-level `null` means *there is nothing to show the user* — the whole extraction failed. Field-level `null` means *the extraction succeeded, but this one piece is unverified* — the rest of the resume is still good and usable. Conflating them either throws away a perfectly good result over one uncertain field, or silently ships an unreviewed guess. The caller needs an explicit two-level check:

```typescript
const resume = await parseResume(rawText);

if (resume === null) {
  console.log("Could not parse this resume — no output to show.");
} else {
  console.log(JSON.stringify(resume, null, 2));
  if (resume.yearsOfExperience === null) {
    console.warn("⚠️  yearsOfExperience uncertain — routing for human review.");
  }
}
```

---

## The generalization

Every one of the ten lessons above is really the same principle from the prompt-engineering docs — **be clear and direct** — applied at a different scope than it's usually introduced at. It's not a rule for system prompts specifically. It applies anywhere Claude reads your words and has to make a judgment call: a top-level instruction, a role, or a two-word field description buried in a schema. Fuzzy in any of those spots produces the same failure mode every time: a confident, valid-shaped, wrong answer. The "show it to a colleague with no context" test works just as well pointed at one `.describe()` string as it does at an entire prompt.

---

## What the final, hardened field looks like

```typescript
yearsOfExperience: z.number().nullable().describe(
  "Total years of professional experience, calculated as the sum of individual role " +
  "durations (not counting gaps between roles). Order roles by actual date, not by " +
  "the order they're listed in. Return 0 if the resume lists roles but they sum to " +
  "zero years. Return null if the resume doesn't contain enough dated work history " +
  "to calculate this with confidence — do not guess."
),
```
paired with a prompt containing the resume, an explicit `Today's date is ...` fact, and two order-reversed, gap-contrasted few-shot examples — plus a system prompt whose "flag uncertainty" instruction now has somewhere structurally valid to land.

The complete runnable file, tested against four resumes specifically built to break each fix if it didn't actually hold — a clean case, a reordered case with a genuine gap, a confident zero, and a fully dateless resume — lives in `day2-structured-output.ts`.

| Test case | What it checks | Expected result |
|---|---|---|
| Clean, contiguous experience | Basic math | `7` |
| Reordered listing with a real gap | Generalization, not memorized example text | `4` |
| New grad, one zero-length internship | Confident zero ≠ unknown | `0` |
| No dated work history at all | Uncertainty flagged, not guessed | `null` |

---

## A portable checklist for the next field you write

Worth carrying into every schema field from here on, not just resumes:

1. Is the `.describe()` actually an instruction, or is it a label that only makes sense to a human?
2. If I gave this field's description to a colleague with no other context, would they produce the same output I want?
3. Does my one working example prove the algorithm is right, or does it just happen to be consistent with a simpler, wrong algorithm too?
4. Is there anything in this prompt that's a *fact about right now* rather than a *general rule* — and is it stated explicitly, or accidentally baked into an example?
5. If the model needs to express "I don't know" for this field, does the type actually allow that, using a value that can never collide with a real answer?
6. If it does allow "unknown," does the calling code actually treat that differently from a real, confident answer?