import { useState, useMemo } from 'react';
import { useGauntlet } from '../state/useGauntlet';
import { DRAFT_SLOTS, TOTAL_PICKS } from '../domain/draftFlow';
import { loadHof, rankHof } from '../domain/hallOfFame';
import { computeAwards, fmtAvg } from '../domain/seriesAwards';
import { MUTATORS, getMutator } from '../domain/mutators';
import { projectTeam, ratingColor } from '../domain/teamRating';
import { CardTile } from './CardTile';

type G = ReturnType<typeof useGauntlet>;

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------
export function MenuScreen({ g }: { g: G }) {
  const [name, setName] = useState(localStorage.getItem('dugout-gauntlet-name') ?? '');
  const [view, setView] = useState<'menu' | 'hof'>('menu');
  const [mutatorId, setMutatorId] = useState('standard');
  const top = rankHof(loadHof()).slice(0, 3);
  const mutator = getMutator(mutatorId);

  const start = () => {
    const teamName = name.trim() || 'My Squad';
    localStorage.setItem('dugout-gauntlet-name', teamName);
    g.startRun(teamName, mutatorId);
  };

  if (view === 'hof') return <HallOfFameScreen onBack={() => setView('menu')} />;

  return (
    <div className="stack" style={{ marginTop: 24, gap: 20 }}>
      <div className="center stack" style={{ gap: 6 }}>
        <h1>Dugout<br />Gauntlet</h1>
        <p className="dim">Draft a team. Run the gauntlet.<br />See how far you go.</p>
      </div>

      <div className="card stack">
        <label className="dim" style={{ fontSize: 13, fontWeight: 700 }}>TEAM NAME</label>
        <input
          className="input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="My Squad"
          maxLength={22}
        />
        <button className="btn" onClick={start}>Start a Run ⚾</button>
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <label className="dim" style={{ fontSize: 13, fontWeight: 700 }}>RUN MODE</label>
        <div className="chips">
          {MUTATORS.map(m => (
            <button
              key={m.id}
              className={`chip ${m.id === mutatorId ? 'chip--on' : ''}`}
              onClick={() => setMutatorId(m.id)}
            >
              {m.emoji} {m.name}
            </button>
          ))}
        </div>
        <p className="dim" style={{ fontSize: 13 }}>{mutator.description}</p>
      </div>

      {top.length > 0 && (
        <div className="card stack" style={{ gap: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2>🏆 Hall of Fame</h2>
            <span className="dim" style={{ fontSize: 13 }}>best teams</span>
          </div>
          {top.map((e, i) => (
            <div key={i} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{['🥇', '🥈', '🥉'][i]} <strong>{e.teamName}</strong></span>
              <span className="dim">{e.streak}-0 · {e.runDiff >= 0 ? '+' : ''}{e.runDiff}</span>
            </div>
          ))}
          <button className="btn btn--ghost" onClick={() => setView('hof')}>View full Hall of Fame</button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hall of Fame (full board)
// ---------------------------------------------------------------------------
export function HallOfFameScreen({ onBack }: { onBack: () => void }) {
  const entries = rankHof(loadHof());
  return (
    <div className="stack" style={{ marginTop: 16, gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 26 }}>🏆 Hall of Fame</h1>
        <button className="btn btn--ghost" style={{ width: 'auto', minHeight: 40, padding: '0 14px' }} onClick={onBack}>Back</button>
      </div>
      {entries.length === 0 && <p className="dim center" style={{ marginTop: 30 }}>No teams yet. Go make history.</p>}
      <div className="stack" style={{ gap: 8 }}>
        {entries.map((e, i) => (
          <div key={i} className="card row" style={{ justifyContent: 'space-between', padding: '12px 14px' }}>
            <div>
              <div><strong>#{i + 1}</strong> &nbsp;{e.teamName}</div>
              <div className="dim" style={{ fontSize: 12 }}>
                {e.managerName ? `mgr ${e.managerName.split(' ').slice(-1)}` : ''}
                {e.stadiumName ? ` · ${e.stadiumName}` : ''}
              </div>
            </div>
            <div className="center">
              <div style={{ fontWeight: 900, color: 'var(--accent)' }}>{e.streak}-0</div>
              <div className="dim" style={{ fontSize: 12 }}>{e.runDiff >= 0 ? '+' : ''}{e.runDiff}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Draft
// ---------------------------------------------------------------------------
export function DraftScreen({ g }: { g: G }) {
  const { currentSlot, offered, picks } = g.state;
  const slot = DRAFT_SLOTS[currentSlot];
  const progress = Math.round((currentSlot / TOTAL_PICKS) * 100);
  const proj = projectTeam(picks);

  return (
    <div className="stack" style={{ marginTop: 8, gap: 14 }}>
      <div className="stack" style={{ gap: 8 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>{g.state.teamName}</strong>
          <span className="dim">Pick {currentSlot + 1} / {TOTAL_PICKS}</span>
        </div>
        <div className="progress"><div className="progress__fill" style={{ width: `${progress}%` }} /></div>
      </div>

      {picks.length > 0 && (
        <div className="row" style={{ gap: 10 }}>
          <RatingBar label="OFF" value={proj.offense} />
          <RatingBar label="PIT" value={proj.pitching} />
          <RatingBar label="OVR" value={proj.overall} />
        </div>
      )}

      <div className="center stack" style={{ gap: 2 }}>
        <span className="dim" style={{ fontSize: 13, letterSpacing: 1 }}>NOW DRAFTING</span>
        <h2>{slot?.label}</h2>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        {offered.map(p => <CardTile key={p.id} player={p} onPick={g.pick} />)}
      </div>

      <button className="btn btn--ghost" onClick={g.autofill}>⚡ Auto-fill the rest</button>

      {picks.length > 0 && (
        <p className="dim center" style={{ fontSize: 13 }}>
          {picks.length} drafted · last: {picks[picks.length - 1].name}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Matchup / simulating
// ---------------------------------------------------------------------------
export function MatchupScreen({ g }: { g: G }) {
  const { opponent, streak, team } = g.state;

  if (!opponent) {
    return (
      <div className="stack center" style={{ marginTop: 80, gap: 16 }}>
        <div className="spinner" />
        <h2>Scouting your next opponent…</h2>
        <p className="dim">Streak: {streak}-0</p>
      </div>
    );
  }

  if (g.simulating) {
    return (
      <div className="stack center" style={{ marginTop: 80, gap: 16 }}>
        <div className="spinner" />
        <h2>Simulating the series…</h2>
        <p className="dim">{team?.name} vs {opponent.displayName}</p>
      </div>
    );
  }

  return (
    <div className="stack" style={{ marginTop: 24, gap: 18 }}>
      <div className="center stack" style={{ gap: 2 }}>
        <span className="dim" style={{ letterSpacing: 1, fontSize: 13 }}>SERIES {streak + 1} · BEST OF 7</span>
        <h2>Your Next Challenger</h2>
      </div>

      <div className="card stack center" style={{ gap: 6 }}>
        <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
          <span className={`badge ${opponent.isGhost ? 'badge--ghost' : 'badge--cpu'}`}>
            {opponent.isGhost ? '👤 REAL TEAM' : '🤖 CPU'}
          </span>
          {opponent.streak > 0 && <span className="badge">🔥 {opponent.streak}-0</span>}
        </div>
        <h1 style={{ fontSize: 26 }}>{opponent.displayName}</h1>
        <p className="dim">drafted by {opponent.ownerName}</p>
      </div>

      <div className="row center" style={{ justifyContent: 'center', gap: 12, fontWeight: 800 }}>
        <span>{team?.name}</span>
        <span className="dim">vs</span>
        <span>{opponent.displayName}</span>
      </div>

      <button className="btn" onClick={g.playCurrentSeries}>Play the Series ▶</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Series result
// ---------------------------------------------------------------------------
export function SeriesResultScreen({ g }: { g: G }) {
  const r = g.state.lastResult;
  const last = g.state.history[g.state.history.length - 1];
  const yourIds = useMemo(
    () => new Set((g.state.team?.roster ?? []).map(p => p.id)),
    [g.state.team]
  );
  const awards = useMemo(() => (r ? computeAwards(r, yourIds) : null), [r, yourIds]);
  if (!r || !last) return null;
  const won = r.winner === 'you';

  return (
    <div className="stack center" style={{ marginTop: 32, gap: 16 }}>
      <h1 style={{ fontSize: 44, color: won ? 'var(--win)' : 'var(--loss)' }}>
        {won ? 'SERIES WON' : 'ELIMINATED'}
      </h1>
      <div className="card stack center" style={{ gap: 8, width: '100%' }}>
        <div style={{ fontSize: 40, fontWeight: 900 }}>{r.youWins}–{r.oppWins}</div>
        <p className="dim">vs {last.opponentName}</p>
        <div className="row" style={{ justifyContent: 'center', gap: 16 }}>
          <span>Runs: <strong>{r.youRuns}</strong></span>
          <span className="dim">–</span>
          <span><strong>{r.oppRuns}</strong></span>
        </div>
        <div className="gamelines">
          {r.gameLines.map((gl, i) => (
            <div key={i} className={`gameline ${gl.won ? 'gameline--w' : 'gameline--l'}`}>
              <div className="gameline__g">G{i + 1}</div>
              <div className="gameline__s">{gl.you}-{gl.opp}</div>
              <div className="gameline__r">{gl.won ? 'W' : 'L'}</div>
            </div>
          ))}
        </div>
      </div>

      {awards && (awards.mvp || awards.ace) && (
        <div className="card stack" style={{ width: '100%', gap: 10 }}>
          <h2 style={{ fontSize: 16 }}>⭐ Series Standouts</h2>
          {awards.mvp && (
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span>🏅 <strong>{awards.mvp.name}</strong> <span className="dim">MVP</span></span>
              <span className="dim">{fmtAvg(awards.mvp.avg)}, {awards.mvp.hr} HR, {awards.mvp.rbi} RBI</span>
            </div>
          )}
          {awards.ace && (
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span>🔥 <strong>{awards.ace.name}</strong> <span className="dim">Ace</span></span>
              <span className="dim">{awards.ace.era.toFixed(2)} ERA, {awards.ace.so} K</span>
            </div>
          )}
        </div>
      )}

      {won ? (
        <>
          <p className="center">🔥 Streak: <strong>{g.state.streak}-0</strong></p>
          <button className="btn" onClick={g.nextOpponent}>Next Opponent ▶</button>
        </>
      ) : (
        <button className="btn" onClick={g.nextOpponent}>See Run Summary</button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Run over (summary + share)
// ---------------------------------------------------------------------------
export function RunOverScreen({ g }: { g: G }) {
  const { streak, totalRunsFor, totalRunsAgainst, team, history, mutatorId } = g.state;
  const runDiff = totalRunsFor - totalRunsAgainst;
  const hof = g.hofResult;
  const mut = getMutator(mutatorId);
  const [shared, setShared] = useState(false);

  const modeTag = mut.id === 'standard' ? '' : ` [${mut.emoji} ${mut.name}]`;
  const shareText =
    `⚾ Dugout Gauntlet${modeTag}\n${team?.name} went ${streak}-0 before falling!\n` +
    `Run diff: ${runDiff >= 0 ? '+' : ''}${runDiff}` +
    (hof ? ` · #${hof.rank} all-time` : '') +
    `\nHow far can you go?`;

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text: shareText });
      else { await navigator.clipboard.writeText(shareText); setShared(true); }
    } catch { /* user cancelled */ }
  };

  return (
    <div className="stack center" style={{ marginTop: 28, gap: 16 }}>
      <span className="dim" style={{ letterSpacing: 1 }}>RUN COMPLETE{mut.id !== 'standard' ? ` · ${mut.emoji} ${mut.name}` : ''}</span>
      <h1 style={{ fontSize: 64, lineHeight: 1 }}>{streak}-0</h1>
      <strong style={{ fontSize: 20 }}>{team?.name}</strong>

      <div className="card stack" style={{ width: '100%', gap: 8 }}>
        <Row label="Series won" value={`${streak}`} />
        <Row label="Run differential" value={`${runDiff >= 0 ? '+' : ''}${runDiff}`} />
        <Row label="Runs for / against" value={`${totalRunsFor} / ${totalRunsAgainst}`} />
        {hof && <Row label="Hall of Fame" value={`#${hof.rank} all-time`} highlight />}
      </div>

      <button className="btn btn--secondary" onClick={share}>
        {shared ? '✓ Copied!' : '📲 Share result'}
      </button>
      <button className="btn" onClick={() => g.startRun(team?.name ?? 'My Squad', mutatorId)}>Run it back ⚾</button>
      <button className="btn btn--ghost" onClick={g.backToMenu}>Main menu</button>

      {history.length > 0 && (
        <div className="card stack" style={{ width: '100%', gap: 6 }}>
          <h2 style={{ fontSize: 16 }}>This run</h2>
          {history.map((h, i) => (
            <div key={i} className="row" style={{ justifyContent: 'space-between', fontSize: 14 }}>
              <span>{h.won ? '✅' : '❌'} vs {h.opponentName}</span>
              <span className="dim">{h.wins}-{h.losses}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RatingBar({ label, value }: { label: string; value: number }) {
  const color = ratingColor(value);
  return (
    <div className="stack" style={{ flex: 1, gap: 4 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="dim" style={{ fontSize: 11, fontWeight: 800 }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 900, color }}>{value || '—'}</span>
      </div>
      <div className="progress" style={{ height: 6 }}>
        <div className="progress__fill" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <span className="dim">{label}</span>
      <strong style={{ color: highlight ? 'var(--accent)' : undefined }}>{value}</strong>
    </div>
  );
}
