import { useState, useMemo, useEffect, useRef } from 'react';
import { useGauntlet } from '../state/useGauntlet';
import { TOTAL_PICKS, DraftRound } from '../domain/draftRounds';
import { TIER_COLORS } from '../domain/players';
import { Player } from '../domain/types';
import { loadHof, rankHof, entryRates } from '../domain/hallOfFame';
import { computeAwards, fmtAvg } from '../domain/seriesAwards';
import { MUTATORS, getMutator } from '../domain/mutators';
import { BUDGET } from '../domain/salary';
import { ACHIEVEMENTS, loadUnlocked } from '../domain/achievements';
import { isSoundOn, setSoundOn, sfxPick, sfxLock, sfxWin, sfxLoss } from '../domain/sound';
import { CardTile } from './CardTile';
import { DepthSidebar } from './DepthSidebar';
import { PlayerDetail } from './PlayerDetail';
import { LadderScreen } from './LadderScreen';
import { submitTeam } from '../firebase/ladder';

type G = ReturnType<typeof useGauntlet>;

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------
export function MenuScreen({ g }: { g: G }) {
  const [name, setName] = useState(localStorage.getItem('dugout-gauntlet-name') ?? '');
  const [view, setView] = useState<'menu' | 'hof' | 'ladder' | 'achievements' | 'help'>(
    () => (localStorage.getItem('dugout-gauntlet-seen-intro') ? 'menu' : 'help')
  );
  const [mutatorId, setMutatorId] = useState('standard');
  const [sound, setSound] = useState(isSoundOn());
  const top = rankHof(loadHof()).slice(0, 3);
  const mutator = getMutator(mutatorId);

  const start = () => {
    const teamName = name.trim() || 'My Squad';
    localStorage.setItem('dugout-gauntlet-name', teamName);
    g.startRun(teamName, mutatorId);
  };

  if (view === 'hof') return <HallOfFameScreen onBack={() => setView('menu')} />;
  if (view === 'ladder') return <LadderScreen onBack={() => setView('menu')} />;
  if (view === 'achievements') return <AchievementsScreen onBack={() => setView('menu')} />;
  if (view === 'help') return <HelpScreen onBack={() => { localStorage.setItem('dugout-gauntlet-seen-intro', '1'); setView('menu'); }} />;

  return (
    <div className="stack" style={{ marginTop: 24, gap: 20 }}>
      <div className="center stack" style={{ gap: 6 }}>
        <h1>Dugout<br />Gauntlet</h1>
        <p className="dim">Draft a team. Run the gauntlet.<br />See how far you go.</p>
      </div>

      {top[0] && (
        <div className="card row" style={{ justifyContent: 'space-between', borderColor: 'var(--accent)', alignItems: 'center' }}>
          <div>
            <div className="dim" style={{ fontSize: 11, letterSpacing: 1 }}>👑 CURRENT CHAMP</div>
            <strong style={{ fontSize: 17 }}>{top[0].teamName}</strong>
          </div>
          <div className="center">
            <div style={{ fontWeight: 900, color: 'var(--accent)', fontSize: 20 }}>{top[0].streak}</div>
            <div className="dim" style={{ fontSize: 10 }}>SERIES WON</div>
          </div>
        </div>
      )}

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
        <button className="btn btn--secondary" onClick={() => setView('ladder')}>🌐 Global Ladder</button>
        <button className="btn btn--ghost" onClick={() => setView('achievements')}>🎖️ Achievements</button>
        <button className="btn btn--ghost" onClick={() => setView('help')}>❔ How to play</button>
        <button className="btn btn--ghost" onClick={() => { const n = !sound; setSoundOn(n); setSound(n); }}>
          {sound ? '🔊 Sound: On' : '🔇 Sound: Off'}
        </button>
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
  const champ = entries[0];
  return (
    <div className="stack" style={{ marginTop: 16, gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 26 }}>🏆 Leaderboard</h1>
        <button className="btn btn--ghost" style={{ width: 'auto', minHeight: 40, padding: '0 14px' }} onClick={onBack}>Back</button>
      </div>

      {champ && (
        <div className="card stack" style={{ gap: 4, borderColor: 'var(--accent)' }}>
          <span className="dim" style={{ fontSize: 12, letterSpacing: 1 }}>👑 CURRENT CHAMP</span>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong style={{ fontSize: 18 }}>{champ.teamName}</strong>
            <strong style={{ color: 'var(--accent)' }}>{champ.streak} series</strong>
          </div>
        </div>
      )}

      {entries.length === 0 && <p className="dim center" style={{ marginTop: 30 }}>No teams yet. Go make history.</p>}

      {entries.length > 0 && (
        <div className="lb">
          <div className="lb__row lb__row--head">
            <span className="lb__rank">#</span>
            <span className="lb__team">Team</span>
            <span>W-L</span><span>RS/G</span><span>RA/G</span><span>RD</span>
          </div>
          {entries.map((e, i) => {
            const r = entryRates(e);
            return (
              <div key={i} className="lb__row">
                <span className="lb__rank">{i + 1}</span>
                <span className="lb__team">
                  <span className="lb__name">{e.teamName}</span>
                  <span className="lb__streak dim">{e.streak} series</span>
                </span>
                <span><b>{e.gameWins}-{e.gameLosses}</b></span>
                <span>{r.rsg.toFixed(1)}</span>
                <span>{r.rag.toFixed(1)}</span>
                <span style={{ color: r.rd >= 0 ? 'var(--win)' : 'var(--loss)' }}>{r.rd >= 0 ? '+' : ''}{r.rd}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// How to play
// ---------------------------------------------------------------------------
const HELP_STEPS: { emoji: string; title: string; body: string }[] = [
  { emoji: '💰', title: 'Draft under a cap', body: 'You have 600 cap points. Stars cost a fortune — splurge on a few, or spread it around, but you can\'t have studs everywhere. Spin a tier × role each pick.' },
  { emoji: '🏆', title: 'Run the gauntlet', body: 'Your team faces a ladder of legendary clubs — the Sandlot, the Bronx Bombers, Cooperstown Immortals — best-of-7 each, getting tougher as you climb.' },
  { emoji: '🔥', title: 'Build a streak', body: 'Win a series, move on. Lose one, your run ends and your team is logged forever. How far can you go?' },
  { emoji: '🌐', title: 'Climb the world', body: 'Send your team to the Global Ladder — it keeps battling other real players\' teams over time. Survive the most series and you\'re the world champ.' },
];
export function HelpScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="stack" style={{ marginTop: 20, gap: 16 }}>
      <h1 className="center">How to Play</h1>
      <div className="stack" style={{ gap: 10 }}>
        {HELP_STEPS.map((s, i) => (
          <div key={i} className="card row" style={{ gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 30, flex: '0 0 auto' }}>{s.emoji}</span>
            <div>
              <strong>{s.title}</strong>
              <div className="dim" style={{ fontSize: 13, marginTop: 2 }}>{s.body}</div>
            </div>
          </div>
        ))}
      </div>
      <button className="btn" onClick={onBack}>Let's play ⚾</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------
export function AchievementsScreen({ onBack }: { onBack: () => void }) {
  const unlocked = loadUnlocked();
  return (
    <div className="stack" style={{ marginTop: 16, gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 26 }}>🎖️ Achievements</h1>
        <button className="btn btn--ghost" style={{ width: 'auto', minHeight: 40, padding: '0 14px' }} onClick={onBack}>Back</button>
      </div>
      <p className="dim center" style={{ fontSize: 13 }}>{unlocked.size} / {ACHIEVEMENTS.length} unlocked</p>
      <div className="stack" style={{ gap: 8 }}>
        {ACHIEVEMENTS.map(a => {
          const got = unlocked.has(a.id);
          return (
            <div key={a.id} className={`ach ${got ? 'ach--on' : ''}`}>
              <span className="ach__emoji">{got ? a.emoji : '🔒'}</span>
              <div className="ach__body">
                <strong>{got ? a.name : '???'}</strong>
                <div className="dim" style={{ fontSize: 12 }}>{a.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Draft
// ---------------------------------------------------------------------------
export function DraftScreen({ g }: { g: G }) {
  const { offered, picks, currentRound, draftLog } = g.state;
  const [detail, setDetail] = useState<Player | null>(null);
  const pickNum = picks.length + 1;
  const tierColor = currentRound ? TIER_COLORS[currentRound.tier] : 'var(--accent)';

  return (
    <div className="draft">
      <div className="draft__head">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>{g.state.teamName}</strong>
          <span className="dim">Pick {pickNum} / {TOTAL_PICKS}</span>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
          <span className="dim">💰 Cap space</span>
          <strong style={{ color: g.state.budget < 50 ? 'var(--loss)' : 'var(--accent)' }}>{g.state.budget} / {BUDGET}</strong>
        </div>
        <div className="progress"><div className="progress__fill" style={{ width: `${(g.state.budget / BUDGET) * 100}%` }} /></div>
        {currentRound && <RoundBanner round={currentRound} color={tierColor} />}
      </div>

      <div className="draft__body">
        <div className="draft__offers">
          {offered.map(p => <CardTile key={p.id} player={p} onPick={(pl) => { sfxPick(); g.pick(pl); }} onInfo={setDetail} />)}
        </div>
        <aside className="draft__depth">
          <DepthSidebar draftLog={draftLog} activeRole={currentRound?.role} />
        </aside>
      </div>

      <button className="btn btn--ghost draft__autofill" onClick={g.autofill}>⚡ Auto-fill the rest</button>

      {detail && (
        <PlayerDetail
          player={detail}
          onDraft={(p) => { setDetail(null); g.pick(p); }}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

// Slot-machine reveal for the spun round — tier/name/role roll, then lock.
const SPIN_TIERS = ['DIAMOND', 'GOLD', 'SILVER', 'BRONZE', 'COMMON'];
const SPIN_NAMES = ['💎 The Diamond Mine', '🏆 Cooperstown Calls', '🎬 Hollywood Heaters', '🐻 The Sandlot',
  '⚪ Silver Sluggers Row', '🟫 Grinders\' Alley', '🎲 Bust or Boom', '🌎 Around the World', '🍂 October Legends'];
const SPIN_ROLES = ['Catcher', 'Shortstop', 'Ace Starter', 'Closer', 'Center Field', 'Pinch Hitter', 'Setup Man', 'Third Base'];

function RoundBanner({ round, color }: { round: DraftRound; color: string }) {
  const [spin, setSpin] = useState(true);
  const [t, setT] = useState(0);
  useEffect(() => {
    setSpin(true); setT(0);
    let n = 0;
    const iv = setInterval(() => { setT(x => x + 1); if (++n >= 9) { clearInterval(iv); setSpin(false); sfxLock(); } }, 60);
    return () => clearInterval(iv);
  }, [round]);
  const tier = spin ? SPIN_TIERS[t % SPIN_TIERS.length] : round.tier.toUpperCase();
  const name = spin ? SPIN_NAMES[t % SPIN_NAMES.length] : `${round.emoji} ${round.name}`;
  const role = spin ? SPIN_ROLES[t % SPIN_ROLES.length] : round.roleLabel;
  const c = spin ? 'var(--accent-2)' : color;
  return (
    <div className={`round-banner ${spin ? 'round-banner--spin' : 'round-banner--lock'}`} style={{ borderColor: c }}>
      <div className="round-banner__name">{name}</div>
      <div className="round-banner__role">
        <span className="badge" style={{ borderColor: c, color: c }}>{tier}</span>
        <span>Drafting: <strong>{role}</strong></span>
      </div>
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
          <span className={`badge ${opponent.kind === 'ghost' ? 'badge--ghost' : opponent.kind === 'famous' ? 'badge--ghost' : 'badge--cpu'}`}>
            {opponent.kind === 'ghost' ? '👤 REAL TEAM' : opponent.kind === 'famous' ? '🏆 LEGENDARY' : '🤖 CHALLENGER'}
          </span>
          {opponent.era && <span className="badge">{opponent.era}</span>}
          {opponent.streak > 0 && opponent.kind === 'ghost' && <span className="badge">🔥 {opponent.streak}-0</span>}
        </div>
        <h1 style={{ fontSize: 28 }}>{opponent.emoji ? `${opponent.emoji} ` : ''}{opponent.displayName}</h1>
        {opponent.blurb
          ? <p className="dim" style={{ fontSize: 13, fontStyle: 'italic' }}>{opponent.blurb}</p>
          : <p className="dim">drafted by {opponent.ownerName}</p>}
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
  const total = r?.gameLines.length ?? 0;
  const [revealed, setRevealed] = useState(0);

  // Reveal games one at a time for tension; settle a beat after the clincher.
  useEffect(() => {
    if (revealed >= total) return;
    const t = setTimeout(() => setRevealed(v => v + 1), revealed === total - 1 ? 500 : 720);
    return () => clearTimeout(t);
  }, [revealed, total]);

  const sfxFired = useRef(false);
  useEffect(() => {
    if (r && revealed >= total && total > 0 && !sfxFired.current) {
      sfxFired.current = true;
      (r.winner === 'you' ? sfxWin : sfxLoss)();
    }
  }, [revealed, total, r]);

  if (!r || !last) return null;
  const won = r.winner === 'you';
  const done = revealed >= total;
  const shown = r.gameLines.slice(0, revealed);
  const yW = shown.filter(x => x.won).length;
  const oW = shown.filter(x => !x.won).length;

  return (
    <div className="stack center" style={{ marginTop: 32, gap: 16 }}>
      <h1 style={{ fontSize: 44, color: !done ? 'var(--text)' : won ? 'var(--win)' : 'var(--loss)' }}>
        {!done ? `${yW}–${oW}` : won ? 'SERIES WON' : 'ELIMINATED'}
      </h1>
      <div className="card stack center" style={{ gap: 8, width: '100%' }}>
        {done && <div style={{ fontSize: 40, fontWeight: 900 }}>{r.youWins}–{r.oppWins}</div>}
        <p className="dim">{done ? `vs ${last.opponentName}` : `vs ${last.opponentName} · best of 7`}</p>
        <div className="gamelines">
          {shown.map((gl, i) => (
            <div key={i} className={`gameline gameline--in ${gl.won ? 'gameline--w' : 'gameline--l'}`}>
              <div className="gameline__g">G{i + 1}</div>
              <div className="gameline__s">{gl.you}-{gl.opp}</div>
              <div className="gameline__r">{gl.won ? 'W' : 'L'}</div>
            </div>
          ))}
          {Array.from({ length: total - revealed }).map((_, i) => (
            <div key={`p${i}`} className="gameline gameline--pending"><div className="gameline__g">G{revealed + i + 1}</div><div className="gameline__s">·</div></div>
          ))}
        </div>
        {done && (
          <div className="row" style={{ justifyContent: 'center', gap: 16 }}>
            <span>Runs: <strong>{r.youRuns}</strong></span>
            <span className="dim">–</span>
            <span><strong>{r.oppRuns}</strong></span>
          </div>
        )}
      </div>

      {!done && <button className="btn btn--ghost" onClick={() => setRevealed(total)}>Skip ⏩</button>}

      {done && awards && (awards.mvp || awards.ace) && (
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
  const [ladderState, setLadderState] = useState<'idle' | 'sending' | 'sent'>('idle');

  const sendToLadder = async () => {
    if (!team || ladderState !== 'idle') return;
    setLadderState('sending');
    try { await submitTeam(team, streak, team.name); setLadderState('sent'); }
    catch { setLadderState('idle'); }
  };

  const modeTag = mut.id === 'standard' ? '' : ` [${mut.emoji} ${mut.name}]`;
  const finalFoe = history[history.length - 1]?.won === false ? history[history.length - 1].opponentName : null;
  const shareText =
    `⚾ Dugout Gauntlet${modeTag}\n${team?.name} went ${streak}-0` +
    (finalFoe ? `, falling to the ${finalFoe}!\n` : ' before falling!\n') +
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
      {finalFoe && <p className="dim" style={{ fontSize: 13 }}>fell to the {finalFoe}</p>}

      <div className="card stack" style={{ width: '100%', gap: 8 }}>
        <Row label="Series won" value={`${streak}`} />
        <Row label="Run differential" value={`${runDiff >= 0 ? '+' : ''}${runDiff}`} />
        <Row label="Runs for / against" value={`${totalRunsFor} / ${totalRunsAgainst}`} />
        {hof && <Row label="Hall of Fame" value={`#${hof.rank} all-time`} highlight />}
      </div>

      {g.newAchievements.length > 0 && (
        <div className="card stack" style={{ width: '100%', gap: 8 }}>
          <h2 style={{ fontSize: 16 }}>🎖️ Achievements Unlocked</h2>
          {g.newAchievements.map(a => (
            <div key={a.id} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{a.emoji} <strong>{a.name}</strong></span>
              <span className="dim" style={{ fontSize: 12 }}>{a.description}</span>
            </div>
          ))}
        </div>
      )}

      <button className="btn" onClick={sendToLadder} disabled={ladderState !== 'idle'}>
        {ladderState === 'sent' ? '✓ On the Global Ladder!' : ladderState === 'sending' ? 'Sending…' : '⚔️ Send team to the Global Ladder'}
      </button>
      <button className="btn btn--secondary" onClick={share}>
        {shared ? '✓ Copied!' : '📲 Share result'}
      </button>
      <button className="btn btn--ghost" onClick={() => g.startRun(team?.name ?? 'My Squad', mutatorId)}>Run it back ⚾</button>
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

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <span className="dim">{label}</span>
      <strong style={{ color: highlight ? 'var(--accent)' : undefined }}>{value}</strong>
    </div>
  );
}
