import { Player } from '../domain/types';
import { getTier, TIER_COLORS } from '../domain/players';
import { getPositionLabel, gradeToLetter, getGradeColor } from '../domain/sim/helpers';
import { getRatings } from '../domain/ratings';

interface Axis { label: string; value: number; }

function norm(g: number) { return Math.max(0, Math.min(1, (g - 20) / 60)); }

function Radar({ axes, color }: { axes: Axis[]; color: string }) {
  const size = 220, cx = size / 2, cy = size / 2, R = 82;
  const n = axes.length;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const rings = [0.25, 0.5, 0.75, 1].map(f => axes.map((_, i) => pt(i, R * f).join(',')).join(' '));
  const valuePts = axes.map((ax, i) => pt(i, R * norm(ax.value)).join(',')).join(' ');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings.map((r, i) => <polygon key={i} points={r} fill="none" stroke="var(--line)" strokeWidth="1" />)}
      {axes.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)" strokeWidth="1" />; })}
      <polygon points={valuePts} fill={color} fillOpacity="0.35" stroke={color} strokeWidth="2" />
      {axes.map((ax, i) => { const [x, y] = pt(i, R + 16); return (
        <text key={i} x={x} y={y} fill="var(--text-dim)" fontSize="11" fontWeight="800" textAnchor="middle" dominantBaseline="middle">{ax.label}</text>
      ); })}
    </svg>
  );
}

function Bars({ axes }: { axes: Axis[] }) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      {axes.map(ax => {
        const c = getGradeColor(ax.value);
        return (
          <div key={ax.label} className="row" style={{ gap: 8 }}>
            <span className="dim" style={{ width: 44, fontSize: 12, fontWeight: 800 }}>{ax.label}</span>
            <div className="progress" style={{ flex: 1, height: 8 }}>
              <div className="progress__fill" style={{ width: `${norm(ax.value) * 100}%`, background: c }} />
            </div>
            <span style={{ width: 28, textAlign: 'right', fontSize: 13, fontWeight: 900, color: c }}>{gradeToLetter(ax.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Split({ label, l, r }: { label: string; l: number; r: number }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <span className="dim" style={{ fontSize: 12 }}>{label}</span>
      <span style={{ fontWeight: 800 }}>
        vs L <span style={{ color: getGradeColor(l) }}>{gradeToLetter(l)}</span> &nbsp;·&nbsp; vs R <span style={{ color: getGradeColor(r) }}>{gradeToLetter(r)}</span>
      </span>
    </div>
  );
}

export function PlayerDetail({ player, onDraft, onClose }: {
  player: Player;
  onDraft?: (p: Player) => void;
  onClose: () => void;
}) {
  const tier = getTier(player.overall);
  const color = TIER_COLORS[tier];
  const r = getRatings(player);
  const isStaff = player.positions.includes('HC') || player.positions.includes('ST');

  const axes: Axis[] = !isStaff && r.kind === 'hitter'
    ? [
        { label: 'CON', value: Math.round((r.conVL + r.conVR) / 2) },
        { label: 'HR', value: Math.round((r.hrVL + r.hrVR) / 2) },
        { label: 'GAP', value: Math.round((r.gapVL + r.gapVR) / 2) },
        { label: 'EYE', value: r.eye }, { label: 'RUN', value: r.run },
        { label: 'FLD', value: r.field }, { label: 'BNT', value: r.bunt },
      ]
    : !isStaff && r.kind === 'pitcher'
    ? [
        { label: 'STUFF', value: Math.round((r.stuffVL + r.stuffVR) / 2) },
        { label: 'CTL', value: r.control },
        { label: 'CMD', value: Math.round((r.cmdVL + r.cmdVR) / 2) },
        { label: 'STAM', value: r.stamina },
        { label: 'GB', value: r.gb },
      ]
    : [];

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal__card" onClick={e => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{player.name.replace(/\s*\([^)]*\)\s*$/, '')}</div>
            {player.nickname && <div style={{ color, fontWeight: 700, fontSize: 13 }}>“{player.nickname}”</div>}
            <div className="dim" style={{ fontSize: 12 }}>
              {player.positions.map(getPositionLabel).join(' / ')} · bats {player.bats}/throws {player.throws} · {player.team}
            </div>
          </div>
        </div>

        {!isStaff && (
          <>
            <div className="center"><Radar axes={axes} color={color} /></div>
            <Bars axes={axes} />
            {r.kind === 'hitter' ? (
              <div className="card stack" style={{ gap: 6 }}>
                <strong style={{ fontSize: 13 }}>Platoon Splits</strong>
                <Split label="Contact" l={r.conVL} r={r.conVR} />
                <Split label="HR Power" l={r.hrVL} r={r.hrVR} />
                <Split label="Gap Power" l={r.gapVL} r={r.gapVR} />
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="dim" style={{ fontSize: 12 }}>Bunting</span>
                  <span style={{ fontWeight: 800, color: getGradeColor(r.bunt) }}>{gradeToLetter(r.bunt)}</span>
                </div>
              </div>
            ) : (
              <div className="card stack" style={{ gap: 6 }}>
                <strong style={{ fontSize: 13 }}>Pitcher Splits</strong>
                <Split label="Stuff (K)" l={r.stuffVL} r={r.stuffVR} />
                <Split label="Command" l={r.cmdVL} r={r.cmdVR} />
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="dim" style={{ fontSize: 12 }}>Control</span>
                  <span style={{ fontWeight: 800, color: getGradeColor(r.control) }}>{gradeToLetter(r.control)}</span>
                </div>
              </div>
            )}
          </>
        )}

        {player.coachEffect && (
          <div className="card stack" style={{ gap: 4 }}>
            <strong>{player.coachEffect.style}</strong>
            <span className="dim" style={{ fontSize: 12 }}>
              +{player.coachEffect.offensiveBonus}% offense · +{player.coachEffect.pitchingBonus}% pitching · +{player.coachEffect.clutchBonus} clutch
            </span>
          </div>
        )}
        {player.parkEffect && (
          <div className="card stack" style={{ gap: 4 }}>
            <strong>{player.parkEffect.name}</strong>
            <span className="dim" style={{ fontSize: 12 }}>
              HR ×{player.parkEffect.hrFactor} · 2B ×{player.parkEffect.doublesFactor} · runs ×{player.parkEffect.runFactor}
            </span>
          </div>
        )}

        {player.funFact && <p className="dim" style={{ fontSize: 13, fontStyle: 'italic' }}>{player.funFact}</p>}

        <div className="stack" style={{ gap: 8, marginTop: 4 }}>
          {onDraft && <button className="btn" onClick={() => onDraft(player)}>Draft {player.name.split(' ').slice(-1)} ✓</button>}
          <button className="btn btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

