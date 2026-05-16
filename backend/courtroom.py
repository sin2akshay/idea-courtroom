"""
courtroom.py — The 4-phase reasoning chain using llm_gatewayV2

Session 5 patterns implemented here:
  - Dependency-aware multi-step planning (Phase 1 parallel → Phase 2 → Phase 3)
  - Pydantic structured output on every LLM boundary
  - reasoning knob ("medium" for analysis, "high" for the Judge/verifier)
  - cache_system=True to cache stable system prompts across calls
  - asyncio parallel dispatch via asyncio.gather (mirrors asyncio.TaskGroup)

HOW llm_gatewayV2 IS CALLED:
  - Endpoint: POST http://localhost:8100/v1/chat/completions
  - It's an OpenAI-style API (single unified interface to 7 free providers)
  - Extra V2 params: reasoning, cache_system (translated per provider by the gateway)
  - response_format with json_schema returns a parsed dict at reply["parsed"]

ALTERNATIVE (Rohan's Python client):
  from client import LLM          # copy client.py from llm_gatewayV2/ to this dir
  llm = LLM()
  reply = llm.chat(
      system=SYSTEM_PROMPT,
      prompt=USER_MSG,
      cache_system=True,
      reasoning="medium",
      response_format={
          "type": "json_schema",
          "schema": MyModel.model_json_schema(),
          "name": "MyModel",
          "strict": True,
      }
  )
  result = MyModel.model_validate(reply["parsed"])
"""

import asyncio
import json
import httpx
from pydantic import BaseModel

from schemas import AdvocacyCase, ProsecutionCase, StrategicAnalysis, FinalVerdict
from prompts import ADVOCATE_PROMPT, PROSECUTOR_PROMPT, STRATEGIST_PROMPT, JUDGE_PROMPT

GATEWAY_URL = "http://localhost:8100/v1/chat/completions"
GATEWAY_TIMEOUT = 90.0  # seconds — gateway may need time to failover across providers


async def call_gateway(
    system_prompt: str,
    user_message: str,
    response_model: type[BaseModel],
    reasoning: str = "medium",
    cache_system: bool = True,
) -> dict:
    """
    Single entry point for all llm_gatewayV2 calls.

    Returns the parsed dict from the gateway's structured output.
    The caller validates it into a Pydantic model.

    Mirrors the Session 5 pattern:
        reply = llm.chat(prompt=..., response_format={...})
        result = MyModel.model_validate(reply["parsed"])
    """
    payload = {
        "model": "auto",  # gateway selects best available provider
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "response_format": {
            "type": "json_schema",
            "schema": response_model.model_json_schema(),
            "name": response_model.__name__,
            "strict": True,
        },
        "reasoning": reasoning,       # V2 extension: "off"|"low"|"medium"|"high"
        "cache_system": cache_system, # V2 extension: cache stable system prompts
        "max_tokens": 2000,
    }

    async with httpx.AsyncClient(timeout=GATEWAY_TIMEOUT) as client:
        response = await client.post(GATEWAY_URL, json=payload)
        response.raise_for_status()

    data = response.json()

    # Gateway returns parsed dict for json_schema response_format
    # Try reply["parsed"] first (gateway-specific), fall back to parsing content
    choice = data["choices"][0]["message"]

    if "parsed" in choice and choice["parsed"] is not None:
        return choice["parsed"]

    # Fallback: parse content string (some providers return raw JSON string)
    content = choice.get("content", "")
    if isinstance(content, dict):
        return content
    # Strip markdown fences if present
    clean = content.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
    start = clean.find("{")
    end = clean.rfind("}")
    if start != -1 and end != -1:
        clean = clean[start:end + 1]
    return json.loads(clean)


# ── The four voices ────────────────────────────────────────────────────────────

async def run_advocate(idea: str) -> AdvocacyCase:
    """Phase 1 — no dependencies, runs in parallel with Prosecutor."""
    raw = await call_gateway(
        system_prompt=ADVOCATE_PROMPT,
        user_message=f"IDEA UNDER TRIAL:\n\n{idea}",
        response_model=AdvocacyCase,
        reasoning="medium",
    )
    return AdvocacyCase.model_validate(raw)


async def run_prosecutor(idea: str) -> ProsecutionCase:
    """Phase 1 — no dependencies, runs in parallel with Advocate."""
    raw = await call_gateway(
        system_prompt=PROSECUTOR_PROMPT,
        user_message=f"IDEA UNDER TRIAL:\n\n{idea}",
        response_model=ProsecutionCase,
        reasoning="medium",
    )
    return ProsecutionCase.model_validate(raw)


async def run_strategist(
    idea: str,
    advocacy: AdvocacyCase,
    prosecution: ProsecutionCase,
) -> StrategicAnalysis:
    """Phase 2 — depends on Phase 1 outputs (both Advocate and Prosecutor)."""
    context = (
        f"IDEA UNDER TRIAL:\n{idea}\n\n"
        f"--- ADVOCATE'S CASE ---\n{advocacy.model_dump_json(indent=2)}\n\n"
        f"--- PROSECUTOR'S CASE ---\n{prosecution.model_dump_json(indent=2)}"
    )
    raw = await call_gateway(
        system_prompt=STRATEGIST_PROMPT,
        user_message=context,
        response_model=StrategicAnalysis,
        reasoning="medium",
    )
    return StrategicAnalysis.model_validate(raw)


async def run_judge(
    idea: str,
    advocacy: AdvocacyCase,
    prosecution: ProsecutionCase,
    strategy: StrategicAnalysis,
) -> FinalVerdict:
    """Phase 3 — depends on all three prior outputs. Uses high reasoning (verifier role)."""
    context = (
        f"IDEA UNDER TRIAL:\n{idea}\n\n"
        f"--- ADVOCATE ---\n{advocacy.model_dump_json(indent=2)}\n\n"
        f"--- PROSECUTOR ---\n{prosecution.model_dump_json(indent=2)}\n\n"
        f"--- STRATEGIST ---\n{strategy.model_dump_json(indent=2)}"
    )
    raw = await call_gateway(
        system_prompt=JUDGE_PROMPT,
        user_message=context,
        response_model=FinalVerdict,
        reasoning="high",  # Judge is the verifier — highest reasoning budget
    )
    return FinalVerdict.model_validate(raw)


# ── Phase orchestration ────────────────────────────────────────────────────────

async def run_phase1(idea: str) -> tuple[AdvocacyCase, ProsecutionCase]:
    """
    Phase 1: Advocate + Prosecutor in PARALLEL.
    asyncio.gather mirrors asyncio.TaskGroup from agent5.py.
    No dependency between these two — they both only need the raw idea.
    """
    advocacy, prosecution = await asyncio.gather(
        run_advocate(idea),
        run_prosecutor(idea),
    )
    return advocacy, prosecution


async def run_full_trial(idea: str) -> dict:
    """
    Run the complete 4-phase courtroom trial.
    Returns a dict of all four outputs for serialization.

    Dependency chain:
        Phase 1: advocate || prosecutor  (parallel)
        Phase 2: strategist             (depends on Phase 1)
        Phase 3: judge                  (depends on Phases 1 + 2)
    """
    # Phase 1 — parallel dispatch
    advocacy, prosecution = await run_phase1(idea)

    # Phase 2 — sequential (waits for Phase 1)
    strategy = await run_strategist(idea, advocacy, prosecution)

    # Phase 3 — sequential (waits for Phases 1 + 2)
    verdict = await run_judge(idea, advocacy, prosecution, strategy)

    return {
        "advocacy": advocacy.model_dump(),
        "prosecution": prosecution.model_dump(),
        "strategy": strategy.model_dump(),
        "verdict": verdict.model_dump(),
    }
