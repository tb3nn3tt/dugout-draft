import { Player } from '../domain/types';
import { getTier, TIER_COLORS } from '../domain/players';
import { getGradeColor, gradeToLetter, overallToGrade } from '../domain/sim/helpers';
import { getRatings } from '../domain/ratings';

const POS_LABEL: Record<string, string> = {
  C: 'C', '1B': '1B', '2B': '2B', '3B': '3B', SS: 'SS', LF: 'LF', CF: 'CF', RF: 'RF', DH: 'DH',
  BC: 'C', PH: 'PH', PR: 'PR', IFD: 'IF', OFD: 'OF',
  SP: 'SP', CL: 'CL', SU: 'SU', MRP: 'RP', LRP: 'RP', LOOGY: 'LHP', HC: 'MGR', ST: 'PARK',
};
const TIER_LABEL: Record<string, string> = {
  diamond: 'DIAMOND', gold: 'GOLD', silver: 'SILVER', bronze: 'BRONZE', common: 'COMMON',
};
const avg = (a: number, b: number) => Math.round((a + b) / 2);
const cleanName = (n: string) => n.replace(/\s*\([^)]*\)\s*$/, '').trim() || n;
// 20-80 scouting grade → 0-100% bar fill.
const pct = (g: number) => Math.max(4, Math.min(100, Math.round(((g - 20) / 60) * 100)));

/** A one-glance "what is this player" tag, derived from the ratings. */
function archetype(player: Player): { emoji: string; label: string } {
  const r = getRatings(player);
  if (r.kind === 'pitcher') {
    if (player.positions.includes('LOOGY')) return { emoji: '🥷', label: 'LEFTY SPEC' };
    const stuff = avg(r.stuffVL, r.stuffVR), cmd = avg(r.cmdVL, r.cmdVR);
    if (player.positions.includes('CL')) return { emoji: '🔒', label: 'CLOSER' };
    if (stuff >= 66) return { emoji: '🔥', label: 'POWER ARM' };
    if (r.control >= 66) return { emoji: '🎯', label: 'CONTROL' };
    if (r.gb >= 50) return { emoji: '⬇️', label: 'GROUNDBALL' };
    if (cmd >= 64) return { emoji: '🧠', label: 'CRAFTY' };
    if (r.stamina >= 68) return { emoji: '🐴', label: 'WORKHORSE' };
    return { emoji: '⚾', label: 'INNINGS' };
  }
  const con = avg(r.conVL, r.conVR), hr = avg(r.hrVL, r.hrVR), gap = avg(r.gapVL, r.gapVR);
  const tools = [hr >= 62, con >= 62, r.run >= 62, r.field >= 62, r.eye >= 62].filter(Boolean).length;
  if (tools >= 4) return { emoji: '⭐', label: '5-TOOL' };
  if (hr >= 66) return { emoji: '💪', label: 'SLUGGER' };
  if (con >= 66) return { emoji: '🎯', label: 'CONTACT' };
  if (gap >= 62 && con >= 58) return { emoji: '↔️', label: 'GAP HITTER' };
  if (r.run >= 66) return { emoji: '⚡', label: 'SPEEDSTER' };
  if (r.eye >= 66) return { emoji: '👁️', label: 'ON-BASE' };
  if (r.field >= 66) return { emoji: '🧤', label: 'GLOVE' };
  if (r.bunt >= 60) return { emoji: '🎽', label: 'SMALL BALL' };
  return { emoji: '⚾', label: 'BALANCED' };
}

/** The three headline ratings to show as bars, chosen by player kind. */
function headlineBars(player: Player): { label: string; g: number }[] {
  const r = getRatings(player);
  if (r.kind === 'pitcher') {
    return [
      { label: 'STUF', g: avg(r.stuffVL, r.stuffVR) },
      { label: 'CTL', g: r.control },
      { label: 'STAM', g: r.stamina },
    ];
  }
  return [
    { label: 'CON', g: avg(r.conVL, r.conVR) },
    { label: 'POW', g: avg(r.hrVL, r.hrVR) },
    { label: 'SPD', g: r.run },
  ];
}

function Bar({ label, g }: { label: string; g: number }) {
  const color = getGradeColor(g);
  return (
    <div className="pcard__bar">
      <span className="pcard__blbl">{label}</span>
      <span className="pcard__track"><span className="pcard__fill" style={{ width: `${pct(g)}%`, background: color }} /></span>
      <span className="pcard__bv" style={{ color }}>{gradeToLetter(g)}</span>
    </div>
  );
}

/** Two headline effect chips for a coach/park card. */
function staffLines(player: Player): { label: string; val: string }[] {
  const c = player.coachEffect, p = player.parkEffect;
  if (c) return [
    { label: c.style ?? 'SKIPPER', val: '' },
    { label: 'OFFENSE', val: `+${c.offensiveBonus}%` },
    { label: 'PITCHING', val: `+${c.pitchingBonus}%` },
  ];
  if (p) return [
    { label: p.name ?? 'BALLPARK', val: '' },
    { label: 'HR', val: `×${p.hrFactor}` },
    { label: 'RUNS', val: `×${p.runFactor}` },
  ];
  return [];
}

/** Compact premium draft card: grade + position, archetype, headline rating bars. */
export function CardTile({ player, onPick, onInfo }: {
  player: Player;
  onPick?: (p: Player) => void;
  onInfo?: (p: Player) => void;
}) {
  const tier = getTier(player.overall);
  const tierColor = TIER_COLORS[tier];
  const pos = player.positions[0];
  const isStaff = pos === 'HC' || pos === 'ST';
  const arch = !isStaff ? archetype(player) : null;
  const bars = !isStaff ? headlineBars(player) : [];
  const lines = isStaff ? staffLines(player) : [];

  return (
    <div className={`pcard pcard--${tier}`} style={{ ['--tile-tier' as never]: tierColor }}>
      <button className="pcard__btn" onClick={onPick ? () => onPick(player) : undefined} disabled={!onPick}>
        <div className="pcard__head">
          <span className="pcard__grade">{overallToGrade(player.overall)}</span>
          <span className="pcard__pos">{POS_LABEL[pos] ?? pos}</span>
        </div>
        <div className="pcard__name">{cleanName(player.name)}</div>
        {arch && <div className="pcard__arch">{arch.emoji} {arch.label}</div>}
        {isStaff && lines[0] && <div className="pcard__arch">{lines[0].label}</div>}

        {!isStaff && <div className="pcard__bars">{bars.map(b => <Bar key={b.label} {...b} />)}</div>}
        {isStaff && (
          <div className="pcard__bars">
            {lines.slice(1).map(l => (
              <div key={l.label} className="pcard__bar pcard__bar--staff">
                <span className="pcard__blbl">{l.label}</span>
                <span className="pcard__bv" style={{ color: tierColor }}>{l.val}</span>
              </div>
            ))}
          </div>
        )}

        <div className="pcard__foot">
          {isStaff ? TIER_LABEL[tier] : `${player.bats}/${player.throws} · ${player.team}`}
        </div>
      </button>
      {onInfo && <button className="pcard__info" onClick={() => onInfo(player)} aria-label="Player details">ℹ</button>}
    </div>
  );
}
