# Architecture & Session 5 Alignment

A full technical breakdown of The Idea Courtroom — how it works, how the LLM calls happen, and how every design decision maps back to what was taught in Session 5.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                React Frontend  (localhost:5173)                 │
│  idea_courtroom_gateway.jsx                                     │
│                                                                 │
│  User types idea → POST /api/phase1 → POST /api/phase2         │
│                                      → POST /api/phase3         │
└────────────────────────┬────────────────────────────────────────┘
                         │  HTTP (localhost:8200)
┌────────────────────────▼────────────────────────────────────────┐
│             FastAPI Backend  (localhost:8200)                   │
│  backend/main.py + courtroom.py                                 │
│                                                                 │
│  PHASE 1 (parallel)                                             │
│  ┌─────────────────┐   ┌─────────────────┐                     │
│  │  run_advocate() │   │ run_prosecutor() │ asyncio.gather      │
│  └────────┬────────┘   └────────┬────────┘                     │
│           └──────────┬──────────┘                               │
│                      ▼                                          │
│  PHASE 2 (depends on Phase 1)                                   │
│           ┌─────────────────┐                                   │
│           │ run_strategist()│                                   │
│           └────────┬────────┘                                   │
│                    ▼                                            │
│  PHASE 3 (depends on Phases 1 + 2)                              │
│           ┌─────────────────┐                                   │
│           │   run_judge()   │  reasoning="high"                 │
│           └────────┬────────┘                                   │
└────────────────────┼────────────────────────────────────────────┘
                     │  HTTP (localhost:8100)
┌────────────────────▼────────────────────────────────────────────┐
│          llm_gatewayV2  (localhost:8100)                        │
│                                                                 │
│  Single OpenAI-style API → 7 free providers                     │
│  Auto-failover · reasoning knob · cache_system · json_schema    │
│                                                                 │
│  Gemini · Groq · Cerebras · NVIDIA NIM · OpenRouter · Ollama   │
└─────────────────────────────────────────────────────────────────┘
```

---

## How the LLM Calls Actually Work

Every LLM call in this app flows through `courtroom.py` → `call_gateway()` → llm_gatewayV2 → one of 7 free providers.

### The single gateway entry point (`courtroom.py`)

```python
async def call_gateway(
    system_prompt: str,
    user_message: str,
    response_model: type[BaseModel],
    reasoning: str = "medium",
    cache_system: bool = True,
) -> dict:
    payload = {
        "model": "auto",              # gateway picks best available provider
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message},
        ],
        "response_format": {
            "type": "json_schema",
            "schema": response_model.model_json_schema(), # Pydantic generates this
            "name": response_model.__name__,
            "strict": True,
        },
        "reasoning": reasoning,       # V2 extension: translated per provider
        "cache_system": cache_system, # V2 extension: caches stable system prompts
    }
    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post("http://localhost:8100/v1/chat/completions", json=payload)
    data = response.json()
    return data["choices"][0]["message"]["parsed"]  # gateway returns validated dict
```

### Using Rohan's Python client (alternative to httpx)

If you copy `client.py` from the `llm_gatewayV2/` directory into `backend/`, you can use the native client instead:

```python
from client import LLM
llm = LLM()

reply = llm.chat(
    system=ADVOCATE_PROMPT,
    prompt=f"IDEA:\n{idea}",
    cache_system=True,
    reasoning="medium",
    response_format={
        "type": "json_schema",
        "schema": AdvocacyCase.model_json_schema(),
        "name": "AdvocacyCase",
        "strict": True,
    }
)
result = AdvocacyCase.model_validate(reply["parsed"])
```

Both approaches produce identical results. The `httpx` version in `courtroom.py` is self-contained — no need to copy files from the gateway directory.

### API key situation

llm_gatewayV2 handles all provider authentication via its own `.env` file (Gemini API key, Groq API key, etc.). The FastAPI backend has no key of its own — it just calls `localhost:8100`. The React frontend has no key at all — it calls `localhost:8200`. **No API key ever appears in frontend code.**

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

## File Reference

| File | Purpose | Session 5 concept |
|---|---|---|
| `backend/schemas.py` | Pydantic models for all 4 voices | Structured output, one source of truth |
| `backend/prompts.py` | Rubric-qualified system prompts | Instructional framing, self-checks |
| `backend/courtroom.py` | Dependency chain + `call_gateway()` | `asyncio.gather`, typed step I/O, `reasoning=` knob |
| `backend/main.py` | FastAPI with per-phase endpoints | Clean API boundaries, error handling |
| `backend/pyproject.toml` | uv project file | Session 5 package management |
| `idea_courtroom_gateway.jsx` | React frontend → FastAPI → gateway | Progressive UI, parallel phase display |
| `idea_courtroom.jsx` | Claude.ai artifact (Anthropic API) | Quick demo, no setup required |

---

## Key Takeaways

1. **The dependency chain IS the architecture.** What runs first, what runs second, and what depends on what is not incidental — it's the design.

2. **Structured output is not a nice-to-have.** Every LLM output is validated before it becomes the next step's input. One bad output raises a clean `ValidationError`, not a corrupted reasoning chain.

3. **The session's concepts are language-agnostic.** `Promise.all` in the React frontend mirrors `asyncio.gather` in the backend. A JSON schema in a prompt is a Pydantic `BaseModel`. The patterns transfer across languages.

4. **The gateway is the right abstraction.** The React frontend doesn't know or care which LLM provider answered — it just receives validated JSON from the backend. Swap Groq for Gemini in the gateway config, nothing else changes.
