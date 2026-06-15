import { useState, useMemo, useEffect } from 'react';
import { useGauntlet } from '../state/useGauntlet';
import { TOTAL_PICKS, DraftRound, playerFitsRole } from '../domain/draftRounds';
import { TIER_COLORS, getTier } from '../domain/players';
import { overallToGrade, abbrevName, gradeToLetter, getGradeColor } from '../domain/sim/helpers';
import { getRatings } from '../domain/ratings';
import { Player, Position } from '../domain/types';
import { DraftEntry } from '../state/gauntletReducer';
import { loadHof, rankHof, entryRates } from '../domain/hallOfFame';
import { runAwards, fmtAvg } from '../domain/seriesAwards';
import { MUTATORS, getMutator } from '../domain/mutators';
import { ACHIEVEMENTS, loadUnlocked } from '../domain/achievements';
import { isSoundOn, setSoundOn, sfxPick, sfxLock } from '../domain/sound';
import { DepthSidebar } from './DepthSidebar';
import { PlayerDetail } from './PlayerDetail';
import { LadderScreen } from './LadderScreen';
import { shareTeamImage, ShareSection } from './shareCard';
import { submitTeam } from '../firebase/ladder';

// Resolved tier hex (canvas can't read CSS vars) for the share image.
const TIER_HEX: Record<string, string> = { diamond: '#79f0ff', gold: '#ffce4a', silver: '#cdd9ea', bronze: '#e3914f', common: '#7286a3' };

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
      <div className="hero">
        <div className="hero__kicker">⚾ WORLD GAUNTLET · EST. 2026</div>
        <h1 className="hero__title">DUGOUT<span>GAUNTLET</span></h1>
        <p className="hero__sub">Draft a team. Run the gauntlet.<br />See how far you go.</p>
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
  { emoji: '🎡', title: 'Spin the wheel', body: 'Every pick spins a themed group — a real club, a movie cast, an archetype like Flamethrowers — then you choose one of four players to fill an open spot.' },
  { emoji: '⚾', title: 'Build your 18', body: 'Draft a 9-man lineup, 4 starters, 3 relievers, plus a coach and a ballpark — only the pieces that actually win playoff series.' },
  { emoji: '🔀', title: 'Set your lineup', body: 'Before you lock in, move any player to a position they can play. Put your best bats where you want them.' },
  { emoji: '🏆', title: 'Run the gauntlet', body: 'Your team auto-plays best-of-7 series up a ladder of legendary clubs — the Sandlot, the Bronx Bombers, Cooperstown — getting tougher every win.' },
  { emoji: '🌐', title: 'Climb the world', body: 'Lose and your run is logged forever. Send your team to the Global Ladder to keep battling real players\' teams. How far can you go?' },
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
  const [showRoster, setShowRoster] = useState(false);
  const pickNum = Math.min(picks.length + 1, TOTAL_PICKS);
  // Slot machine is "rolling" briefly each time a new role is spun.
  const [rolling, setRolling] = useState(true);
  useEffect(() => {
    setRolling(true);
    const iv = setTimeout(() => { setRolling(false); sfxLock(); }, 620);
    return () => clearTimeout(iv);
  }, [currentRound?.role, offered]);

  return (
    <div className="draft">
      <div className="draft__head">
        <div className="draft__hrow">
          <strong className="draft__team">{g.state.teamName}</strong>
          <span className="dim">Pick {pickNum}/{TOTAL_PICKS}</span>
        </div>
        {currentRound && <RoleSlot round={currentRound} rolling={rolling} />}
      </div>

      {/* Re-roll controls — change the role, or re-deal players for this role. */}
      <div className="reroll">
        <button className="reroll__btn" onClick={() => { sfxPick(); g.rerollRole(); }} disabled={rolling}>
          🎰 New Role
        </button>
        <button className="reroll__btn" onClick={() => { sfxPick(); g.rerollPlayers(); }} disabled={rolling}>
          🔄 New Players
        </button>
      </div>

      {/* Four candidates as clean text rows — name, grade, key ratings in letters. */}
      <div className={`optlist ${rolling ? 'optlist--rolling' : ''}`}>
        {offered.map(p => (
          <OptionRow key={p.id} player={p}
            onPick={() => { if (rolling) return; sfxPick(); g.pick(p); }}
            onInfo={() => setDetail(p)} />
        ))}
      </div>

      {/* Always-visible roster ribbon (tap to manage in detail). */}
      <button className="rribbon" onClick={() => setShowRoster(true)}>
        <RosterRibbon draftLog={draftLog} total={TOTAL_PICKS} />
      </button>

      <div className="draft__bar">
        <button className="btn btn--ghost draft__barbtn" onClick={() => setShowRoster(true)}>📋 View Roster</button>
        <button className="btn btn--ghost draft__barbtn" onClick={g.autofill}>⚡ Auto-fill rest</button>
      </div>

      {showRoster && (
        <div className="sheetwrap" onClick={() => setShowRoster(false)}>
          <div className="sheetwrap__panel" onClick={e => e.stopPropagation()}>
            <div className="sheetwrap__hd">
              <strong>YOUR ROSTER</strong>
              <button className="sheetwrap__x" onClick={() => setShowRoster(false)} aria-label="Close">✕</button>
            </div>
            <DepthSidebar draftLog={draftLog} />
          </div>
        </div>
      )}

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

// Role names that flash by while the slot machine "rolls".
const ROLE_SPIN = ['CATCHER', 'SHORTSTOP', 'CENTER FIELD', 'ACE', 'CLOSER', 'CLEANUP', 'THIRD BASE', 'SETUP', 'LEADOFF', 'MANAGER'];

/** The slot machine: role labels flash by, then lock onto the spun role. */
function RoleSlot({ round, rolling }: { round: DraftRound; rolling: boolean }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!rolling) return;
    const iv = setInterval(() => setT(x => x + 1), 70);
    return () => clearInterval(iv);
  }, [rolling, round]);
  const label = rolling ? ROLE_SPIN[t % ROLE_SPIN.length] : round.roleLabel.toUpperCase();
  return (
    <div className={`roleslot ${rolling ? 'roleslot--spin' : 'roleslot--lock'}`}>
      <div className="roleslot__cap">{rolling ? 'spinning…' : 'now drafting'}</div>
      <div className="roleslot__role">{label}</div>
    </div>
  );
}

/** Up to 5 key ratings for a player, as A-F letters. */
function keyStats(player: Player): { label: string; grade: number }[] {
  const r = getRatings(player);
  const avg = (a: number, b: number) => Math.round((a + b) / 2);
  if (r.kind === 'pitcher') {
    return [
      { label: 'STF', grade: avg(r.stuffVL, r.stuffVR) },
      { label: 'CMD', grade: avg(r.cmdVL, r.cmdVR) },
      { label: 'CTL', grade: r.control },
      { label: 'STM', grade: r.stamina },
    ];
  }
  return [
    { label: 'CON', grade: avg(r.conVL, r.conVR) },
    { label: 'POW', grade: avg(r.hrVL, r.hrVR) },
    { label: 'EYE', grade: r.eye },
    { label: 'SPD', grade: r.run },
    { label: 'FLD', grade: r.field },
  ];
}

/** Compact staff (coach / park) summary line. */
function staffLine(player: Player): string {
  const c = player.coachEffect, p = player.parkEffect;
  const out: string[] = [];
  if (c) {
    if (c.offensiveBonus) out.push(`+${c.offensiveBonus}% OFF`);
    if (c.pitchingBonus) out.push(`+${c.pitchingBonus}% PIT`);
    if (c.clutchBonus) out.push(`+${c.clutchBonus} CLT`);
    if (c.staminaBonus) out.push(`+${c.staminaBonus} STM`);
  }
  if (p) {
    if (p.hrFactor && Math.abs(p.hrFactor - 1) > 0.001) out.push(`HR ×${p.hrFactor.toFixed(2)}`);
    if (p.runFactor && Math.abs(p.runFactor - 1) > 0.001) out.push(`RUN ×${p.runFactor.toFixed(2)}`);
  }
  return out.join(' · ') || (c?.style ?? p?.name ?? '');
}

/** One candidate as a readable text row: grade · name · pos/B/T · key ratings. */
function OptionRow({ player, onPick, onInfo }: { player: Player; onPick: () => void; onInfo: () => void }) {
  const tier = getTier(player.overall);
  const grade = overallToGrade(player.overall);
  const pos = player.positions[0];
  const isStaff = pos === 'HC' || pos === 'ST';
  return (
    <div className="opt" style={{ ['--opt-tier' as never]: TIER_COLORS[tier] }}>
      <button className="opt__pick" onClick={onPick}>
        <span className="opt__grade">{grade}</span>
        <span className="opt__id">
          <span className="opt__name">{abbrevName(player.name)}</span>
          <span className="opt__meta">
            {isStaff ? (pos === 'HC' ? 'Manager' : 'Ballpark') : `${pos} · ${player.bats}/${player.throws}`}
          </span>
        </span>
        {isStaff ? (
          <span className="opt__staff">{staffLine(player)}</span>
        ) : (
          <span className="opt__stats">
            {keyStats(player).map(s => (
              <span key={s.label} className="opt__stat">
                <i>{s.label}</i>
                <b style={{ color: getGradeColor(s.grade) }}>{gradeToLetter(s.grade)}</b>
              </span>
            ))}
          </span>
        )}
      </button>
      <button className="opt__info" onClick={onInfo} aria-label="Player details">ℹ</button>
    </div>
  );
}

/** A glanceable ribbon of every filled slot, in pick order. */
function RosterRibbon({ draftLog, total }: { draftLog: DraftEntry[]; total: number }) {
  if (draftLog.length === 0) return <span className="rribbon__empty">Your roster fills in here — tap to manage</span>;
  return (
    <>
      <span className="rribbon__count">{draftLog.length}/{total}</span>
      <span className="rribbon__chips">
        {draftLog.map((e, i) => (
          <span key={i} className="rribbon__chip">
            <i>{ROLE_ABBR[e.role] ?? e.role}</i> {abbrevName(e.player.name).split(' ').slice(-2).join(' ')}
          </span>
        ))}
      </span>
    </>
  );
}

const ROLE_ABBR: Record<string, string> = {
  C: 'C', '1B': '1B', '2B': '2B', '3B': '3B', SS: 'SS', LF: 'LF', CF: 'CF', RF: 'RF', DH: 'DH',
  SP: 'SP', RP: 'RP', CL: 'CL', SU: 'SU', HC: 'MGR', ST: 'PARK', BN: 'BN',
};

// ---------------------------------------------------------------------------
// The Gauntlet — auto-runs the whole run; the "This Run" list fills in live
// ---------------------------------------------------------------------------
export function GauntletRunScreen({ g }: { g: G }) {
  const { history, streak, team } = g.state;
  const foe = g.currentFoe;
  return (
    <div className="stack" style={{ marginTop: 18, gap: 14 }}>
      <div className="center stack" style={{ gap: 2 }}>
        <span className="dim" style={{ letterSpacing: 2.5, fontSize: 11 }}>THE GAUNTLET</span>
        <h1 style={{ fontSize: 58, color: 'var(--amber)' }}>{streak}-0</h1>
        <strong style={{ fontSize: 18 }}>{team?.name}</strong>
      </div>

      <div className="runlist">
        {history.map((h, i) => (
          <div key={i} className={`runrow ${h.won ? 'runrow--w' : 'runrow--l'}`}>
            <span className="runrow__n">{i + 1}</span>
            <span className="runrow__foe">{h.won ? '✓' : '✕'} {h.opponentName}</span>
            <span className="runrow__score">{h.wins}–{h.losses}</span>
          </div>
        ))}
        {foe && (
          <div className="runrow runrow--live">
            <span className="runrow__n">{history.length + 1}</span>
            <span className="runrow__foe">{foe.emoji ? `${foe.emoji} ` : ''}{foe.displayName}</span>
            <span className="runrow__score"><span className="livedot" /> live</span>
          </div>
        )}
      </div>

      {foe?.blurb && <p className="dim center" style={{ fontSize: 12, fontStyle: 'italic' }}>{foe.blurb}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Team sheet + roster editor share these grouped sections.
// ---------------------------------------------------------------------------
const sheetName = abbrevName;
// Roster sections, in draft order — one cursor walks the draftLog per role.
const SHEET_SECTIONS: { title: string; slots: { role: Position; label: string }[] }[] = [
  { title: 'LINEUP', slots: [
    { role: 'C', label: 'C' }, { role: '1B', label: '1B' }, { role: '2B', label: '2B' },
    { role: '3B', label: '3B' }, { role: 'SS', label: 'SS' }, { role: 'LF', label: 'LF' },
    { role: 'CF', label: 'CF' }, { role: 'RF', label: 'RF' }, { role: 'DH', label: 'DH' },
  ]},
  { title: 'ROTATION', slots: [
    { role: 'SP', label: 'SP1' }, { role: 'SP', label: 'SP2' }, { role: 'SP', label: 'SP3' }, { role: 'SP', label: 'SP4' },
  ]},
  { title: 'BULLPEN', slots: [
    { role: 'RP', label: 'RP1' }, { role: 'RP', label: 'RP2' }, { role: 'RP', label: 'RP3' },
  ]},
  { title: 'STAFF', slots: [{ role: 'HC', label: 'MGR' }, { role: 'ST', label: 'PARK' }] },
];
/** Clean, screenshot-friendly roster list — easy to read + share on socials. */
function TeamSheet({ draftLog, teamName, record }: { draftLog: DraftEntry[]; teamName: string; record: string }) {
  const cursor = new Map<string, number>();
  const Section = ({ s }: { s: typeof SHEET_SECTIONS[number] }) => (
    <div className="tsheet__sec">
      <div className="tsheet__sectitle">{s.title}</div>
      {s.slots.map((slot, i) => {
        const idx = cursor.get(slot.role) ?? 0;
        cursor.set(slot.role, idx + 1);
        const p = draftLog.filter(e => e.role === slot.role)[idx]?.player;
        const color = p ? TIER_COLORS[getTier(p.overall)] : 'var(--ink-faint)';
        return (
          <div key={i} className="tsheet__row">
            <span className="tsheet__pos">{slot.label}</span>
            <span className="tsheet__nm">{p ? sheetName(p.name) : '—'}</span>
            <span className="tsheet__gr" style={{ color }}>{p ? overallToGrade(p.overall) : ''}</span>
          </div>
        );
      })}
    </div>
  );
  return (
    <div className="tsheet">
      <div className="tsheet__hd">
        <span className="tsheet__team">{teamName}</span>
        <span className="tsheet__rec">{record}</span>
      </div>
      <div className="tsheet__cols">
        <div className="tsheet__col"><Section s={SHEET_SECTIONS[0]} /></div>
        <div className="tsheet__col">
          {SHEET_SECTIONS.slice(1).map(s => <Section key={s.title} s={s} />)}
        </div>
      </div>
      <div className="tsheet__tag">⚾ DUGOUT GAUNTLET</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roster review — set your lineup before locking the roster in
// ---------------------------------------------------------------------------
export function RosterReviewScreen({ g }: { g: G }) {
  const { draftLog, teamName } = g.state;
  const [sel, setSel] = useState<number | null>(null);

  // Map each grouped display slot to its draftLog index (one cursor per role).
  const byRole = new Map<string, number[]>();
  draftLog.forEach((e, i) => { const a = byRole.get(e.role) ?? []; a.push(i); byRole.set(e.role, a); });

  // Which slots can legally swap with the selected one (each fits the other's role).
  const targets = new Set<number>();
  if (sel != null) {
    const si = draftLog[sel];
    draftLog.forEach((e, j) => {
      if (j !== sel && playerFitsRole(e.player, si.role) && playerFitsRole(si.player, e.role)) targets.add(j);
    });
  }
  const tap = (idx: number) => {
    if (sel == null || sel === idx) setSel(sel === idx ? null : idx);
    else if (targets.has(idx)) { g.swapSlots(sel, idx); setSel(null); }
    else setSel(idx);
  };

  const cursor = new Map<string, number>();
  return (
    <div className="stack" style={{ marginTop: 16, gap: 12 }}>
      <div className="center stack" style={{ gap: 2 }}>
        <span className="dim" style={{ letterSpacing: 2, fontSize: 11 }}>SET YOUR LINEUP</span>
        <h1 style={{ fontSize: 23 }}>{teamName}</h1>
        <p className="dim" style={{ fontSize: 12 }}>Tap a player, then a highlighted slot to swap. Put your bats where you want them.</p>
      </div>
      <div className="redit">
        {SHEET_SECTIONS.map(sec => (
          <div key={sec.title} className="redit__sec">
            <div className="redit__title">{sec.title}</div>
            {sec.slots.map((slot, n) => {
              const k = cursor.get(slot.role) ?? 0; cursor.set(slot.role, k + 1);
              const idx = (byRole.get(slot.role) ?? [])[k];
              const p = idx != null ? draftLog[idx]?.player : undefined;
              const color = p ? TIER_COLORS[getTier(p.overall)] : 'var(--ink-faint)';
              const isSel = idx === sel;
              const isTgt = idx != null && targets.has(idx);
              return (
                <button key={n} className={`redit__row${isSel ? ' redit__row--sel' : ''}${isTgt ? ' redit__row--tgt' : ''}`}
                  onClick={() => idx != null && tap(idx)} disabled={idx == null}>
                  <span className="redit__pos">{slot.label}</span>
                  <span className="redit__nm">{p ? sheetName(p.name) : '—'}</span>
                  <span className="redit__gr" style={{ color }}>{p ? overallToGrade(p.overall) : ''}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <button className="btn" onClick={g.submitRoster}>🔒 Lock roster & start the gauntlet</button>
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
  const award = useMemo(() => runAwards(g.state.runStats), [g.state.runStats]);
  const [shared, setShared] = useState(false);
  const [imgState, setImgState] = useState<'idle' | 'working' | 'shared' | 'saved'>('idle');
  const [ladderState, setLadderState] = useState<'idle' | 'sending' | 'sent'>('idle');

  // Build the share-image sections from the drafted roster (same grouping as the team sheet).
  const shareImage = async () => {
    if (imgState === 'working') return;
    setImgState('working');
    const cursor = new Map<string, number>();
    const sections: ShareSection[] = SHEET_SECTIONS.map(sec => ({
      title: sec.title,
      rows: sec.slots.map(slot => {
        const k = cursor.get(slot.role) ?? 0; cursor.set(slot.role, k + 1);
        const p = g.state.draftLog.filter(e => e.role === slot.role)[k]?.player;
        return {
          pos: slot.label,
          name: p ? abbrevName(p.name) : '—',
          grade: p ? overallToGrade(p.overall) : '',
          color: p ? TIER_HEX[getTier(p.overall)] : '#56678a',
        };
      }),
    }));
    const sub = `${runDiff >= 0 ? '+' : ''}${runDiff} run diff${hof ? ` · #${hof.rank} all-time` : ''}`;
    try {
      const res = await shareTeamImage(team?.name ?? 'My Squad', `${streak}-0`, sub, sections);
      setImgState(res);
    } catch { setImgState('idle'); }
  };

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
    (award.mvp ? `\nRun MVP: ${award.mvp.name} — ${award.mvp.hr} HR` : '') +
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

      <TeamSheet draftLog={g.state.draftLog} teamName={team?.name ?? 'My Squad'} record={`${streak}-0`} />

      <div className="card stack" style={{ width: '100%', gap: 8 }}>
        <Row label="Series won" value={`${streak}`} />
        <Row label="Run differential" value={`${runDiff >= 0 ? '+' : ''}${runDiff}`} />
        <Row label="Runs for / against" value={`${totalRunsFor} / ${totalRunsAgainst}`} />
        {hof && <Row label="Hall of Fame" value={`#${hof.rank} all-time`} highlight />}
      </div>

      {(award.mvp || award.ace) && (
        <div className="card stack" style={{ width: '100%', gap: 8 }}>
          <h2 style={{ fontSize: 16 }}>🏆 Run Awards</h2>
          {award.mvp && (
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span>🏅 <strong>{award.mvp.name}</strong> <span className="dim">MVP</span></span>
              <span className="dim">{fmtAvg(award.mvp.avg)}, {award.mvp.hr} HR, {award.mvp.rbi} RBI</span>
            </div>
          )}
          {award.ace && (
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span>🔥 <strong>{award.ace.name}</strong> <span className="dim">Ace</span></span>
              <span className="dim">{award.ace.era.toFixed(2)} ERA, {award.ace.so} K</span>
            </div>
          )}
        </div>
      )}

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
      <button className="btn btn--secondary" onClick={shareImage} disabled={imgState === 'working'}>
        {imgState === 'working' ? 'Building…' : imgState === 'shared' ? '✓ Shared!' : imgState === 'saved' ? '✓ Image saved!' : '📸 Share team image'}
      </button>
      <button className="btn btn--ghost" onClick={share}>
        {shared ? '✓ Copied!' : '📲 Share as text'}
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
