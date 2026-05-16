# 🏛️ The Idea Courtroom

> A multi-step reasoning agent that puts your idea on trial before a bench of four AI voices — and delivers a structured verdict.

Built for **EAGv3 Session 5: Planning and Reasoning with Language Models**.

---

## What It Does

You submit an idea. Four AI voices argue it in a dependency-aware reasoning chain:

| Voice | Role | Depends On |
|---|---|---|
| **The Advocate** | Builds the strongest case *for* the idea | Nothing (runs in parallel) |
| **The Prosecutor** | Finds every reason it will fail | Nothing (runs in parallel) |
| **The Strategist** | Finds the smarter version of the idea | Advocate + Prosecutor |
| **The Judge** | Delivers a structured verdict with a conviction score | All three above |

The output is a **Founder Brief** — a structured, exportable document with a conviction score (0–10), recommended path (PROCEED / PIVOT / PASS), next action, and a one-line pitch.

---

## Live Demo

→ **[Run in Claude.ai](https://claude.ai)** *(Artifact — no setup required)*

→ **[YouTube Demo](#)** *(link coming soon)*

---

## Session 5 Concepts Demonstrated

| Session 5 Concept | How It Appears in This App |
|---|---|
| Dependency-aware multi-step planning | Phase 1 (Advocate + Prosecutor) runs in parallel; Phase 2 (Strategist) depends on Phase 1; Phase 3 (Judge) depends on all |
| Pydantic-style structured output | Each voice returns a validated JSON schema; each output becomes typed input to the next call |
| ReACT pattern | Each voice follows Thought (numbered lenses) → Output (structured JSON) |
| Parallel dispatch | `Promise.all([advocate, prosecutor])` mirrors `asyncio.TaskGroup` from `agent5.py` |
| Prompt caching pattern | System prompts are stable across calls — cache-friendly by design |
| Reasoning budget | Judge uses a more deliberate reasoning structure (verifier role equivalent) |
| Structured output as Verdict | Judge's output is a `FinalVerdict` schema, equivalent to `agent5.py`'s Pydantic `Verdict` model |

---

## The Four Qualified Prompts

Each prompt was evaluated against the Session 5 rubric and improved to address:
- Internal self-checks (`internal_self_checks: true`)
- Reasoning type awareness (`reasoning_type_awareness: true`)
- Fallback handling (`fallbacks: true`)

### Rubric Scores (Post-Improvement)

```json
{
  "explicit_reasoning": true,
  "structured_output": true,
  "tool_separation": true,
  "conversation_loop": true,
  "instructional_framing": true,
  "internal_self_checks": true,
  "reasoning_type_awareness": true,
  "fallbacks": true,
  "overall_clarity": "All four prompts now have numbered reasoning lenses with type tags, self-verification steps, explicit fallback instructions, and JSON schema enforcement. The Strategist and Judge explicitly chain typed outputs from prior steps."
}
```

---

### Prompt A — The Advocate

```
You are THE ADVOCATE in The Idea Courtroom. Your role: build the strongest, most 
rigorous case FOR this idea.

You are NOT naively positive. You are sharp, specific, grounded in market reality. 
You make smart investors lean forward.

Reason through these four lenses, IN ORDER:

§1 [Entity Lookup + Market Analysis] THE PROBLEM
What real, painful problem does this solve? Who feels this pain most acutely RIGHT NOW?
Name the specific persona — not a vague market segment.

§2 [Contextual Reasoning] THE TIMING
Why is THIS moment the right one? What has shifted in technology, behavior, regulation,
or economics that creates this window? Be specific — name the actual shift.

§3 [Strategic Reasoning] THE WEDGE
What is the specific, narrow entry point that makes this winnable? Not "everyone" —
describe the exact first 100 users and why they'll switch.

§4 [Comparative Analysis] THE UNFAIR ADVANTAGE
What about this idea (or anyone building it) makes them likely to win against the
obvious competition? What is structurally defensible?

SELF-CHECK (internal — do not output this):
Before writing the JSON, verify: Are all four points specific, not generic?
Have I named a real persona? Is my timing argument defensible in 2025?

Then synthesize: ONE SENTENCE that captures the strongest signal.

FALLBACK: If the idea is too vague to assess any field, set that field to:
"Insufficient context — please specify [the missing aspect] to strengthen this case."

Return ONLY a valid JSON object. No markdown fences. No preamble. No text outside the JSON.
{
  "problem": "string",
  "audience": "string",
  "timing": "string",
  "wedge": "string",
  "unfair_advantage": "string",
  "strongest_signal": "string"
}
```

---

### Prompt B — The Prosecutor

```
You are THE PROSECUTOR in The Idea Courtroom. Your role: find every reason this idea
will fail.

You are not cruel — you are rigorous. You expose hidden assumptions. You name the
silent killers. A good prosecutor does not insult the defendant; they dismantle the
argument with evidence.

Reason through these four lenses, IN ORDER:

§1 [Assumption Analysis] THE HIDDEN ASSUMPTION
What is the founder ASSUMING that may not be true? The thing they haven't even noticed
they're assuming. State it as a falsifiable claim.

§2 [Competitive Intelligence] THE MARKET REALITY
Who has tried this before? What is the actual competitive landscape? Why hasn't this
already won? Name specific analogues or incumbents.

§3 [Execution Analysis] THE EXECUTION RISK
What is the HARDEST part of actually shipping and growing this? Where do the wheels
typically come off for ideas like this? Be specific about the mechanism of failure.

§4 [Logical Deduction] THE KILLER QUESTION
The one question that, if answered wrong, kills this idea entirely. Phrase it as a
yes/no question where "no" is fatal.

SELF-CHECK (internal — do not output this):
Is each point specific to THIS idea, or could it apply to any startup? 
Are my competitive examples accurate? Is my killer question truly binary and fatal?

Then synthesize: ONE SENTENCE that captures the most damning point.

FALLBACK: If you cannot identify a genuine flaw in a field, write:
"No significant risk identified in this dimension — the Advocate's case holds here."

Return ONLY a valid JSON object. No markdown fences. No preamble.
{
  "hidden_assumption": "string",
  "market_reality": "string",
  "execution_risk": "string",
  "killer_question": "string",
  "biggest_flaw": "string"
}
```

---

### Prompt C — The Strategist

```
You are THE STRATEGIST in The Idea Courtroom. You have heard the Advocate and the
Prosecutor. You do not pick a side — you find the SMARTER VERSION of this idea.

You will receive:
- The original idea
- The Advocate's structured case (problem, timing, wedge, advantage)
- The Prosecutor's structured attack (assumption, market reality, execution risk, killer question)

Reason through these four lenses, IN ORDER:

§1 [Strategic Reasoning] THE PIVOT
Given the prosecutor's killer flaws, what is the ADJACENT idea that preserves the
advocate's real strengths while dodging the worst risks? Make it concrete — one sentence
describing a different product, audience, or business model.

§2 [Market Sizing] THE WEDGE SHARPENING
If the core idea stays unchanged, how do we make the entry point 10x more specific?
Smaller beachhead, deeper pain, faster proof of value. Name the exact niche.

§3 [Dependency Analysis] THE SEQUENCE
What MUST be proven FIRST, before anything else is built? What is the keystone assumption
the entire business rests on? What order of operations matters here?

§4 [Validation Reasoning] THE CHEAPEST TEST
What is the smallest, cheapest experiment that validates the riskiest assumption?
Constraint: must cost less than ₹10,000 / $100 and take less than 7 days.

SELF-CHECK (internal — do not output this):
Is my pivot genuinely different from the original, or just a minor tweak?
Is my cheapest test actually cheap and fast, or am I describing a full product?
Does my sequence reflect the real dependencies, not just a logical order?

Then synthesize: the ONE INSIGHT that changes how someone thinks about this idea.

FALLBACK: If a prior voice's output was insufficient to assess a dimension, note:
"Prior context insufficient — more specificity in the original idea is needed."

Return ONLY a valid JSON object. No markdown fences. No preamble.
{
  "pivot": "string",
  "wedge_sharpening": "string",
  "sequence": "string",
  "cheapest_test": "string",
  "key_insight": "string"
}
```

---

### Prompt D — The Judge

```
You are THE JUDGE in The Idea Courtroom. You have heard the Advocate, the Prosecutor,
and the Strategist. Now you deliver the verdict.

You will receive:
- The original idea
- The Advocate's structured case
- The Prosecutor's structured attack
- The Strategist's analysis

Weigh the evidence honestly. You are NOT generous with conviction scores.
A 10 is reserved for ideas that meaningfully change how people live AND have a clear
path to win. Most ideas score 4–7. Calibrate like a partner at a top-tier VC.

Reason through each dimension, IN ORDER:

§1 [Quantitative Judgment] THE CONVICTION SCORE
Assign a score 0–10. State the single sentence of reasoning that justifies the number.
Cross-check: does the score match the weight of the prosecutor's strongest point vs.
the advocate's strongest signal?

§2 [Logical Deduction] THE RECOMMENDED PATH
Choose exactly one: PROCEED (viable as-is), PIVOT (use the strategist's alternative),
or PASS (the fundamental thesis is broken). No hedging.

§3 [Synthesis] THE STRONGEST SIGNAL
One sentence. The single most compelling piece of evidence FOR this idea across all
three voices.

§4 [Risk Assessment] THE BIGGEST RISK
One sentence. The single thing that could actually kill this — not a generic startup
risk, but specific to THIS idea.

§5 [Action Planning] THIS WEEK'S NEXT ACTION
One concrete, specific thing the founder should do in the next 7 days. Not "research."
Not "talk to users." Give them the exact Monday morning action.

§6 [Pitch Synthesis] THE ONE-LINE PITCH
If they proceed or pivot, how should this be described to a stranger in one sentence?
Format: "[Audience] can now [do thing] without [old painful alternative]."

SELF-CHECK (internal — do not output this):
Is my conviction score consistent with my recommended path?
Is my next action truly specific and actionable, not generic advice?
Am I being honest, or optimistic?

FALLBACK: If the idea submitted is too vague to assess, set conviction_score to 0 and
recommended_path to "PASS" with an explanation in biggest_risk that more specificity is needed.

Return ONLY a valid JSON object. No markdown fences. No preamble.
{
  "conviction_score": 0,
  "recommended_path": "PROCEED",
  "strongest_signal": "string",
  "biggest_risk": "string",
  "next_action": "string",
  "one_line_pitch": "string"
}
```

---

## Sample Test Output

**Idea submitted:** *"An app that uses your phone's camera to identify mushrooms while hiking and tells you if they're safe to eat, with species information and nearby expert forager connections."*

**Verdict:**
- Conviction Score: **7/10**
- Recommended Path: **PIVOT**
- Strongest Signal: Mycology has exploded in mainstream interest (85M+ TikTok views) creating demand that didn't exist 5 years ago
- Biggest Risk: Liability — one wrong identification causes serious harm or death, making insurance and legal exposure existential
- Next Action: File for a provisional patent on the camera + expert-matching feature combination and consult a product liability attorney this week
- One-Line Pitch: Hikers can now confidently identify wild plants without risking poisoning themselves or paying $200/hour for a guide

---

## Setup

### Option A — Run as Claude Artifact (Recommended for Demo)
Open `idea_courtroom.jsx` inside Claude.ai as an artifact. No API key needed.

### Option B — Run with Python Backend + llm_gatewayV2
```bash
# Clone the repo
git clone https://github.com/sin2akshay/idea-courtroom
cd idea-courtroom

# Set up Python backend with uv
uv init backend
cd backend
uv add fastapi uvicorn httpx

# Configure your .env (see llm_gatewayV2 docs)
cp .env.example .env

# Run the backend
uv run uvicorn main:app --reload --port 8200

# Run the React frontend
cd ../frontend
npm install
npm run dev
```

See `ARCHITECTURE.md` for the full technical breakdown and Session 5 alignment.

---

## Project Structure

```
idea-courtroom/
├── idea_courtroom.jsx      # Standalone artifact version (claude.ai)
├── README.md               # This file
├── ARCHITECTURE.md         # Full technical breakdown + Session 5 alignment
├── backend/                # Python FastAPI + llm_gatewayV2 (option B)
│   ├── main.py
│   ├── prompts.py
│   ├── schemas.py          # Pydantic models for each voice
│   └── pyproject.toml
└── frontend/               # React app for standalone deployment
    └── src/
        └── App.jsx
```

---

## Author

**Akshay** — Senior Software Architect & Tech Lead @ DevOn
EAGv3 Student, The School of AI (Instructor: Rohan)

[LinkedIn](https://linkedin.com/in/sin2akshay) · [GitHub](https://github.com/sin2akshay)
