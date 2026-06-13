import { Player } from '../domain/types';
import { getTier, TIER_COLORS } from '../domain/players';
import { getGradeColor, gradeToLetter, overallToGrade } from '../domain/sim/helpers';
import { getRatings } from '../domain/ratings';

const POS_LABEL: Record<string, string> = {
  C: 'C', '1B': '1B', '2B': '2B', '3B': '3B', SS: 'SS', LF: 'LF', CF: 'CF', RF: 'RF', DH: 'DH',
  BC: 'C', PH: 'PH', PR: 'PR', IFD: 'IF', OFD: 'OF',
  SP: 'SP', CL: 'CL', SU: 'SU', MRP: 'RP', LRP: 'RP', LOOGY: 'LHP', HC: 'MGR', ST: 'PARK',
};
const avg = (a: number, b: number) => Math.round((a + b) / 2);
const cleanName = (n: string) => n.replace(/\s*\([^)]*\)\s*$/, '').trim() || n;
const pct = (g: number) => Math.max(5, Math.min(100, Math.round(((g - 20) / 60) * 100)));
const dec = (n?: number) => (n == null ? '—' : n.toFixed(3).replace(/^0/, '')); // .288

/** One-glance "what is this player" tag from the ratings. */
function archetype(player: Player): string {
  const r = getRatings(player);
  if (r.kind === 'pitcher') {
    if (player.positions.includes('LOOGY')) return '🥷 LEFTY SPEC';
    const stuff = avg(r.stuffVL, r.stuffVR), cmd = avg(r.cmdVL, r.cmdVR);
    if (player.positions.includes('CL')) return '🔒 CLOSER';
    if (stuff >= 66) return '🔥 POWER ARM';
    if (r.control >= 66) return '🎯 CONTROL';
    if (r.gb >= 50) return '⬇️ GROUNDBALL';
    if (cmd >= 64) return '🧠 CRAFTY';
    if (r.stamina >= 68) return '🐴 WORKHORSE';
    return '⚾ INNINGS';
  }
  const con = avg(r.conVL, r.conVR), hr = avg(r.hrVL, r.hrVR), gap = avg(r.gapVL, r.gapVR);
  const tools = [hr >= 62, con >= 62, r.run >= 62, r.field >= 62, r.eye >= 62].filter(Boolean).length;
  if (tools >= 4) return '⭐ 5-TOOL';
  if (hr >= 66) return '💪 SLUGGER';
  if (con >= 66) return '🎯 CONTACT';
  if (gap >= 62 && con >= 58) return '↔️ GAP HITTER';
  if (r.run >= 66) return '⚡ SPEEDSTER';
  if (r.eye >= 66) return '👁️ ON-BASE';
  if (r.field >= 66) return '🧤 GLOVE';
  return '⚾ BALANCED';
}

/** The tool grades to show as bars, by player kind. */
function tools(player: Player): { label: string; g: number }[] {
  const r = getRatings(player);
  if (r.kind === 'pitcher') {
    return [
      { label: 'STUF', g: avg(r.stuffVL, r.stuffVR) },
      { label: 'CTL', g: r.control },
      { label: 'CMD', g: avg(r.cmdVL, r.cmdVR) },
      { label: 'STAM', g: r.stamina },
    ];
  }
  return [
    { label: 'CON', g: avg(r.conVL, r.conVR) },
    { label: 'POW', g: avg(r.hrVL, r.hrVR) },
    { label: 'SPD', g: r.run },
    { label: 'EYE', g: r.eye },
    { label: 'FLD', g: r.field },
  ];
}

/** Effectiveness vs LHP / RHP (the platoon read), 20-80. */
function platoon(player: Player): { vL: number; vR: number } {
  const r = getRatings(player);
  if (r.kind === 'pitcher') {
    return { vL: avg(r.stuffVL, r.cmdVL), vR: avg(r.stuffVR, r.cmdVR) };
  }
  return { vL: Math.round((r.conVL + r.hrVL + r.gapVL) / 3), vR: Math.round((r.conVR + r.hrVR + r.gapVR) / 3) };
}

/** Real-life stat line for recognition + context. */
function statLine(player: Player): string {
  const s = player.stats;
  const r = getRatings(player);
  if (r.kind === 'pitcher') {
    const parts: string[] = [];
    if (s.era != null) parts.push(`${s.era.toFixed(2)} ERA`);
    if (s.k9 != null) parts.push(`${s.k9.toFixed(1)} K/9`);
    parts.push(`${r.gb}% GB`);
    return parts.join(' · ');
  }
  const slash = `${dec(s.avg)}/${dec(s.obp)}/${dec(s.slg)}`;
  return s.hr != null ? `${slash} · ${s.hr} HR` : slash;
}

/** Non-zero coach / park effects, as compact chips. */
function staffChips(player: Player): { label: string; val: string }[] {
  const c = player.coachEffect, p = player.parkEffect;
  const out: { label: string; val: string }[] = [];
  if (c) {
    const add = (label: string, v: number, suffix = '') => { if (v) out.push({ label, val: `+${v}${suffix}` }); };
    add('OFFENSE', c.offensiveBonus, '%'); add('PITCHING', c.pitchingBonus, '%');
    add('CLUTCH', c.clutchBonus); add('STAMINA', c.staminaBonus);
    add('SPEED', c.speedBonus); add('DEFENSE', c.fieldingBonus);
  }
  if (p) {
    const mul = (label: string, v?: number) => { if (v != null && Math.abs(v - 1) > 0.001) out.push({ label, val: `×${v.toFixed(2)}` }); };
    mul('HR', p.hrFactor); mul('2B', p.doublesFactor); mul('3B', p.triplesFactor);
    mul('RUNS', p.runFactor); mul('ERRORS', p.errorFactor);
  }
  return out;
}

function Bar({ label, g }: { label: string; g: number }) {
  const color = getGradeColor(g);
  return (
    <div className="scard__bar">
      <span className="scard__blbl">{label}</span>
      <span className="scard__track"><span className="scard__fill" style={{ width: `${pct(g)}%`, background: color }} /></span>
      <span className="scard__bv" style={{ color }}>{gradeToLetter(g)}</span>
    </div>
  );
}

/** A draftable scouting card: grade, archetype, full tool grades, platoon split, stat line. */
export function CardTile({ player, onPick, onInfo }: {
  player: Player;
  onPick?: (p: Player) => void;
  onInfo?: (p: Player) => void;
}) {
  const tier = getTier(player.overall);
  const tierColor = TIER_COLORS[tier];
  const pos = player.positions[0];
  const isStaff = pos === 'HC' || pos === 'ST';
  const pl = !isStaff ? platoon(player) : null;
  const sub = isStaff
    ? (player.coachEffect?.style ?? player.parkEffect?.name ?? '')
    : archetype(player);

  return (
    <div className={`scard scard--${tier}`} style={{ ['--tile-tier' as never]: tierColor }}>
      <button className="scard__pick" onClick={onPick ? () => onPick(player) : undefined} disabled={!onPick}>
        <div className="scard__top">
          <span className="scard__grade">{overallToGrade(player.overall)}</span>
          <div className="scard__id">
            <span className="scard__name">{cleanName(player.name)}</span>
            <span className="scard__pos">{POS_LABEL[pos] ?? pos}{!isStaff ? ` · ${player.bats}/${player.throws}` : ''}</span>
          </div>
        </div>
        <div className="scard__sub">{sub}</div>

        {!isStaff && (
          <>
            <div className="scard__bars">{tools(player).map(t => <Bar key={t.label} {...t} />)}</div>
            {pl && (
              <div className="scard__split">
                <span>vs LHP <b style={{ color: getGradeColor(pl.vL) }}>{gradeToLetter(pl.vL)}</b></span>
                <span>vs RHP <b style={{ color: getGradeColor(pl.vR) }}>{gradeToLetter(pl.vR)}</b></span>
              </div>
            )}
            <div className="scard__line">{statLine(player)}</div>
          </>
        )}

        {isStaff && (
          <div className="scard__chips">
            {staffChips(player).map(ch => (
              <span key={ch.label} className="scard__chip"><i>{ch.label}</i><b>{ch.val}</b></span>
            ))}
          </div>
        )}
      </button>
      {onInfo && <button className="scard__info" onClick={() => onInfo(player)} aria-label="Player details">ℹ</button>}
    </div>
  );
}
