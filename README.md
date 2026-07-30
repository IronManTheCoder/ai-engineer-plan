# 3-Week AI Engineering Roadmap — TypeScript/Node.js Track
### (Revised: narrower framework depth, evals from Day 1, security-by-design, incremental deployment)

**For:** A software engineer with API experience (OpenAI/Claude), no framework experience yet
**Pace:** 6 hours/day, 21 days, ~126 hours total
**Outcome:** Three **production-oriented portfolio applications** (see the honest scope note below on what that phrase does and doesn't mean):
1. A citation-backed RAG knowledge assistant, with a persistent eval suite
2. A security-hardened CLI coding agent ("mini Claude Code")
3. A narrower multi-agent workflow (triage → retrieve → draft, with QA as a stretch goal) that demonstrates the customer-support/business-automation/research-assistant pattern

---

## Honest scope note: what "production-oriented" means here

These are **not** production-grade systems in the sense of handling real customer traffic unsupervised. In three weeks you will not get load testing, a full incident-response runbook, or compliance sign-off, and that's fine — that's not the goal. What you *will* get, applied consistently across all three capstones, is this minimum bar:

- [ ] A clear access model (API key or basic auth — doesn't need to be enterprise SSO)
- [ ] Structured logging and request tracing (not just `console.log`)
- [ ] Rate limits and a hard cap on API spend per session
- [ ] Retries, timeouts, and explicit error handling on every external call
- [ ] Prompt-injection defenses on anything ingesting retrieved or web content
- [ ] Secrets kept out of source control and out of the coding agent's reach
- [ ] A handful of automated tests (not full coverage — enough to catch regressions)
- [ ] A CI check that runs those tests on push
- [ ] A working deployment config (not just "runs on my machine")
- [ ] Basic monitoring — you'd know within minutes if it broke

This is the bar referenced every time a day below says "meets the production bar."

---

## Tech stack (confirmed current as of mid-2026)

| Layer | Tool | Depth this cycle |
|---|---|---|
| Runtime | Node.js 20+, TypeScript, `tsx` | Used daily |
| Validation / schemas | `zod` | Used daily |
| Raw LLM SDKs | `@anthropic-ai/sdk`, `openai` | Week 1 — understand the primitives before abstracting |
| Streaming & tool-calling UI layer | **Vercel AI SDK** (`ai` package) | **Primary** — deep, daily use from Day 8 onward |
| Full agent framework | **Mastra** | **Primary** — deep, daily use from Day 10 onward; the backbone of Capstone 3 |
| Tool interoperability | **Model Context Protocol (MCP)**, `@modelcontextprotocol/sdk` | **Required** — one real server built and reused |
| Coding-agent SDK | **Claude Agent SDK (TypeScript)** | **Specialized** — used only for Capstone 2, where it's the right tool |
| Graph orchestration | **LangGraph.js** | **Optional appendix** — a short standalone exercise, not required path |
| Vector store | **LanceDB** (embedded) for learning days → **pgvector/Supabase** for the capstone | Both used |
| Embeddings | OpenAI `text-embedding-3` or Voyage AI | Either |
| Observability/evals | Mastra's built-in tracing/evals, optionally Langfuse | Introduced Day 6, used throughout |
| Deployment | Vercel (web UI), Railway/Fly.io (long-running agents) | Set up per-capstone, not saved for the end |

**Before Day 1, set up:** Node 20+, pnpm, an Anthropic API key, an OpenAI API key (for embeddings/comparison), a GitHub repo for the whole journey with a basic CI workflow file (even an empty one you'll fill in later), and a Vercel account.

---

## Daily rhythm

| Time | Activity |
|---|---|
| 0:00–1:00 | Read/watch the day's core concept material |
| 1:00–1:30 | Sketch the day's build: architecture, data flow, tool list |
| 1:30–4:30 | Build (main block) |
| 4:30–5:15 | Debug, extend, add one edge case you didn't plan for |
| 5:15–5:45 | Write a short dev log entry (what worked, what broke, one snippet worth remembering) |
| 5:45–6:00 | Skim tomorrow's topic |

---

## Week 1 — Foundations: LLMs, Tools, Embeddings, RAG, and Evals (no frameworks yet)

Note the change from the first draft: **evals now start on Day 6**, the same day RAG is introduced, not on Day 14. You build the eval set once and extend it — you never throw it away and start over.

| Day | Focus | Hands-on build | Read/reference |
|---|---|---|---|
| **1** | Raw LLM API mastery: multi-turn messages, system prompts, streaming, token/cost math | CLI streaming chatbot with in-memory conversation history, using `@anthropic-ai/sdk` directly | [API overview](https://platform.claude.com/docs/en/api/overview) · [Using the Messages API](https://platform.claude.com/docs/en/build-with-claude/working-with-messages) |
| **2** | Structured outputs & prompt engineering: XML tags, few-shot, chain-of-thought, forcing typed JSON via tool_choice | A resume/invoice parser that emits strict Zod-validated JSON | [Prompt engineering overview](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview) · [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) |
| **3** | Tool use from scratch (no framework): Zod schema → JSON schema, the request→tool_use→tool_result loop, multi-tool routing, error handling | CLI agent with calculator, weather, and file-read tools, hand-rolled loop. **Add a tiny eval script today**: 10 hand-written test prompts + expected tool calls, checked automatically | [Tool use overview](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview) · [How tool use works](https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works) |
| **4** | Agent design patterns: ReAct, Plan-and-Execute, Reflection/self-critique, orchestrator–worker | Add a reflection/self-critique pass to Day 3's agent (it checks and retries its own answer); re-run Day 3's eval script to confirm the reflection step didn't regress anything | [Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents) (Anthropic) |
| **5** | Embeddings & vector search: cosine similarity, chunking basics, vector DB tradeoffs | Semantic search CLI over a folder of your own markdown notes, using embedded LanceDB | [OpenAI embeddings guide](https://platform.openai.com/docs/guides/embeddings) · [Voyage AI embeddings docs](https://docs.voyageai.com/docs/embeddings) · [LanceDB docs](https://lancedb.github.io/lancedb/) |
| **6** | Full RAG pipeline: chunking strategies, hybrid search, reranking. **Build the eval set today**, not later: answerable questions, unanswerable questions, questions needing multiple documents, questions with conflicting source information, and citation-validation cases | RAG chatbot over a small PDF corpus that returns citation-backed answers, graded against the eval set you just wrote | [Introducing Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval) (Anthropic) |
| **7** | Memory patterns + Week 1 capstone | Combine tools + memory + RAG into "Personal Knowledge Assistant v0"; run the Day 6 eval set against it; buffer/catch-up day | Re-read whichever Day 1–6 doc you skimmed too fast the first time |

**Week 1 checkpoint:** you can explain, without a framework, exactly what happens on every round-trip to the model — and you have a standing eval set you'll keep reusing, not rebuilding, for the rest of the roadmap.

---

## Week 2 — One Running Example, Two Frameworks Deep, Required Interop, Specialized Tooling

The first draft rebuilt disconnected demos in four different frameworks. This version builds **one evolving application — "Support Assistant"** — across Days 8–12, and asks you to produce an explicit comparison at each step (implementation complexity, state management, tool handling, observability, human-approval support, deployment story). That comparison table is itself a portfolio artifact: it's what an interviewer actually wants to hear when they ask "why did you pick X."

Support Assistant's job, throughout: given a support ticket, decide whether it needs a knowledge-base lookup, retrieve relevant docs, draft a reply, and flag low-confidence cases. This is deliberately the same shape as Capstone 3 — by Day 12 you'll already have its skeleton built and hardened, so Week 3 is extension, not a fresh start.

| Day | Focus | Hands-on build | Read/reference |
|---|---|---|---|
| **8** | Vercel AI SDK: `generateText`, `streamText`, `tool()`, `generateObject`, the `ToolLoopAgent` class | **Support Assistant v1** on the AI SDK: a tool-using agent that classifies a ticket and answers from a small FAQ tool. Streaming Next.js UI | [AI SDK docs](https://ai-sdk.dev/docs/introduction) · [AI SDK 6 announcement](https://vercel.com/blog/ai-sdk-6) |
| **9** | Model Context Protocol: servers, clients, hosts, tools/resources/prompts | Wrap Support Assistant's FAQ/ticket tools as a real MCP server (not a throwaway example) — this server gets reused in Capstone 3 later | [MCP SDKs overview](https://modelcontextprotocol.io/docs/sdk) · [TypeScript SDK repo](https://github.com/modelcontextprotocol/typescript-sdk) · [Server quickstart](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server-quickstart.md) |
| **10** | Mastra fundamentals: agents, tools, the model router, Mastra Studio | **Support Assistant v2**: reimplement v1 as a Mastra agent with built-in memory, consuming the same MCP server from Day 9. Deliverable: a written comparison table (AI SDK vs Mastra) across the six dimensions above | [mastra.ai/docs](https://mastra.ai/docs) |
| **11** | Mastra workflows: durable/typed control flow, branching, suspend/resume | Extend Support Assistant into a durable workflow: ingest → classify → retrieve → draft → confidence check. This is literally Capstone 3's skeleton, built two weeks early | [mastra.ai/docs](https://mastra.ai/docs) (Workflows section) |
| **12** | Production hardening, applied to Support Assistant against the minimum bar above | Add retries/timeouts on every external call, structured logging + tracing, a rate limit and per-session cost cap, and a prompt-injection check on anything the retrieval tool returns | Mastra observability docs (same site) · your own Day 6 eval set, extended to cover Support Assistant's classify/draft steps |
| **13** | Claude Agent SDK, with security as a Day-1 design constraint (not a later add-on) | A minimal coding assistant that reads/edits files and runs shell commands, built from the start with: a sandboxed workspace directory, a command allowlist, blocked destructive commands, execution timeouts, no access to environment secrets, mandatory git-diff review before any change is applied, and a human-approval gate before anything irreversible | [Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) · [Quickstart](https://platform.claude.com/docs/en/agent-sdk/quickstart) · [TypeScript SDK reference](https://platform.claude.com/docs/en/agent-sdk/typescript) · [Example agents repo](https://github.com/anthropics/claude-agent-sdk-demos) |
| **14** | Evaluation & observability review — extend, don't rebuild | Grow the Week 1 RAG eval set to also cover Support Assistant's classify/retrieve/draft steps; add an LLM-as-judge harness; confirm tracing is wired across every project so far; catch-up/buffer day | [Anthropic: how we evaluate our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) (see "Effective evaluation of agents") |

**Optional appendix, do on your own time if graph-based orchestration interests you:** re-implement Support Assistant's routing logic as a LangGraph.js graph. It won't teach you anything Mastra didn't already cover for this roadmap's purposes, but it's the right exercise once you hit a project where explicit state-machine control genuinely matters. [LangGraph.js docs](https://langchain-ai.github.io/langgraphjs/).

**Week 2 checkpoint:** you can justify, with your own comparison data rather than a blog post's, when you'd reach for AI SDK vs Mastra — and Support Assistant already meets the minimum production bar, two weeks before the deadline.

---

## Week 3 — Capstone Sprint

### Days 15–16 — Capstone 1: RAG Knowledge Assistant
Production-oriented version of Week 1's mini-RAG: multi-format ingestion (PDF, Markdown, web pages), chunking with metadata, hybrid retrieval + reranking, citation-backed answers, streaming chat UI, backed by pgvector/Supabase. **Run the Week 1 eval set against it before calling it done — extend the set, don't restart it.** Meet the minimum production bar (auth, logging, rate limits, secrets, tests, CI). Deploy to Vercel *this week*, not on Day 21 — write its README now while the design decisions are fresh.

### Days 17–18 — Capstone 2: Coding Agent ("mini Claude Code")
Builds directly on Day 13's security-first foundation: file read/write/edit tools, sandboxed shell execution inside an allowed workspace, a plan → execute → verify loop, mandatory git-diff review, and a code-review subagent. Add the automated tests and CI check now, not later. Deploy and document this week.

### Days 19–20 — Capstone 3: Multi-Agent Workflow (narrower scope, built on Day 11's skeleton)
This is deliberately smaller than the original four-role design — the review was right that four fully-built agent roles in two days is unrealistic. Required scope:
- **Triage/router agent** — classifies incoming requests
- **Research agent** — reuses Capstone 1's retrieval pipeline and the Day 9 MCP server
- **Drafting agent** — writes the response, grounded in retrieved context

**QA/critic agent is a stretch goal**, not a requirement — add it only if the first three roles are solid and hardened to the minimum production bar. A working three-agent system that meets the bar beats a four-agent system that doesn't.

As a design exercise (diagram, not full implementation — this is where your existing API/AWS/event-driven background pays off), sketch how this would evolve past a synchronous demo:

```
Synchronous version (what you're building):
API/UI → request validation → orchestrator → agent workers → tool layer → retrieval/data services

Production evolution (design only, don't build this in 2 days):
Request → queue/event → durable workflow → agent execution → status updates → human approval → final response
```

Having this diagram in your portfolio, explicitly labeled as a design sketch rather than a built system, signals more engineering maturity than quietly overclaiming the demo is production-ready.

*Read/reference:* [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) (Anthropic) — the orchestrator/subagent/citation-agent architecture maps directly onto this capstone's triage/research/draft roles.

### Day 21 — Integration, Final Eval, Demo, Retrospective
Because README writing, MCP-ification, and deployment already happened inside Days 15–20, Day 21 is now scoped to what actually fits in six hours:
- Integration testing across all three capstones (do they actually work together — does Capstone 3 really call Capstone 1's retrieval and the Day 9 MCP server correctly?)
- One final full run of your (by now quite mature) eval suite across all three projects
- Record a short demo walkthrough
- A written architecture review/retrospective: what you'd change, what surprised you, where the minimum-bar checklist still has gaps you knowingly left
- Pick a specialization to go deeper on next: agent evals/observability, agent security, or the event-driven architecture you sketched in Capstone 3

---

## Portfolio checklist by end of Day 21

- [ ] Public GitHub repo with a clean daily history, Week 1 → Week 3, and a CI workflow that runs
- [ ] Three deployed, demoable **production-oriented** applications (explicitly labeled as such, not overclaimed) with README case studies written during their build week
- [ ] A written framework-comparison artifact from Days 8–12 (your own data, not a summary of someone else's blog post)
- [ ] At least one MCP server you built and reused across two projects
- [ ] One eval suite that grew across the whole roadmap instead of three disconnected ones
- [ ] The Capstone 3 architecture diagram showing the synchronous-to-event-driven evolution
- [ ] A short note on what's still missing versus true production readiness — this kind of honesty reads well to engineers reviewing your work

---

*Adjust pacing freely — if a day's build takes 8 hours instead of 6, let it; the buffer days (7 and 14) exist exactly for this.*
