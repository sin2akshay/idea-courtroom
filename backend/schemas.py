"""
schemas.py — Pydantic models for The Idea Courtroom

Session 5 pattern: one BaseModel per LLM boundary.
The same class:
  - Validates the model's output at runtime
  - Generates the JSON Schema that llm_gatewayV2's response_format expects
  - Round-trips through JSON without a custom parser
"""

from typing import Literal
from pydantic import BaseModel, Field


class AdvocacyCase(BaseModel):
    """Output schema for The Advocate — builds the strongest case FOR the idea."""
    problem: str = Field(description="The real, painful problem this solves and who feels it")
    audience: str = Field(description="The specific persona — not a vague market segment")
    timing: str = Field(description="Why this moment is the right one — the specific shift")
    wedge: str = Field(description="The narrow entry point — the exact first 100 users")
    unfair_advantage: str = Field(description="What makes this structurally defensible against competition")
    strongest_signal: str = Field(description="One sentence: the most compelling point for the idea")


class ProsecutionCase(BaseModel):
    """Output schema for The Prosecutor — finds every reason the idea will fail."""
    hidden_assumption: str = Field(description="The falsifiable assumption the founder hasn't noticed")
    market_reality: str = Field(description="Competitive landscape and prior attempts — why hasn't this won")
    execution_risk: str = Field(description="The hardest part of shipping and growing this specifically")
    killer_question: str = Field(description="The one yes/no question where 'no' is fatal")
    biggest_flaw: str = Field(description="One sentence: the most damning point against the idea")


class StrategicAnalysis(BaseModel):
    """Output schema for The Strategist — finds the smarter version of the idea."""
    pivot: str = Field(description="The adjacent idea that keeps strengths but dodges the worst risks")
    wedge_sharpening: str = Field(description="How to make the entry point 10x more specific")
    sequence: str = Field(description="What must be proven first — the keystone assumption")
    cheapest_test: str = Field(description="Validation experiment under ₹10,000 / $100 in under 7 days")
    key_insight: str = Field(description="The one insight that changes how someone thinks about this idea")


class FinalVerdict(BaseModel):
    """Output schema for The Judge — the structured verdict with a conviction score."""
    conviction_score: int = Field(ge=0, le=10, description="0–10, calibrated like a top-tier VC partner")
    recommended_path: Literal["PROCEED", "PIVOT", "PASS"] = Field(
        description="PROCEED = viable as-is, PIVOT = use strategist's alternative, PASS = kill it"
    )
    strongest_signal: str = Field(description="The single most compelling evidence FOR this idea")
    biggest_risk: str = Field(description="The specific thing that could actually kill this idea")
    next_action: str = Field(description="One concrete, specific action to take in the next 7 days")
    one_line_pitch: str = Field(description="Format: [Audience] can now [do X] without [old painful alternative]")


# ── Request/Response wrappers for the API ──────────────────────────────────────

class TrialRequest(BaseModel):
    idea: str = Field(min_length=20, description="The idea to put on trial")


class Phase1Request(BaseModel):
    idea: str


class Phase2Request(BaseModel):
    idea: str
    advocacy: AdvocacyCase
    prosecution: ProsecutionCase


class Phase3Request(BaseModel):
    idea: str
    advocacy: AdvocacyCase
    prosecution: ProsecutionCase
    strategy: StrategicAnalysis
