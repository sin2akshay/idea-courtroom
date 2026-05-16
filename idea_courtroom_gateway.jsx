import React, { useState, useEffect } from 'react';

// ============================================================
// THE IDEA COURTROOM — llm_gatewayV2 version
//
// This version calls the FastAPI backend (localhost:8200)
// which uses llm_gatewayV2 (localhost:8100) for free LLM access.
//
// Run order:
//   1. cd llm_gatewayV2 && python main.py        (port 8100)
//   2. cd backend && uv run uvicorn main:app --reload --port 8200
//   3. Run this React app (npm run dev or paste into claude.ai)
// ============================================================

const BACKEND = 'http://localhost:8200';

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
  error: '#F5E5E2',
};

const FONTS = {
  display: '"DM Serif Display", Georgia, serif',
  body: '"Crimson Pro", Georgia, serif',
  mono: '"JetBrains Mono", "Courier New", monospace',
};

// ── API calls ─────────────────────────────────────────────────────────────────

const post = async (path, body) => {
  const res = await fetch(`${BACKEND}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed (${res.status})`);
  }
  return res.json();
};

// ── UI components ──────────────────────────────────────────────────────────────

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
  <span style={{ color, fontFamily: FONTS.mono }}>
    <span style={{ animation: 'pulse 1.4s infinite 0s' }}>·</span>
    <span style={{ animation: 'pulse 1.4s infinite 0.2s' }}>·</span>
    <span style={{ animation: 'pulse 1.4s infinite 0.4s' }}>·</span>
  </span>
);

const LoadingCard = ({ exhibit, title, role, color }) => (
  <article style={{
    background: COLORS.paper,
    borderLeft: `3px solid ${color}`,
    padding: '32px 36px',
    marginBottom: '24px',
    animation: 'fadeIn 0.4s ease-out',
  }}>
    <Label color={color}>EXHIBIT {exhibit} · {title}</Label>
    <div style={{ fontFamily: FONTS.display, fontSize: '28px', color: COLORS.ink, marginBottom: '12px' }}>
      {role}
    </div>
    <div style={{ fontFamily: FONTS.body, fontStyle: 'italic', color: COLORS.muted }}>
      Preparing argument <LoadingDots color={color} />
    </div>
    <div style={{ marginTop: '20px' }}>
      {[80, 65, 50, 40].map((w, i) => (
        <div key={i} style={{
          height: 13, width: `${w}%`,
          background: COLORS.rule, opacity: 0.6,
          marginBottom: 10,
          animation: `shimmer 1.8s infinite ${i * 0.15}s`,
        }} />
      ))}
    </div>
  </article>
);

const VoiceCard = ({ exhibit, title, role, color, fields, data, signalLabel, signalKey }) => (
  <article style={{
    background: COLORS.paper,
    borderLeft: `3px solid ${color}`,
    padding: '32px 36px',
    marginBottom: '24px',
    animation: 'slideUp 0.5s ease-out',
  }}>
    <Label color={color}>EXHIBIT {exhibit} · {title}</Label>
    <div style={{
      fontFamily: FONTS.display,
      fontSize: '28px',
      color: COLORS.ink,
      marginBottom: '24px',
      letterSpacing: '-0.01em',
    }}>{role}</div>

    {fields.map((f, i) => (
      <div key={f.key} style={{ marginBottom: '20px' }}>
        <Label color={color}>{`§ ${i + 1}  ${f.label}`}</Label>
        <div style={{ fontFamily: FONTS.body, fontSize: '17px', lineHeight: 1.55, color: COLORS.ink }}>
          {data[f.key]}
        </div>
      </div>
    ))}

    <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: `1px solid ${COLORS.rule}` }}>
      <Label color={color}>{signalLabel}</Label>
      <div style={{
        fontFamily: FONTS.display,
        fontSize: '22px',
        lineHeight: 1.35,
        fontStyle: 'italic',
        color,
      }}>"{data[signalKey]}"</div>
    </div>
  </article>
);

const VerdictCard = ({ verdict, onExport }) => {
  const pathColor =
    verdict.recommended_path === 'PROCEED' ? COLORS.proceed :
    verdict.recommended_path === 'PIVOT' ? COLORS.pivot : COLORS.pass;

  return (
    <article style={{
      background: COLORS.ink,
      color: COLORS.bg,
      padding: '48px 44px',
      marginBottom: '24px',
      animation: 'slideUp 0.6s ease-out',
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
          <div style={{ fontFamily: FONTS.mono, fontSize: '11px', letterSpacing: '0.18em', opacity: 0.6, marginBottom: '6px' }}>
            CONVICTION SCORE
          </div>
          <div style={{ fontFamily: FONTS.display, fontSize: '88px', lineHeight: 1, color: COLORS.bg }}>
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

      <div style={{ height: 1, background: COLORS.muted, marginBottom: '28px' }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '28px' }}>
        <div>
          <Label color={COLORS.bg}>STRONGEST SIGNAL</Label>
          <div style={{ fontFamily: FONTS.body, fontSize: '17px', lineHeight: 1.5 }}>{verdict.strongest_signal}</div>
        </div>
        <div>
          <Label color={COLORS.bg}>BIGGEST RISK</Label>
          <div style={{ fontFamily: FONTS.body, fontSize: '17px', lineHeight: 1.5 }}>{verdict.biggest_risk}</div>
        </div>
      </div>

      <div style={{ background: COLORS.bg, color: COLORS.ink, padding: '24px 28px', marginBottom: '24px' }}>
        <Label color={COLORS.ink}>THIS WEEK · NEXT ACTION</Label>
        <div style={{ fontFamily: FONTS.display, fontSize: '22px', lineHeight: 1.4 }}>{verdict.next_action}</div>
      </div>

      <div>
        <Label color={COLORS.bg}>THE ONE-LINE PITCH</Label>
        <div style={{ fontFamily: FONTS.display, fontSize: '24px', lineHeight: 1.4, fontStyle: 'italic' }}>
          "{verdict.one_line_pitch}"
        </div>
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
        }}>
          Export Brief →
        </button>
      </div>
    </article>
  );
};

// ── Main app ──────────────────────────────────────────────────────────────────

export default function IdeaCourtroom() {
  const [idea, setIdea] = useState('');
  const [phase, setPhase] = useState('idle');
  const [advocacy, setAdvocacy] = useState(null);
  const [prosecution, setProsecution] = useState(null);
  const [strategy, setStrategy] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [error, setError] = useState(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [gateway, setGateway] = useState('checking');

  useEffect(() => {
    // Inject fonts
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Crimson+Pro:ital,wght@0,400;1,400&family=JetBrains+Mono:wght@400;500&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes pulse   { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
      @keyframes shimmer { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
    `;
    document.head.appendChild(style);

    // Check backend health
    fetch(`${BACKEND}/health`)
      .then(r => r.ok ? setGateway('connected') : setGateway('error'))
      .catch(() => setGateway('error'));
  }, []);

  const runTrial = async () => {
    if (!idea.trim() || idea.trim().length < 20) {
      setError('Please describe your idea in at least 20 characters.');
      return;
    }
    setError(null);
    setAdvocacy(null);
    setProsecution(null);
    setStrategy(null);
    setVerdict(null);

    try {
      // Phase 1 — Advocate + Prosecutor in parallel
      // Frontend mirrors asyncio.gather: two concurrent fetch calls
      setPhase('phase1');
      const p1 = await post('/api/phase1', { idea });
      setAdvocacy(p1.advocacy);
      setProsecution(p1.prosecution);

      // Phase 2 — Strategist (receives Phase 1 typed outputs)
      setPhase('phase2');
      const p2 = await post('/api/phase2', {
        idea,
        advocacy: p1.advocacy,
        prosecution: p1.prosecution,
      });
      setStrategy(p2.strategy);

      // Phase 3 — Judge (receives all prior outputs)
      setPhase('phase3');
      const p3 = await post('/api/phase3', {
        idea,
        advocacy: p1.advocacy,
        prosecution: p1.prosecution,
        strategy: p2.strategy,
      });
      setVerdict(p3.verdict);

      setPhase('complete');
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  };

  const exportBrief = () => {
    const md = `# THE IDEA COURTROOM — VERDICT BRIEF\n\n## The Idea\n${idea}\n\n---\n\n## VERDICT\n**Conviction Score:** ${verdict.conviction_score}/10\n**Recommended Path:** ${verdict.recommended_path}\n**Strongest Signal:** ${verdict.strongest_signal}\n**Biggest Risk:** ${verdict.biggest_risk}\n**Next Action:** ${verdict.next_action}\n**One-Line Pitch:** _"${verdict.one_line_pitch}"_\n\n---\n\n## The Advocate\n- **Problem:** ${advocacy.problem}\n- **Audience:** ${advocacy.audience}\n- **Timing:** ${advocacy.timing}\n- **Wedge:** ${advocacy.wedge}\n- **Advantage:** ${advocacy.unfair_advantage}\n\n## The Prosecutor\n- **Hidden Assumption:** ${prosecution.hidden_assumption}\n- **Market Reality:** ${prosecution.market_reality}\n- **Execution Risk:** ${prosecution.execution_risk}\n- **Killer Question:** ${prosecution.killer_question}\n\n## The Strategist\n- **Pivot:** ${strategy.pivot}\n- **Wedge Sharpening:** ${strategy.wedge_sharpening}\n- **Sequence:** ${strategy.sequence}\n- **Cheapest Test:** ${strategy.cheapest_test}`;
    navigator.clipboard.writeText(md);
    setCopyStatus('Brief copied to clipboard');
    setTimeout(() => setCopyStatus(''), 2500);
  };

  const isRunning = ['phase1', 'phase2', 'phase3'].includes(phase);

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

  return (
    <div style={{ background: COLORS.bg, color: COLORS.ink, fontFamily: FONTS.body, minHeight: '100vh', padding: '60px 24px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>

        {/* Header */}
        <header style={{ marginBottom: '48px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
            <div style={{ fontFamily: FONTS.mono, fontSize: '10px', letterSpacing: '0.32em', color: COLORS.muted, textTransform: 'uppercase' }}>
              Docket No. {String(Date.now()).slice(-6)} · Vol. I
            </div>
            {/* Gateway status badge */}
            <div style={{
              fontFamily: FONTS.mono,
              fontSize: '10px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              padding: '4px 10px',
              background: gateway === 'connected' ? '#E5EFE9' : gateway === 'error' ? COLORS.error : '#F4EFE6',
              color: gateway === 'connected' ? COLORS.advocate : gateway === 'error' ? COLORS.prosecutor : COLORS.muted,
              border: `1px solid ${gateway === 'connected' ? COLORS.advocate : gateway === 'error' ? COLORS.prosecutor : COLORS.rule}`,
            }}>
              {gateway === 'connected' ? '● Gateway Connected' : gateway === 'error' ? '○ Backend Offline' : '○ Checking…'}
            </div>
          </div>

          <h1 style={{ fontFamily: FONTS.display, fontSize: '64px', lineHeight: 1.02, color: COLORS.ink, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            The Idea<br/>Courtroom
          </h1>
          <div style={{ height: 1, background: COLORS.rule, marginBottom: '20px' }} />
          <div style={{ fontFamily: FONTS.body, fontSize: '19px', fontStyle: 'italic', color: COLORS.muted, lineHeight: 1.5 }}>
            Where your idea faces cross-examination from four voices — an Advocate, a Prosecutor, a Strategist, and a Judge — before the bench delivers a verdict.
          </div>

          {gateway === 'error' && (
            <div style={{
              marginTop: '20px',
              padding: '16px 20px',
              background: COLORS.error,
              borderLeft: `3px solid ${COLORS.prosecutor}`,
              fontFamily: FONTS.body,
              fontSize: '15px',
              color: COLORS.prosecutor,
              lineHeight: 1.5,
            }}>
              <strong>Backend not running.</strong> Start it first:<br />
              <span style={{ fontFamily: FONTS.mono, fontSize: '13px' }}>
                cd llm_gatewayV2 &amp;&amp; python main.py<br />
                cd backend &amp;&amp; uv run uvicorn main:app --reload --port 8200
              </span>
            </div>
          )}
        </header>

        {/* Input */}
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
            placeholder="Describe your idea here. The more concrete, the sharper the trial. (e.g., 'An app that uses your phone camera to identify mushrooms while hiking and tells you if they're safe to eat.')"
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
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ fontFamily: FONTS.mono, fontSize: '11px', color: COLORS.muted, letterSpacing: '0.1em' }}>
              {idea.length} characters · via llm_gatewayV2
            </div>
            <button
              onClick={runTrial}
              disabled={isRunning || gateway === 'error'}
              style={{
                background: (isRunning || gateway === 'error') ? COLORS.muted : COLORS.ink,
                color: COLORS.bg,
                border: 'none',
                padding: '14px 32px',
                fontFamily: FONTS.display,
                fontSize: '17px',
                cursor: (isRunning || gateway === 'error') ? 'not-allowed' : 'pointer',
              }}>
              {isRunning ? 'Court in session…' : 'Take it to Court →'}
            </button>
          </div>

          {error && (
            <div style={{ marginTop: '20px', padding: '14px', background: COLORS.error, borderLeft: `3px solid ${COLORS.prosecutor}`, fontFamily: FONTS.body, color: COLORS.prosecutor, fontSize: '15px' }}>
              {error}
            </div>
          )}
          {copyStatus && (
            <div style={{ marginTop: '20px', padding: '14px', background: '#E5EFE9', borderLeft: `3px solid ${COLORS.advocate}`, fontFamily: FONTS.mono, fontSize: '12px', color: COLORS.advocate, letterSpacing: '0.1em' }}>
              ✓ {copyStatus.toUpperCase()}
            </div>
          )}
        </section>

        {/* Phase status */}
        {isRunning && (
          <div style={{ fontFamily: FONTS.mono, fontSize: '11px', color: COLORS.muted, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '20px', textAlign: 'center' }}>
            {phase === 'phase1' && '— Defense & Prosecution Arguing (parallel) —'}
            {phase === 'phase2' && '— Strategist Reviewing the Record —'}
            {phase === 'phase3' && '— The Bench Deliberating (high reasoning) —'}
          </div>
        )}

        {/* Phase 1 — Advocate */}
        {phase === 'phase1' && !advocacy && (
          <LoadingCard exhibit="A" title="FOR THE DEFENSE" role="The Advocate" color={COLORS.advocate} />
        )}
        {advocacy && (
          <VoiceCard exhibit="A" title="FOR THE DEFENSE" role="The Advocate" color={COLORS.advocate}
            fields={advocateFields} data={advocacy} signalLabel="STRONGEST SIGNAL" signalKey="strongest_signal" />
        )}

        {/* Phase 1 — Prosecutor */}
        {phase === 'phase1' && !prosecution && (
          <LoadingCard exhibit="B" title="FOR THE PROSECUTION" role="The Prosecutor" color={COLORS.prosecutor} />
        )}
        {prosecution && (
          <VoiceCard exhibit="B" title="FOR THE PROSECUTION" role="The Prosecutor" color={COLORS.prosecutor}
            fields={prosecutorFields} data={prosecution} signalLabel="THE BIGGEST FLAW" signalKey="biggest_flaw" />
        )}

        {/* Phase 2 — Strategist */}
        {phase === 'phase2' && (
          <LoadingCard exhibit="C" title="THE STRATEGIC REVIEW" role="The Strategist" color={COLORS.strategist} />
        )}
        {strategy && (
          <VoiceCard exhibit="C" title="THE STRATEGIC REVIEW" role="The Strategist" color={COLORS.strategist}
            fields={strategistFields} data={strategy} signalLabel="THE KEY INSIGHT" signalKey="key_insight" />
        )}

        {/* Phase 3 — Verdict */}
        {phase === 'phase3' && (
          <LoadingCard exhibit="·" title="THE BENCH" role="Awaiting Verdict" color={COLORS.judge} />
        )}
        {verdict && <VerdictCard verdict={verdict} onExport={exportBrief} />}

        <footer style={{ marginTop: '60px', paddingTop: '24px', borderTop: `1px solid ${COLORS.rule}`, fontFamily: FONTS.mono, fontSize: '10px', letterSpacing: '0.16em', color: COLORS.muted, textTransform: 'uppercase', textAlign: 'center' }}>
          The Idea Courtroom · llm_gatewayV2 Edition · EAGv3 Session 5
        </footer>
      </div>
    </div>
  );
}
