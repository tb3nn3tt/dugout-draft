import { Player } from '../domain/types';
import { getTier, TIER_COLORS } from '../domain/players';
import { getGradeColor, gradeToLetter } from '../domain/sim/helpers';
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

/** A split rating shown as A-F: small vL · big TOTAL · small vR. */
function Split({ label, vL, total, vR }: { label: string; vL: number; total: number; vR: number }) {
  return (
    <div className="sg">
      <span className="sg__lbl">{label}</span>
      <span className="sg__side">{gradeToLetter(vL)}</span>
      <span className="sg__total" style={{ color: getGradeColor(total) }}>{gradeToLetter(total)}</span>
      <span className="sg__side">{gradeToLetter(vR)}</span>
    </div>
  );
}

/** A single (non-split) rating as A-F. */
function G({ label, v }: { label: string; v: number }) {
  return <span className="g1"><span className="g1__l">{label}</span><b style={{ color: getGradeColor(v) }}>{gradeToLetter(v)}</b></span>;
}

function Body({ player }: { player: Player }) {
  const r = getRatings(player);
  if (r.kind === 'hitter') {
    return (
      <div className="ratings">
        <div className="ratings__head"><span /><span className="ratings__hl">vL</span><span /><span className="ratings__hr">vR</span></div>
        <Split label="CONTACT" vL={r.conVL} total={avg(r.conVL, r.conVR)} vR={r.conVR} />
        <div className="powgrp">
          <span className="powgrp__lbl">POWER</span>
          <div className="powgrp__rows">
            <Split label="HR" vL={r.hrVL} total={avg(r.hrVL, r.hrVR)} vR={r.hrVR} />
            <Split label="GAP" vL={r.gapVL} total={avg(r.gapVL, r.gapVR)} vR={r.gapVR} />
          </div>
        </div>
        <div className="g1row">
          <G label="EYE" v={r.eye} /><G label="RUN" v={r.run} /><G label="FLD" v={r.field} /><G label="BUNT" v={r.bunt} />
        </div>
      </div>
    );
  }
  return (
    <div className="ratings">
      <div className="ratings__head"><span /><span className="ratings__hl">vL</span><span /><span className="ratings__hr">vR</span></div>
      <Split label="STUFF" vL={r.stuffVL} total={avg(r.stuffVL, r.stuffVR)} vR={r.stuffVR} />
      <Split label="COMMAND" vL={r.cmdVL} total={avg(r.cmdVL, r.cmdVR)} vR={r.cmdVR} />
      <div className="g1row">
        <G label="CTL" v={r.control} /><G label="STAM" v={r.stamina} />
        <span className="g1"><span className="g1__l">GB</span><b>{r.gb}%</b></span>
        <span className="g1"><span className="g1__l">IP/G</span><b>{r.ipg.toFixed(1)}</b></span>
      </div>
    </div>
  );
}

function StaffBody({ player }: { player: Player }) {
  const c = player.coachEffect, p = player.parkEffect;
  if (c) return (
    <div className="ratings">
      <div className="tile__stats" style={{ color: 'var(--accent)' }}>{c.style}</div>
      <div className="g1row">
        <span className="g1"><span className="g1__l">OFF</span><b>+{c.offensiveBonus}%</b></span>
        <span className="g1"><span className="g1__l">PIT</span><b>+{c.pitchingBonus}%</b></span>
        <span className="g1"><span className="g1__l">CLT</span><b>+{c.clutchBonus}</b></span>
        <span className="g1"><span className="g1__l">STA</span><b>+{c.staminaBonus}</b></span>
        <span className="g1"><span className="g1__l">SPD</span><b>+{c.speedBonus}</b></span>
        <span className="g1"><span className="g1__l">FLD</span><b>+{c.fieldingBonus}</b></span>
      </div>
    </div>
  );
  if (p) return (
    <div className="ratings">
      <div className="tile__stats" style={{ color: 'var(--accent)' }}>{p.name}</div>
      <div className="g1row">
        <span className="g1"><span className="g1__l">HR</span><b>×{p.hrFactor}</b></span>
        <span className="g1"><span className="g1__l">2B</span><b>×{p.doublesFactor}</b></span>
        <span className="g1"><span className="g1__l">3B</span><b>×{p.triplesFactor}</b></span>
        <span className="g1"><span className="g1__l">RUN</span><b>×{p.runFactor}</b></span>
        <span className="g1"><span className="g1__l">ERR</span><b>×{p.errorFactor}</b></span>
      </div>
    </div>
  );
  return null;
}

/** Draftable card: A-F ratings (vL · TOTAL · vR), grouped power; ℹ for full. */
export function CardTile({ player, onPick, onInfo }: {
  player: Player;
  onPick?: (p: Player) => void;
  onInfo?: (p: Player) => void;
}) {
  const tier = getTier(player.overall);
  const tierColor = TIER_COLORS[tier];
  const pos = player.positions[0];
  const isStaff = pos === 'HC' || pos === 'ST';

  return (
    <div className="tile" style={{ borderColor: tierColor }}>
      <button className="tile__main" onClick={onPick ? () => onPick(player) : undefined} disabled={!onPick}>
        <div className="tile__top">
          <div className="tile__ovr" style={{ background: tierColor }}>{player.overall}</div>
          <div className="tile__id">
            <div className="tile__name">{cleanName(player.name)}</div>
            <div className="tile__meta dim">
              {player.nickname ? `“${player.nickname}” · ` : ''}{player.team}{player.era ? ` · ${player.era}` : ''}
            </div>
          </div>
          <div className="tile__right">
            <div className="tile__pos" style={{ color: tierColor }}>{POS_LABEL[pos] ?? pos}</div>
            <div className="tile__tier" style={{ color: tierColor }}>{TIER_LABEL[tier]}</div>
          </div>
        </div>
        {isStaff ? <StaffBody player={player} /> : <Body player={player} />}
      </button>
      {onInfo && <button className="tile__info" onClick={() => onInfo(player)} aria-label="Player details">ℹ</button>}
    </div>
  );
}
