import { Player, ScoutingGrades } from '../domain/types';
import { getTier, TIER_COLORS } from '../domain/players';
import { isPitcher, getPositionLabel, gradeToLetter, getGradeColor, formatBattingAvg, formatERA } from '../domain/sim/helpers';
import { inferGradesFromStats } from '../domain/sim/simulation';

// Which grades to chart for each player type.
const HITTER_AXES: { key: keyof ScoutingGrades; label: string }[] = [
  { key: 'contact', label: 'CON' }, { key: 'power', label: 'POW' }, { key: 'speed', label: 'SPD' },
  { key: 'fielding', label: 'FLD' }, { key: 'arm', label: 'ARM' }, { key: 'eye', label: 'EYE' },
];
const PITCHER_AXES: { key: keyof ScoutingGrades; label: string }[] = [
  { key: 'fastball', label: 'VELO' }, { key: 'breaking', label: 'BRK' }, { key: 'changeup', label: 'CHG' },
  { key: 'control', label: 'CTL' }, { key: 'stamina', label: 'STA' },
];

function norm(g: number) { return Math.max(0, Math.min(1, (g - 20) / 60)); }

function Radar({ grades, axes, color }: { grades: ScoutingGrades; axes: typeof HITTER_AXES; color: string }) {
  const size = 220, cx = size / 2, cy = size / 2, R = 84;
  const n = axes.length;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const rings = [0.25, 0.5, 0.75, 1].map(f =>
    axes.map((_, i) => pt(i, R * f).join(',')).join(' ')
  );
  const valuePts = axes.map((ax, i) => pt(i, R * norm(grades[ax.key] ?? 50)).join(',')).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings.map((r, i) => (
        <polygon key={i} points={r} fill="none" stroke="var(--line)" strokeWidth="1" />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)" strokeWidth="1" />;
      })}
      <polygon points={valuePts} fill={color} fillOpacity="0.35" stroke={color} strokeWidth="2" />
      {axes.map((ax, i) => {
        const [x, y] = pt(i, R + 16);
        return (
          <text key={i} x={x} y={y} fill="var(--text-dim)" fontSize="11" fontWeight="800"
            textAnchor="middle" dominantBaseline="middle">{ax.label}</text>
        );
      })}
    </svg>
  );
}

function GradeBars({ grades, axes }: { grades: ScoutingGrades; axes: typeof HITTER_AXES }) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      {axes.map(ax => {
        const v = grades[ax.key] ?? 50;
        const c = getGradeColor(v);
        return (
          <div key={ax.key} className="row" style={{ gap: 8 }}>
            <span className="dim" style={{ width: 38, fontSize: 12, fontWeight: 800 }}>{ax.label}</span>
            <div className="progress" style={{ flex: 1, height: 8 }}>
              <div className="progress__fill" style={{ width: `${norm(v) * 100}%`, background: c }} />
            </div>
            <span style={{ width: 26, textAlign: 'right', fontSize: 12, fontWeight: 900, color: c }}>{gradeToLetter(v)}</span>
          </div>
        );
      })}
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
  const pitcher = isPitcher(player);
  const isStaff = player.positions.includes('HC') || player.positions.includes('ST');
  const grades = player.grades ?? inferGradesFromStats(player);
  const axes = pitcher ? PITCHER_AXES : HITTER_AXES;
  const s = player.stats;

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal__card" onClick={e => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{player.name}</div>
            {player.nickname && <div style={{ color, fontWeight: 700, fontSize: 13 }}>“{player.nickname}”</div>}
            <div className="dim" style={{ fontSize: 12 }}>
              {player.positions.map(getPositionLabel).join(' / ')} · {player.team} · {player.era ?? ''}
            </div>
          </div>
          <div className="tile__ovr" style={{ background: color, minWidth: 48, height: 48, fontSize: 22 }}>{player.overall}</div>
        </div>

        {!isStaff && (
          <>
            <div className="center"><Radar grades={grades} axes={axes} color={color} /></div>
            <GradeBars grades={grades} axes={axes} />

            <div className="statline">
              {pitcher ? (
                <>
                  <Stat k="ERA" v={s.era != null ? formatERA(s.era) : '—'} />
                  <Stat k="WHIP" v={s.whip != null ? s.whip.toFixed(2) : '—'} />
                  <Stat k="K/9" v={s.k9 != null ? s.k9.toFixed(1) : '—'} />
                  <Stat k="BB/9" v={s.bb9 != null ? s.bb9.toFixed(1) : '—'} />
                </>
              ) : (
                <>
                  <Stat k="AVG" v={s.avg != null ? formatBattingAvg(s.avg) : '—'} />
                  <Stat k="OBP" v={s.obp != null ? formatBattingAvg(s.obp) : '—'} />
                  <Stat k="SLG" v={s.slg != null ? formatBattingAvg(s.slg) : '—'} />
                  <Stat k="HR" v={s.hr != null ? `${s.hr}` : '—'} />
                </>
              )}
            </div>
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

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="stat">
      <div className="stat__k">{k}</div>
      <div className="stat__v">{v}</div>
    </div>
  );
}
