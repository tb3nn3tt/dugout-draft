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

interface RRow { label: string; vL?: number; ovr: number; vR?: number }

/** The ratings table rows: vL/OVR/vR for platoon ratings, OVR only for the rest. */
function ratingRows(player: Player): RRow[] {
  const r = getRatings(player);
  if (r.kind === 'pitcher') {
    return [
      { label: 'STUFF', vL: r.stuffVL, ovr: avg(r.stuffVL, r.stuffVR), vR: r.stuffVR },
      { label: 'CMD', vL: r.cmdVL, ovr: avg(r.cmdVL, r.cmdVR), vR: r.cmdVR },
      { label: 'CTL', ovr: r.control },
      { label: 'STAM', ovr: r.stamina },
    ];
  }
  return [
    { label: 'CON', vL: r.conVL, ovr: avg(r.conVL, r.conVR), vR: r.conVR },
    { label: 'POW', vL: r.hrVL, ovr: avg(r.hrVL, r.hrVR), vR: r.hrVR },
    { label: 'GAP', vL: r.gapVL, ovr: avg(r.gapVL, r.gapVR), vR: r.gapVR },
    { label: 'EYE', ovr: r.eye },
    { label: 'SPD', ovr: r.run },
    { label: 'FLD', ovr: r.field },
  ];
}

/** Non-zero coach / park effects, as compact chips. */
function staffChips(player: Player): { label: string; val: string }[] {
  const c = player.coachEffect, p = player.parkEffect;
  const out: { label: string; val: string }[] = [];
  if (c) {
    const add = (label: string, v: number, sfx = '') => { if (v) out.push({ label, val: `+${v}${sfx}` }); };
    add('OFF', c.offensiveBonus, '%'); add('PIT', c.pitchingBonus, '%');
    add('CLUTCH', c.clutchBonus); add('STAM', c.staminaBonus);
    add('SPD', c.speedBonus); add('DEF', c.fieldingBonus);
  }
  if (p) {
    const mul = (label: string, v?: number) => { if (v != null && Math.abs(v - 1) > 0.001) out.push({ label, val: `×${v.toFixed(2)}` }); };
    mul('HR', p.hrFactor); mul('2B', p.doublesFactor); mul('3B', p.triplesFactor);
    mul('RUN', p.runFactor); mul('ERR', p.errorFactor);
  }
  return out;
}

function Cell({ v }: { v?: number }) {
  if (v == null) return <span className="rtab__side" />;
  return <span className="rtab__side">{gradeToLetter(v)}</span>;
}

/** A clean scouting card: grade, name, pos · B/T, and a bordered ratings table. */
export function CardTile({ player, onPick, onInfo }: {
  player: Player;
  onPick?: (p: Player) => void;
  onInfo?: (p: Player) => void;
}) {
  const tier = getTier(player.overall);
  const tierColor = TIER_COLORS[tier];
  const pos = player.positions[0];
  const isStaff = pos === 'HC' || pos === 'ST';
  const meta = isStaff
    ? (player.coachEffect?.style ?? player.parkEffect?.name ?? '')
    : `${POS_LABEL[pos] ?? pos} · ${player.bats}/${player.throws}`;

  return (
    <div className={`scard scard--${tier}`} style={{ ['--tile-tier' as never]: tierColor }}>
      <button className="scard__pick" onClick={onPick ? () => onPick(player) : undefined} disabled={!onPick}>
        <div className="scard__top">
          <span className="scard__grade">{overallToGrade(player.overall)}</span>
          <div className="scard__id">
            <span className="scard__name">{cleanName(player.name)}</span>
            <span className="scard__meta">{meta}</span>
          </div>
        </div>

        {!isStaff ? (
          <div className="rtab">
            <span className="rtab__h rtab__h--lbl" />
            <span className="rtab__h">vL</span><span className="rtab__h">OVR</span><span className="rtab__h">vR</span>
            {ratingRows(player).map(row => (
              <RowCells key={row.label} row={row} />
            ))}
          </div>
        ) : (
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

function RowCells({ row }: { row: RRow }) {
  return (
    <>
      <span className="rtab__lbl">{row.label}</span>
      <Cell v={row.vL} />
      <span className="rtab__ovr" style={{ color: getGradeColor(row.ovr) }}>{gradeToLetter(row.ovr)}</span>
      <Cell v={row.vR} />
    </>
  );
}
