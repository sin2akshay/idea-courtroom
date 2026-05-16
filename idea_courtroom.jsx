import React, { useState, useEffect } from 'react';

// ============================================================
// THE IDEA COURTROOM
// A multi-step reasoning agent built on Session 5 patterns:
// - Dependency-aware chain (parallel Phase 1, sequential Phase 2 + 3)
// - Pydantic-style structured output on every boundary
// - Each step's typed output becomes the next step's input
// ============================================================

const COLORS = {
  bg: '#F4EFE6',
  paper: '#FAF6EE',
  ink: '#1A1614',
  muted: '#6B6259',
  rule: '#D4CCC0',
  advocate: '#1F4332',
  prosecutor: '#8B1A1A',
  strategist: '#8B5A00',
  judge: '#1A1614',
  proceed: '#1F4332',
  pivot: '#8B5A00',
  pass: '#8B1A1A',
};

const FONTS = {
  display: '"DM Serif Display", Georgia, serif',
  body: '"Crimson Pro", Georgia, serif',
  mono: '"JetBrains Mono", "Courier New", monospace',
};

// ============================================================
// PROMPTS — One source of truth per voice
// ============================================================

const ADVOCATE_PROMPT = `You are THE ADVOCATE in The Idea Courtroom. Your role: build the strongest, most rigorous case FOR this idea.

You are NOT naively positive. You are sharp, specific, grounded in market reality. You make smart investors lean forward.

Reason through these four lenses, in order:

1. THE PROBLEM — What real, painful problem does this solve? Who feels this pain most acutely RIGHT NOW? Be specific — name the persona.
2. THE TIMING — Why is THIS moment the right one? What has shifted in technology, behavior, regulation, or economics that creates this window?
3. THE WEDGE — What is the specific, narrow entry point that makes this winnable? Not "everyone" — the exact first 100 users.
4. THE UNFAIR ADVANTAGE — What about this idea (or anyone building it) makes them likely to win against obvious competition?

Then synthesize: ONE SENTENCE that captures the strongest signal.

Return ONLY a valid JSON object (no markdown fences, no preamble, no explanation outside JSON) matching this exact schema:
{
  "problem": "string",
  "audience": "string",
  "timing": "string",
  "wedge": "string",
  "unfair_advantage": "string",
  "strongest_signal": "string"
}`;

const PROSECUTOR_PROMPT = `You are THE PROSECUTOR in The Idea Courtroom. Your role: find every reason this idea will fail.

You are not cruel — you are rigorous. You expose hidden assumptions. You name the silent killers. A good prosecutor doesn't insult the defendant; they dismantle the argument with evidence.

Reason through these four lenses, in order:

1. THE HIDDEN ASSUMPTION — What is the founder ASSUMING that may not be true? The thing they haven't even noticed they're assuming.
2. THE MARKET REALITY — Who has tried this before? What is the actual competitive landscape? Why hasn't this already won?
3. THE EXECUTION RISK — What is the HARDEST part of actually shipping and growing this? Where do the wheels typically come off?
4. THE KILLER QUESTION — The one question that, if answered wrong, kills this idea entirely.

Then synthesize: ONE SENTENCE that captures the most damning point.

Return ONLY a valid JSON object (no markdown fences, no preamble) matching this schema:
{
  "hidden_assumption": "string",
  "market_reality": "string",
  "execution_risk": "string",
  "killer_question": "string",
  "biggest_flaw": "string"
}`;

const STRATEGIST_PROMPT = `You are THE STRATEGIST in The Idea Courtroom. You have heard both the Advocate and the Prosecutor. You do not pick a side — you find the SMARTER VERSION of the idea.

You think like a seasoned operator who has built and sold companies. Reason through:

1. THE PIVOT — Given the killer flaws, what is the ADJACENT idea that keeps the real strengths but dodges the worst risks?
2. THE WEDGE SHARPENING — If the core idea stays, how do we make the entry point 10x sharper? Smaller market, deeper pain, faster proof.
3. THE SEQUENCE — What MUST be built/proven FIRST, before anything else? What's the keystone move?
4. THE CHEAPEST TEST — What is the smallest, cheapest experiment that validates the riskiest assumption? It should cost less than $100 and take less than 1 week.

Then synthesize: the ONE INSIGHT that changes everything.

Return ONLY a valid JSON object (no markdown fences, no preamble) matching this schema:
{
  "pivot": "string",
  "wedge_sharpening": "string",
  "sequence": "string",
  "cheapest_test": "string",
  "key_insight": "string"
}`;

const JUDGE_PROMPT = `You are THE JUDGE in The Idea Courtroom. You have heard the Advocate, the Prosecutor, and the Strategist. Now you deliver the verdict.

You weigh the evidence honestly. You are not generous with conviction scores — a 10 is reserved for ideas that meaningfully change how people live or work AND have a clear path to win. Most ideas score 4-7. Be calibrated.

Deliver your verdict by reasoning through:

1. THE CONVICTION SCORE — 0 to 10. Honest, not generous. Reference how a top investor would score it.
2. THE RECOMMENDED PATH — Exactly one of: "PROCEED" (solid as-is), "PIVOT" (use the Strategist's pivot), or "PASS" (kill it).
3. THE STRONGEST SIGNAL — One sentence. Most compelling thing about this idea.
4. THE BIGGEST RISK — One sentence. The thing that could actually kill it.
5. THIS WEEK'S NEXT ACTION — One concrete thing the founder should do in the next 7 days. Not "research" — something specific they can do Monday morning.
6. THE ONE-LINE PITCH — If they proceed, how to pitch it in one sentence to a stranger.

Return ONLY a valid JSON object (no markdown fences, no preamble) matching this schema:
{
  "conviction_score": 0,
  "recommended_path": "PROCEED",
  "strongest_signal": "string",
  "biggest_risk": "string",
  "next_action": "string",
  "one_line_pitch": "string"
}`;

// ============================================================
// JSON parsing — robust to fenced output
// ============================================================

const parseJSON = (text) => {
  let clean = text.trim();
  clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    clean = clean.substring(start, end + 1);
  }
  return JSON.parse(clean);
};

// ============================================================
// LLM call — single entry point for every voice
// ============================================================

const callClaude = async (systemPrompt, userMessage) => {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API ${response.status}: ${errText.slice(0, 200)}`);
  }
  const data = await response.json();
  const text = data.content.map(c => c.text || '').join('');
  return parseJSON(text);
};

// ============================================================
// UI COMPONENTS
// ============================================================

const SectionRule = ({ color = COLORS.rule }) => (
  <div style={{ height: 1, background: color, margin: '0' }} />
);

const Label = ({ children, color = COLORS.muted }) => (
  <div style={{
    fontFamily: FONTS.mono,
    fontSize: '10px',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color,
    marginBottom: '6px',
  }}>{children}</div>
);

const LoadingDots = ({ color }) => (
  <span style={{ display: 'inline-block', color, fontFamily: FONTS.mono }}>
    <span style={{ animation: 'pulse 1.4s infinite', animationDelay: '0s' }}>·</span>
    <span style={{ animation: 'pulse 1.4s infinite', animationDelay: '0.2s' }}>·</span>
    <span style={{ animation: 'pulse 1.4s infinite', animationDelay: '0.4s' }}>·</span>
  </span>
);

const LoadingCard = ({ exhibit, title, role, color }) => (
  <article style={{
    background: COLORS.paper,
    borderLeft: `3px solid ${color}`,
    padding: '32px 36px',
    marginBottom: '24px',
    animation: 'fadeIn 0.5s ease-out',
  }}>
    <Label color={color}>EXHIBIT {exhibit} · {title}</Label>
    <div style={{
      fontFamily: FONTS.display,
      fontSize: '28px',
      color: COLORS.ink,
      marginTop: '4px',
      marginBottom: '8px',
    }}>{role}</div>
    <div style={{ fontFamily: FONTS.body, fontStyle: 'italic', color: COLORS.muted, marginBottom: '20px' }}>
      Preparing argument <LoadingDots color={color} />
    </div>
    {[1, 2, 3, 4].map(i => (
      <div key={i} style={{
        height: '14px',
        background: COLORS.rule,
        opacity: 0.5,
        marginBottom: '10px',
        width: `${85 - i * 8}%`,
        animation: `shimmer 1.8s infinite`,
        animationDelay: `${i * 0.15}s`,
      }} />
    ))}
  </article>
);

const VoiceCard = ({ exhibit, title, role, color, fields, data, signalLabel, signalKey }) => (
  <article style={{
    background: COLORS.paper,
    borderLeft: `3px solid ${color}`,
    padding: '32px 36px',
    marginBottom: '24px',
    animation: 'slideUp 0.6s ease-out',
  }}>
    <Label color={color}>EXHIBIT {exhibit} · {title}</Label>
    <div style={{
      fontFamily: FONTS.display,
      fontSize: '28px',
      color: COLORS.ink,
      marginTop: '4px',
      marginBottom: '24px',
      letterSpacing: '-0.01em',
    }}>{role}</div>

    {fields.map((f, idx) => (
      <div key={f.key} style={{ marginBottom: '22px' }}>
        <Label color={color}>{`§ ${idx + 1}  ${f.label}`}</Label>
        <div style={{
          fontFamily: FONTS.body,
          fontSize: '17px',
          lineHeight: 1.55,
          color: COLORS.ink,
        }}>{data[f.key]}</div>
      </div>
    ))}

    <div style={{
      marginTop: '28px',
      paddingTop: '24px',
      borderTop: `1px solid ${COLORS.rule}`,
    }}>
      <Label color={color}>{signalLabel}</Label>
      <div style={{
        fontFamily: FONTS.display,
        fontSize: '22px',
        lineHeight: 1.35,
        color,
        fontStyle: 'italic',
      }}>"{data[signalKey]}"</div>
    </div>
  </article>
);

const VerdictCard = ({ verdict, onExport }) => {
  const pathColor = verdict.recommended_path === 'PROCEED' ? COLORS.proceed
    : verdict.recommended_path === 'PIVOT' ? COLORS.pivot
    : COLORS.pass;

  return (
    <article style={{
      background: COLORS.ink,
      color: COLORS.bg,
      padding: '48px 44px',
      marginBottom: '24px',
      animation: 'slideUp 0.7s ease-out',
      position: 'relative',
    }}>
      <Label color={COLORS.bg}>FINAL VERDICT · DELIVERED BY THE BENCH</Label>

      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginTop: '8px',
        marginBottom: '32px',
        flexWrap: 'wrap',
        gap: '20px',
      }}>
        <div>
          <div style={{
            fontFamily: FONTS.mono,
            fontSize: '11px',
            letterSpacing: '0.18em',
            opacity: 0.6,
            marginBottom: '6px',
          }}>CONVICTION SCORE</div>
          <div style={{
            fontFamily: FONTS.display,
            fontSize: '88px',
            lineHeight: 1,
            color: COLORS.bg,
          }}>
            {verdict.conviction_score}
            <span style={{ fontSize: '36px', opacity: 0.5 }}>/10</span>
          </div>
        </div>

        <div style={{
          padding: '14px 28px',
          background: pathColor,
          color: COLORS.bg,
          fontFamily: FONTS.display,
          fontSize: '32px',
          letterSpacing: '0.04em',
          border: `1px solid ${COLORS.bg}`,
        }}>
          {verdict.recommended_path}
        </div>
      </div>

      <SectionRule color={COLORS.muted} />

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '32px',
        marginTop: '28px',
        marginBottom: '28px',
      }}>
        <div>
          <Label color={COLORS.bg}>STRONGEST SIGNAL</Label>
          <div style={{ fontFamily: FONTS.body, fontSize: '17px', lineHeight: 1.5 }}>
            {verdict.strongest_signal}
          </div>
        </div>
        <div>
          <Label color={COLORS.bg}>BIGGEST RISK</Label>
          <div style={{ fontFamily: FONTS.body, fontSize: '17px', lineHeight: 1.5 }}>
            {verdict.biggest_risk}
          </div>
        </div>
      </div>

      <div style={{
        background: COLORS.bg,
        color: COLORS.ink,
        padding: '24px 28px',
        marginBottom: '24px',
      }}>
        <Label color={COLORS.ink}>THIS WEEK · NEXT ACTION</Label>
        <div style={{
          fontFamily: FONTS.display,
          fontSize: '22px',
          lineHeight: 1.4,
          color: COLORS.ink,
        }}>{verdict.next_action}</div>
      </div>

      <div>
        <Label color={COLORS.bg}>THE ONE-LINE PITCH</Label>
        <div style={{
          fontFamily: FONTS.display,
          fontSize: '24px',
          lineHeight: 1.4,
          fontStyle: 'italic',
          color: COLORS.bg,
        }}>"{verdict.one_line_pitch}"</div>
      </div>

      <div style={{ marginTop: '36px', textAlign: 'right' }}>
        <button onClick={onExport} style={{
          background: 'transparent',
          color: COLORS.bg,
          border: `1px solid ${COLORS.muted}`,
          padding: '10px 22px',
          fontFamily: FONTS.mono,
          fontSize: '11px',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}>Export Brief →</button>
      </div>
    </article>
  );
};

// ============================================================
// MAIN APP
// ============================================================

export default function IdeaCourtroom() {
  const [idea, setIdea] = useState('');
  const [phase, setPhase] = useState('idle');
  const [advocacy, setAdvocacy] = useState(null);
  const [prosecution, setProsecution] = useState(null);
  const [strategy, setStrategy] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [error, setError] = useState(null);
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Crimson+Pro:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
      @keyframes shimmer { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
    `;
    document.head.appendChild(style);
  }, []);

  const runTrial = async () => {
    if (!idea.trim() || idea.trim().length < 20) {
      setError('Please describe your idea in at least 20 characters. The more specific, the better the trial.');
      return;
    }
    setError(null);
    setAdvocacy(null);
    setProsecution(null);
    setStrategy(null);
    setVerdict(null);

    try {
      // Phase 1 — Advocate + Prosecutor in PARALLEL (no dependency)
      setPhase('phase1');
      const [adv, pros] = await Promise.all([
        callClaude(ADVOCATE_PROMPT, `IDEA UNDER TRIAL:\n\n${idea}`),
        callClaude(PROSECUTOR_PROMPT, `IDEA UNDER TRIAL:\n\n${idea}`),
      ]);
      setAdvocacy(adv);
      setProsecution(pros);

      // Phase 2 — Strategist (depends on Phase 1 output)
      setPhase('phase2');
      const strat = await callClaude(
        STRATEGIST_PROMPT,
        `IDEA UNDER TRIAL:\n${idea}\n\n--- ADVOCATE'S CASE ---\n${JSON.stringify(adv, null, 2)}\n\n--- PROSECUTOR'S CASE ---\n${JSON.stringify(pros, null, 2)}`
      );
      setStrategy(strat);

      // Phase 3 — Judge (depends on all three prior outputs)
      setPhase('phase3');
      const verd = await callClaude(
        JUDGE_PROMPT,
        `IDEA UNDER TRIAL:\n${idea}\n\n--- ADVOCATE ---\n${JSON.stringify(adv, null, 2)}\n\n--- PROSECUTOR ---\n${JSON.stringify(pros, null, 2)}\n\n--- STRATEGIST ---\n${JSON.stringify(strat, null, 2)}`
      );
      setVerdict(verd);

      setPhase('complete');
    } catch (e) {
      setError(`The court has encountered a technical issue: ${e.message}`);
      setPhase('error');
    }
  };

  const exportBrief = () => {
    const md = `# THE IDEA COURTROOM — VERDICT BRIEF

## The Idea Under Trial
${idea}

---

## ⚖️ VERDICT

**Conviction Score:** ${verdict.conviction_score}/10
**Recommended Path:** ${verdict.recommended_path}

**Strongest Signal:** ${verdict.strongest_signal}

**Biggest Risk:** ${verdict.biggest_risk}

**This Week's Next Action:** ${verdict.next_action}

**One-Line Pitch:** _"${verdict.one_line_pitch}"_

---

## 🟢 The Advocate's Case
- **Problem:** ${advocacy.problem}
- **Audience:** ${advocacy.audience}
- **Timing:** ${advocacy.timing}
- **Wedge:** ${advocacy.wedge}
- **Unfair Advantage:** ${advocacy.unfair_advantage}
- **Strongest Signal:** _${advocacy.strongest_signal}_

## 🔴 The Prosecutor's Case
- **Hidden Assumption:** ${prosecution.hidden_assumption}
- **Market Reality:** ${prosecution.market_reality}
- **Execution Risk:** ${prosecution.execution_risk}
- **Killer Question:** ${prosecution.killer_question}
- **Biggest Flaw:** _${prosecution.biggest_flaw}_

## 🟡 The Strategist's Analysis
- **Pivot:** ${strategy.pivot}
- **Wedge Sharpening:** ${strategy.wedge_sharpening}
- **Sequence:** ${strategy.sequence}
- **Cheapest Test:** ${strategy.cheapest_test}
- **Key Insight:** _${strategy.key_insight}_
`;
    navigator.clipboard.writeText(md);
    setCopyStatus('Brief copied to clipboard');
    setTimeout(() => setCopyStatus(''), 2500);
  };

  const advocateFields = [
    { key: 'problem', label: 'The Problem' },
    { key: 'audience', label: 'The Audience' },
    { key: 'timing', label: 'The Timing' },
    { key: 'wedge', label: 'The Wedge' },
    { key: 'unfair_advantage', label: 'The Unfair Advantage' },
  ];

  const prosecutorFields = [
    { key: 'hidden_assumption', label: 'The Hidden Assumption' },
    { key: 'market_reality', label: 'The Market Reality' },
    { key: 'execution_risk', label: 'The Execution Risk' },
    { key: 'killer_question', label: 'The Killer Question' },
  ];

  const strategistFields = [
    { key: 'pivot', label: 'The Pivot' },
    { key: 'wedge_sharpening', label: 'The Wedge Sharpening' },
    { key: 'sequence', label: 'The Sequence' },
    { key: 'cheapest_test', label: 'The Cheapest Test' },
  ];

  const isRunning = phase === 'phase1' || phase === 'phase2' || phase === 'phase3';

  return (
    <div style={{
      background: COLORS.bg,
      color: COLORS.ink,
      fontFamily: FONTS.body,
      minHeight: '100vh',
      padding: '60px 24px',
    }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>

        {/* HEADER */}
        <header style={{ marginBottom: '48px' }}>
          <div style={{
            fontFamily: FONTS.mono,
            fontSize: '10px',
            letterSpacing: '0.32em',
            color: COLORS.muted,
            marginBottom: '14px',
            textTransform: 'uppercase',
          }}>Docket No. {String(Date.now()).slice(-6)} · Vol. I</div>

          <h1 style={{
            fontFamily: FONTS.display,
            fontSize: '64px',
            lineHeight: 1.02,
            color: COLORS.ink,
            margin: 0,
            letterSpacing: '-0.02em',
          }}>The Idea<br/>Courtroom</h1>

          <SectionRule />

          <div style={{
            marginTop: '20px',
            fontFamily: FONTS.body,
            fontSize: '19px',
            fontStyle: 'italic',
            color: COLORS.muted,
            lineHeight: 1.5,
          }}>
            Where your idea faces cross-examination from four voices —
            an Advocate, a Prosecutor, a Strategist, and a Judge —
            before the bench delivers a verdict.
          </div>
        </header>

        {/* INPUT */}
        <section style={{
          background: COLORS.paper,
          padding: '36px',
          marginBottom: '40px',
          borderTop: `2px solid ${COLORS.ink}`,
          borderBottom: `2px solid ${COLORS.ink}`,
        }}>
          <Label>Submit the Idea For Trial</Label>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            disabled={isRunning}
            placeholder="Describe your idea here. The more concrete, the sharper the trial. (e.g., 'An app that uses your phone's camera to identify mushrooms while hiking and tells you if they're safe to eat.')"
            style={{
              width: '100%',
              minHeight: '140px',
              padding: '16px',
              fontFamily: FONTS.body,
              fontSize: '17px',
              lineHeight: 1.55,
              color: COLORS.ink,
              background: COLORS.bg,
              border: `1px solid ${COLORS.rule}`,
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
          <div style={{
            marginTop: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div style={{
              fontFamily: FONTS.mono,
              fontSize: '11px',
              color: COLORS.muted,
              letterSpacing: '0.1em',
            }}>{idea.length} characters</div>

            <button
              onClick={runTrial}
              disabled={isRunning}
              style={{
                background: isRunning ? COLORS.muted : COLORS.ink,
                color: COLORS.bg,
                border: 'none',
                padding: '14px 32px',
                fontFamily: FONTS.display,
                fontSize: '17px',
                letterSpacing: '0.04em',
                cursor: isRunning ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}>
              {isRunning ? 'Court in session…' : 'Take it to Court →'}
            </button>
          </div>

          {error && (
            <div style={{
              marginTop: '20px',
              padding: '14px',
              background: '#F5E5E2',
              borderLeft: `3px solid ${COLORS.prosecutor}`,
              fontFamily: FONTS.body,
              color: COLORS.prosecutor,
              fontSize: '15px',
            }}>{error}</div>
          )}

          {copyStatus && (
            <div style={{
              marginTop: '20px',
              padding: '14px',
              background: '#E5EFE9',
              borderLeft: `3px solid ${COLORS.advocate}`,
              fontFamily: FONTS.mono,
              fontSize: '12px',
              color: COLORS.advocate,
              letterSpacing: '0.1em',
            }}>✓ {copyStatus.toUpperCase()}</div>
          )}
        </section>

        {/* PHASE STATUS */}
        {isRunning && (
          <div style={{
            fontFamily: FONTS.mono,
            fontSize: '11px',
            color: COLORS.muted,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom: '20px',
            textAlign: 'center',
          }}>
            {phase === 'phase1' && '— Defense & Prosecution Arguing —'}
            {phase === 'phase2' && '— Strategist Reviewing the Record —'}
            {phase === 'phase3' && '— The Bench Deliberating —'}
          </div>
        )}

        {/* PHASE 1 — Advocate */}
        {phase === 'phase1' && !advocacy && (
          <LoadingCard exhibit="A" title="FOR THE DEFENSE" role="The Advocate" color={COLORS.advocate} />
        )}
        {advocacy && (
          <VoiceCard
            exhibit="A"
            title="FOR THE DEFENSE"
            role="The Advocate"
            color={COLORS.advocate}
            fields={advocateFields}
            data={advocacy}
            signalLabel="STRONGEST SIGNAL"
            signalKey="strongest_signal"
          />
        )}

        {/* PHASE 1 — Prosecutor */}
        {phase === 'phase1' && !prosecution && (
          <LoadingCard exhibit="B" title="FOR THE PROSECUTION" role="The Prosecutor" color={COLORS.prosecutor} />
        )}
        {prosecution && (
          <VoiceCard
            exhibit="B"
            title="FOR THE PROSECUTION"
            role="The Prosecutor"
            color={COLORS.prosecutor}
            fields={prosecutorFields}
            data={prosecution}
            signalLabel="THE BIGGEST FLAW"
            signalKey="biggest_flaw"
          />
        )}

        {/* PHASE 2 — Strategist */}
        {phase === 'phase2' && (
          <LoadingCard exhibit="C" title="THE STRATEGIC REVIEW" role="The Strategist" color={COLORS.strategist} />
        )}
        {strategy && (
          <VoiceCard
            exhibit="C"
            title="THE STRATEGIC REVIEW"
            role="The Strategist"
            color={COLORS.strategist}
            fields={strategistFields}
            data={strategy}
            signalLabel="THE KEY INSIGHT"
            signalKey="key_insight"
          />
        )}

        {/* PHASE 3 — Verdict */}
        {phase === 'phase3' && (
          <LoadingCard exhibit="·" title="THE BENCH" role="Awaiting Verdict" color={COLORS.judge} />
        )}
        {verdict && <VerdictCard verdict={verdict} onExport={exportBrief} />}

        {/* FOOTER */}
        <footer style={{
          marginTop: '60px',
          paddingTop: '24px',
          borderTop: `1px solid ${COLORS.rule}`,
          fontFamily: FONTS.mono,
          fontSize: '10px',
          letterSpacing: '0.16em',
          color: COLORS.muted,
          textTransform: 'uppercase',
          textAlign: 'center',
        }}>
          The Idea Courtroom · A multi-step reasoning agent · Built for EAGv3 Session 5
        </footer>
      </div>
    </div>
  );
}
