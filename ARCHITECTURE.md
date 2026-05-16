# Architecture & Session 5 Alignment

A full technical breakdown of The Idea Courtroom — how it works, how the LLM calls happen, and how every design decision maps back to what was taught in Session 5.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React)                          │
│                                                                 │
│   User types idea                                               │
│        │                                                        │
│        ▼                                                        │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │              Dependency-Aware Reasoning Chain            │  │
│   │                                                          │  │
│   │  PHASE 1 (parallel — no dependencies)                    │  │
│   │  ┌─────────────────┐   ┌─────────────────┐              │  │
│   │  │   Advocate LLM  │   │  Prosecutor LLM │              │  │
│   │  │   Call #1       │   │  Call #2        │              │  │
│   │  └────────┬────────┘   └────────┬────────┘              │  │
│   │           │                     │                         │  │
│   │           └──────────┬──────────┘                         │  │
│   │                      ▼                                    │  │
│   │  PHASE 2 (depends on Phase 1 output)                     │  │
│   │           ┌─────────────────┐                            │  │
│   │           │  Strategist LLM │                            │  │
│   │           │  Call #3        │                            │  │
│   │           └────────┬────────┘                            │  │
│   │                    │                                      │  │
│   │                    ▼                                      │  │
│   │  PHASE 3 (depends on Phases 1 + 2)                       │  │
│   │           ┌─────────────────┐                            │  │
│   │           │    Judge LLM    │                            │  │
│   │           │    Call #4      │                            │  │
│   │           └────────┬────────┘                            │  │
│   └────────────────────┼─────────────────────────────────────┘  │
│                        ▼                                        │
│                  Verdict Card (UI)                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## How the LLM Calls Actually Work

### Inside claude.ai (Artifact Mode)

When `idea_courtroom.jsx` runs as an artifact inside claude.ai, every `fetch` call to `api.anthropic.com` is intercepted and authenticated by Anthropic's infrastructure. **No API key appears in the code and no API key is needed from you.** The call is handled server-side.

```js
// This is the ENTIRE API call. No Authorization header, no key.
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    system: VOICE_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  })
});
```

This capability exists **only inside the claude.ai artifact sandbox**. It is not a general browser capability.

### If You Deploy It Yourself (Standalone Web App)

Direct browser → Anthropic API calls will fail in two ways:
1. **No API key** — the request will be rejected with a 401
2. **CORS** — browsers block cross-origin requests to `api.anthropic.com` from third-party domains

The correct architecture for standalone deployment is:

```
React (browser)  →  Your Python Backend  →  Anthropic API (or llm_gatewayV2)
```

Your backend holds the API key, proxies the request, and returns the response. The browser never touches the API directly.

### Will Publishing the Artifact Cost You API Credits?

**No.** When other people open your claude.ai artifact link, they run it in their own claude.ai session under Anthropic's infrastructure. Your personal API usage is not affected.

However: if you build a standalone web app with your own API key exposed on the frontend, every user's request costs you money. Never hardcode API keys in frontend code.

---

## Session 5 Concept Mapping

### 1. Dependency-Aware Multi-Step Planning

Session 5 introduced the idea that not all subtasks are independent — some steps depend on others being completed first. This is the single most important concept for building complex agentic applications.

```
Session 5 teaching:
"Booking a trip: Step 3 (book hotel) depends on Step 2 (choose dates),
which depends on Step 1 (find flights). The LLM needs to keep state
and understand dependencies between steps."

How it appears in this app:
Phase 1 → Phase 2 → Phase 3 is a strict dependency chain.
The Strategist CANNOT reason without the Advocate's wedge analysis
and the Prosecutor's killer question. The Judge CANNOT score without
all three prior outputs.
```

**Code pattern (mirrors `asyncio.TaskGroup` from `agent5.py`):**

```js
// Phase 1 — Parallel (no dependency between Advocate and Prosecutor)
const [adv, pros] = await Promise.all([
  callClaude(ADVOCATE_PROMPT, `IDEA:\n${idea}`),
  callClaude(PROSECUTOR_PROMPT, `IDEA:\n${idea}`),
]);

// Phase 2 — Sequential (depends on Phase 1)
const strat = await callClaude(
  STRATEGIST_PROMPT,
  `IDEA:\n${idea}\n\nADVOCATE:\n${JSON.stringify(adv)}\n\nPROSECUTOR:\n${JSON.stringify(pros)}`
);

// Phase 3 — Sequential (depends on Phases 1 + 2)
const verd = await callClaude(
  JUDGE_PROMPT,
  `IDEA:\n${idea}\n\nADVOCATE:\n${JSON.stringify(adv)}\n\nPROSECUTOR:\n${JSON.stringify(pros)}\n\nSTRATEGIST:\n${JSON.stringify(strat)}`
);
```

In `agent5.py` this was implemented with `asyncio.TaskGroup`. In the frontend, `Promise.all` is the exact JavaScript equivalent.

---

### 2. Pydantic-Style Structured Output on Every Boundary

Session 5's core message: every piece of data crossing a trust boundary (from LLM output → your code) must have a validated schema. Pydantic is the Python mechanism for this.

In this JavaScript app, we define schemas explicitly in the system prompts and parse + validate every response through a robust parser.

**Equivalent Python Pydantic models (what this would look like in `agent5.py`):**

```python
from pydantic import BaseModel, Field
from typing import Literal

class AdvocacyCase(BaseModel):
    problem: str
    audience: str
    timing: str
    wedge: str
    unfair_advantage: str
    strongest_signal: str

class ProsecutionCase(BaseModel):
    hidden_assumption: str
    market_reality: str
    execution_risk: str
    killer_question: str
    biggest_flaw: str

class StrategicAnalysis(BaseModel):
    pivot: str
    wedge_sharpening: str
    sequence: str
    cheapest_test: str
    key_insight: str

class FinalVerdict(BaseModel):
    conviction_score: int = Field(ge=0, le=10)
    recommended_path: Literal["PROCEED", "PIVOT", "PASS"]
    strongest_signal: str
    biggest_risk: str
    next_action: str
    one_line_pitch: str
```

**In the JavaScript app, the JSON schema enforcement happens via the prompt:**

```js
// The prompt declares the schema. The model is instructed to return ONLY JSON.
// The parser extracts and validates the shape.
const parseJSON = (text) => {
  let clean = text.trim()
    .replace(/^```(?:json)?\s*/i, '')  // strip ```json fences
    .replace(/```\s*$/i, '')
    .trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start !== -1 && end !== -1) clean = clean.substring(start, end + 1);
  return JSON.parse(clean);  // throws if invalid — same as Pydantic ValidationError
};
```

Session 5's teaching: "Without Pydantic, every LLM-driven function ends up with a hand-rolled if/else parser. With Pydantic, the parser, the schema, and the validator are the same five-line class."

This app follows that principle — one schema definition in the prompt, one parser function, zero hand-rolled field-checking.

---

### 3. ReACT Pattern (Reasoning + Acting)

Session 5 introduced ReACT as: Thought → Action → Observation → repeat.

Each voice in the Courtroom implements a constrained ReACT loop internally:

```
For each voice:

THOUGHT:    Reason through the numbered lenses (§1, §2, §3, §4)
SELF-CHECK: Internal verification step (do not output)
ACTION:     Return structured JSON output
```

The Judge's role mirrors the **Verifier** in `agent5.py`:

```python
# From agent5.py (Session 5 reference code)
# The verifier is a separate LLM call with structured output
reply = llm.chat(
    prompt="Was the math correct? Reply as a Verdict.",
    response_format={
        "type": "json_schema",
        "schema": Verdict.model_json_schema(),
    },
)
v = Verdict.model_validate(reply["parsed"])
```

The Judge in this app is the same pattern — a separate, deliberate LLM call that receives all prior reasoning and returns a typed `FinalVerdict` schema.

---

### 4. Chain-of-Thought + Structured Prompting

Session 5 taught that structured prompts are more reliable than conversational ones. Instead of "evaluate this idea," each voice uses:

- **Numbered lenses** — forces sequential reasoning before output
- **Reasoning type tags** — e.g., `§1 [Entity Lookup + Market Analysis]`, `§3 [Strategic Reasoning]`
- **Self-check section** — internal verification before output is written
- **Instructional framing** — exact format specified, not implied
- **Fallback instructions** — what to do when context is insufficient

This directly implements Session 5's guidance on "Explicit Reasoning Prompt," "Instructional Framing," and "Internal Self-Check prompts."

---

### 5. Reasoning Budget (Session 5 V2 Feature)

Session 5 introduced `reasoning="off"|"low"|"medium"|"high"` in `llm_gatewayV2`.

In this app, this is implemented via structural design rather than an API flag:
- Advocate and Prosecutor use 4 reasoning lenses (medium depth)
- Strategist uses 4 lenses with cross-reference to prior outputs (higher depth)
- Judge has an explicit `SELF-CHECK` and `FALLBACK` for the most deliberate reasoning (high depth)

If migrating to `llm_gatewayV2`, you would apply:
```python
llm.chat(prompt=..., reasoning="medium")   # Advocate, Prosecutor
llm.chat(prompt=..., reasoning="medium")   # Strategist
llm.chat(prompt=..., reasoning="high")     # Judge (verifier role)
```

---

## The llm_gatewayV2 Integration Path

The Idea Courtroom can be fully migrated to use `llm_gatewayV2` (Session 5's preferred gateway) via a Python backend. Here's what that looks like:

### Python Backend (FastAPI + uv)

```python
# backend/schemas.py — Pydantic models (one source of truth)
from pydantic import BaseModel, Field
from typing import Literal

class AdvocacyCase(BaseModel):
    problem: str
    audience: str
    timing: str
    wedge: str
    unfair_advantage: str
    strongest_signal: str

class FinalVerdict(BaseModel):
    conviction_score: int = Field(ge=0, le=10)
    recommended_path: Literal["PROCEED", "PIVOT", "PASS"]
    strongest_signal: str
    biggest_risk: str
    next_action: str
    one_line_pitch: str
```

```python
# backend/main.py — FastAPI routes calling llm_gatewayV2
import asyncio
from fastapi import FastAPI
from client import LLM  # llm_gatewayV2 client

app = FastAPI()
llm = LLM()  # auto-failover across 7 free providers

@app.post("/trial")
async def run_trial(idea: str):
    # Phase 1 — Parallel (asyncio.TaskGroup)
    async with asyncio.TaskGroup() as tg:
        advocate_task = tg.create_task(
            llm.chat(prompt=ADVOCATE_PROMPT + idea, reasoning="medium")
        )
        prosecutor_task = tg.create_task(
            llm.chat(prompt=PROSECUTOR_PROMPT + idea, reasoning="medium")
        )

    adv = AdvocacyCase.model_validate(advocate_task.result()["parsed"])
    pros = ProsecutionCase.model_validate(prosecutor_task.result()["parsed"])

    # Phase 2 — Strategist
    strat_raw = await llm.chat(
        prompt=f"{STRATEGIST_PROMPT}\n{adv.model_dump_json()}\n{pros.model_dump_json()}",
        reasoning="medium"
    )
    strat = StrategicAnalysis.model_validate(strat_raw["parsed"])

    # Phase 3 — Judge (verifier)
    verdict_raw = await llm.chat(
        prompt=f"{JUDGE_PROMPT}\n{adv.model_dump_json()}\n{pros.model_dump_json()}\n{strat.model_dump_json()}",
        reasoning="high",
        response_format={
            "type": "json_schema",
            "schema": FinalVerdict.model_json_schema(),
            "name": "FinalVerdict",
            "strict": True,
        }
    )
    return FinalVerdict.model_validate(verdict_raw["parsed"])
```

### Updated Dependency Graph with Backend

```
React (browser)
      │  POST /trial {idea: "..."}
      ▼
FastAPI Backend (port 8200)
      │
      ├──── asyncio.TaskGroup ──── llm_gatewayV2 (port 8100) → Groq / Gemini
      │     ├── Advocate call
      │     └── Prosecutor call
      │
      ├──── Strategist call ───── llm_gatewayV2 (port 8100) → Gemini / Cerebras
      │
      └──── Judge call ────────── llm_gatewayV2 (port 8100) → Groq / NVIDIA NIM
                │
                ▼
           FinalVerdict (Pydantic validated)
                │
      ◄─────────┘
React renders Verdict Card
```

This is 100% aligned with `agent5.py` — same gateway, same Pydantic validation, same `asyncio.TaskGroup` parallel dispatch, same reasoning knob, same structured output verifier pattern.

---

## File Reference

| File | Purpose |
|---|---|
| `idea_courtroom.jsx` | Standalone React artifact — runs in claude.ai with no setup |
| `README.md` | Setup, prompts, test output, session alignment table |
| `ARCHITECTURE.md` | This file — full technical breakdown |
| `backend/schemas.py` | Pydantic models for all four voices |
| `backend/main.py` | FastAPI + llm_gatewayV2 integration |
| `backend/prompts.py` | All four system prompts as Python constants |

---

## Key Takeaways

1. **The dependency chain IS the architecture.** What runs first, what runs second, and what depends on what is not incidental — it's the design.

2. **Structured output is not a nice-to-have.** Every LLM output in this app is validated before it's used as input to the next step. One bad output propagates clean errors, not corrupted reasoning chains.

3. **The session's concepts are language-agnostic.** `Promise.all` is `asyncio.TaskGroup`. A JSON schema in a prompt is a Pydantic `BaseModel`. The patterns are the same regardless of language.

4. **The llm_gatewayV2 is a drop-in backend.** The React frontend doesn't care whether it's calling Anthropic directly or a gateway — it just calls an endpoint and receives validated JSON.
