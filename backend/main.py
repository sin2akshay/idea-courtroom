"""
main.py — FastAPI backend for The Idea Courtroom

Exposes both:
  - /api/trial         — runs all 4 phases, returns complete result (simpler)
  - /api/phase1        — Advocate + Prosecutor in parallel  ┐
  - /api/phase2        — Strategist                         ├ per-phase for progressive UI
  - /api/phase3        — Judge                              ┘

Setup:
  1. Start llm_gatewayV2:   cd path/to/llm_gatewayV2 && python main.py
  2. Start this backend:    cd backend && uv run uvicorn main:app --reload --port 8200
  3. Open the React app:    open idea_courtroom_gateway.jsx in Claude or run your React dev server
"""

import asyncio
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from schemas import (
    AdvocacyCase,
    ProsecutionCase,
    StrategicAnalysis,
    FinalVerdict,
    Phase1Request,
    Phase2Request,
    Phase3Request,
    TrialRequest,
)
from courtroom import run_phase1, run_strategist, run_judge, run_full_trial


# ── Startup check ──────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Verify llm_gatewayV2 is reachable on startup."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get("http://localhost:8100/v1/capabilities")
            if r.status_code == 200:
                caps = r.json()
                print(f"✓ llm_gatewayV2 connected — providers: {caps.get('providers', 'unknown')}")
            else:
                print(f"⚠ llm_gatewayV2 responded with status {r.status_code}")
    except Exception:
        print("⚠ llm_gatewayV2 not reachable at http://localhost:8100")
        print("  Start it with: cd llm_gatewayV2 && python main.py")
    yield


app = FastAPI(
    title="The Idea Courtroom",
    description="A multi-step reasoning agent built on llm_gatewayV2",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the React frontend (any localhost port during development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "idea-courtroom-backend"}


# ── Per-phase endpoints (progressive UI) ───────────────────────────────────────

@app.post("/api/phase1")
async def phase1(request: Phase1Request) -> dict:
    """
    Phase 1 — Advocate + Prosecutor in PARALLEL.
    Session 5 pattern: asyncio.gather (equivalent to asyncio.TaskGroup).
    Both voices depend only on the raw idea — no prior outputs needed.
    """
    try:
        advocacy, prosecution = await run_phase1(request.idea)
        return {
            "advocacy": advocacy.model_dump(),
            "prosecution": prosecution.model_dump(),
        }
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Cannot reach llm_gatewayV2 at localhost:8100. Is it running?",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/phase2")
async def phase2(request: Phase2Request) -> dict:
    """
    Phase 2 — Strategist.
    Session 5 pattern: sequential step that receives typed Phase 1 outputs.
    Cannot run until Phase 1 is complete — dependency enforced by request shape.
    """
    try:
        strategy = await run_strategist(
            idea=request.idea,
            advocacy=request.advocacy,
            prosecution=request.prosecution,
        )
        return {"strategy": strategy.model_dump()}
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Cannot reach llm_gatewayV2 at localhost:8100. Is it running?",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/phase3")
async def phase3(request: Phase3Request) -> dict:
    """
    Phase 3 — Judge (Verifier).
    Session 5 pattern: verifier with reasoning="high" that receives all prior typed outputs.
    response_format uses FinalVerdict.model_json_schema() — one source of truth.
    """
    try:
        verdict = await run_judge(
            idea=request.idea,
            advocacy=request.advocacy,
            prosecution=request.prosecution,
            strategy=request.strategy,
        )
        return {"verdict": verdict.model_dump()}
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Cannot reach llm_gatewayV2 at localhost:8100. Is it running?",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Full trial endpoint (single call, all 4 phases) ───────────────────────────

@app.post("/api/trial")
async def full_trial(request: TrialRequest) -> dict:
    """
    Runs all 4 phases in the correct dependency order and returns the complete result.
    Use this for a simpler integration or for testing. The frontend uses /api/phase1-3
    for progressive UI updates.
    """
    try:
        return await run_full_trial(request.idea)
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Cannot reach llm_gatewayV2 at localhost:8100. Is it running?",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
