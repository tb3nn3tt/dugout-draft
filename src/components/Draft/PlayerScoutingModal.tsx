import { Player } from '../../types';
import { getOverallRating, isPitcher, getSpecialtyBadge, getCategoryBadge, gradeToLetter, getGradeColor } from '../../utils/helpers';
import { inferGradesFromStats } from '../../utils/simulation';
import { ScoutingBars } from './ScoutingBars';
import './PlayerScoutingModal.css';

interface PlayerScoutingModalProps {
  player: Player;
  onDraft: () => void;
  onClose: () => void;
}

function getComparable(player: Player): string {
  const grades = player.grades ?? inferGradesFromStats(player);
  const pitcher = isPitcher(player);

  if (pitcher) {
    const fb = grades.fastball ?? 50;
    const brk = grades.breaking ?? 50;
    const ctrl = grades.control ?? 50;
    if (fb >= 75 && brk >= 70 && ctrl >= 70) return 'Dominant ace with a complete arsenal';
    if (fb >= 75 && ctrl < 50) return 'Fireballer who lives and dies by velocity';
    if (ctrl >= 75 && fb < 60) return 'Crafty control artist who paints corners';
    if (brk >= 75) return 'Wipeout stuff that makes hitters look foolish';
    if (fb >= 70 && brk >= 65) return 'Strikeout pitcher with power and movement';
    if (ctrl >= 70 && fb >= 60) return 'Reliable arm who limits walks and damage';
    return 'Solid middle-of-the-rotation arm';
  } else {
    const con = grades.contact ?? 50;
    const pow = grades.power ?? 50;
    const spd = grades.speed ?? 50;
    const eye = grades.eye ?? 50;
    const fld = grades.fielding ?? 50;
    if (con >= 65 && pow >= 65 && spd >= 65 && fld >= 65) return 'Elite five-tool talent';
    if (pow >= 75 && spd >= 65) return 'Rare power-speed combo who terrorizes pitchers';
    if (pow >= 75) return 'Dangerous power bat who can change the game with one swing';
    if (spd >= 75 && con >= 60) return 'Dynamic table-setter who wreaks havoc on the bases';
    if (con >= 75 && eye >= 70) return 'Pure hitter with elite bat control';
    if (eye >= 75) return 'Patient on-base machine who works deep counts';
    if (fld >= 75) return 'Premium defender who makes highlight-reel plays';
    if (pow >= 65 && con >= 65) return 'Well-rounded middle-of-the-order bat';
    return 'Solid all-around contributor';
  }
}

function RadarChart({ player }: { player: Player }) {
  const grades = player.grades ?? inferGradesFromStats(player);
  const pitcher = isPitcher(player);

  const labels = pitcher
    ? [
        { key: 'fastball' as const, label: 'VEL' },
        { key: 'breaking' as const, label: 'BRK' },
        { key: 'control' as const, label: 'CMD' },
        { key: 'stamina' as const, label: 'STM' },
      ]
    : [
        { key: 'contact' as const, label: 'BAT' },
        { key: 'power' as const, label: 'POW' },
        { key: 'speed' as const, label: 'SPD' },
        { key: 'eye' as const, label: 'EYE' },
        { key: 'fielding' as const, label: 'DEF' },
      ];

  const n = labels.length;
  const cx = 100, cy = 100, maxR = 75;
  const angleOffset = -Math.PI / 2; // Start from top

  function getPoint(index: number, radius: number): { x: number; y: number } {
    const angle = angleOffset + (2 * Math.PI * index) / n;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  }

  function makePolygon(radius: number): string {
    return labels.map((_, i) => {
      const p = getPoint(i, radius);
      return `${p.x},${p.y}`;
    }).join(' ');
  }

  // Data polygon based on grades (20-80 mapped to 0-maxR)
  const dataPoints = labels.map((l, i) => {
    const grade = grades[l.key] ?? 50;
    const normalized = (grade - 20) / 60; // 0 to 1
    const r = normalized * maxR;
    return getPoint(i, r);
  });
  const dataPolygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  // Guide rings at 25%, 50%, 75%, 100%
  const guideRings = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg viewBox="0 0 200 200" className="radar-chart">
      {/* Guide rings */}
      {guideRings.map((pct) => (
        <polygon
          key={pct}
          points={makePolygon(maxR * pct)}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />
      ))}

      {/* Axis lines */}
      {labels.map((_, i) => {
        const p = getPoint(i, maxR);
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={p.x} y2={p.y}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        );
      })}

      {/* Data polygon */}
      <polygon
        points={dataPolygon}
        fill="rgba(66, 153, 225, 0.3)"
        stroke="#4299e1"
        strokeWidth="2"
      />

      {/* Data dots */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#4299e1" />
      ))}

      {/* Labels */}
      {labels.map((l, i) => {
        const grade = grades[l.key] ?? 50;
        const p = getPoint(i, maxR + 18);
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="radar-label"
            fill={getGradeColor(grade)}
          >
            {l.label}
          </text>
        );
      })}
    </svg>
  );
}

function CoachEffectView({ player }: { player: Player }) {
  const effect = player.coachEffect;
  if (!effect) return null;

  const bars = [
    { label: 'Offense', value: effect.offensiveBonus, max: 8, color: '#e74c3c', suffix: '%' },
    { label: 'Pitching', value: effect.pitchingBonus, max: 8, color: '#3498db', suffix: '%' },
    { label: 'Clutch', value: effect.clutchBonus, max: 6, color: '#f39c12', suffix: ' pts' },
    { label: 'Stamina', value: effect.staminaBonus, max: 10, color: '#2ecc71', suffix: ' pitches' },
    { label: 'Speed', value: effect.speedBonus, max: 5, color: '#1abc9c', suffix: ' pts' },
    { label: 'Fielding', value: effect.fieldingBonus, max: 5, color: '#9b59b6', suffix: ' pts' },
  ].filter(b => b.value > 0);

  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ color: '#f39c12', fontWeight: 700, fontSize: '1.1rem', marginBottom: 12, textAlign: 'center' }}>
        {effect.style}
      </div>
      {bars.map(bar => (
        <div key={bar.label} style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
          <span style={{ width: 70, textAlign: 'right', color: '#bdc3c7', fontSize: '0.85rem' }}>{bar.label}</span>
          <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${(bar.value / bar.max) * 100}%`, height: '100%', background: bar.color, borderRadius: 4 }} />
          </div>
          <span style={{ width: 60, color: bar.color, fontSize: '0.85rem', fontWeight: 600 }}>+{bar.value}{bar.suffix}</span>
        </div>
      ))}
    </div>
  );
}

export function PlayerScoutingModal({ player, onDraft, onClose }: PlayerScoutingModalProps) {
  const rating = getOverallRating(player.overall);
  const specialty = getSpecialtyBadge(player);
  const categoryBadge = getCategoryBadge(player.category);
  const comparable = getComparable(player);
  const grades = player.grades ?? inferGradesFromStats(player);
  const pitcher = isPitcher(player);
  const isCoach = player.positions.includes('HC' as any);

  // Key grades for the quick stats row
  const keyGrades = pitcher
    ? [
        { label: 'VEL', grade: grades.fastball ?? 50 },
        { label: 'BRK', grade: grades.breaking ?? 50 },
        { label: 'CMD', grade: grades.control ?? 50 },
        { label: 'STM', grade: grades.stamina ?? 50 },
      ]
    : [
        { label: 'BAT', grade: grades.contact ?? 50 },
        { label: 'POW', grade: grades.power ?? 50 },
        { label: 'SPD', grade: grades.speed ?? 50 },
        { label: 'EYE', grade: grades.eye ?? 50 },
        { label: 'DEF', grade: grades.fielding ?? 50 },
      ];

  return (
    <div className="scouting-modal-overlay" onClick={onClose}>
      <div className="scouting-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="scouting-header" style={{ borderColor: isCoach ? '#2c3e50' : rating.color }}>
          <div className="scouting-overall" style={{ backgroundColor: isCoach ? '#2c3e50' : rating.color }}>
            {isCoach ? '📋' : player.overall}
          </div>
          <div className="scouting-info">
            <div className="scouting-name">
              {categoryBadge && <span className="scouting-category">{categoryBadge}</span>}
              {player.name}
            </div>
            {player.nickname && (
              <div className="scouting-nickname">"{player.nickname}"</div>
            )}
            <div className="scouting-meta">
              <span className="scouting-pos">{isCoach ? 'Head Coach' : player.positions.join('/')}</span>
              <span className="scouting-team">{player.team}</span>
              {player.era && <span className="scouting-era">{player.era}</span>}
            </div>
          </div>
          <div className="scouting-tier" style={{ color: isCoach ? '#f39c12' : rating.color }}>
            {isCoach ? 'Coach' : rating.label}
          </div>
        </div>

        {isCoach ? (
          /* Coach-specific content */
          <CoachEffectView player={player} />
        ) : (
          <>
            {/* Radar Chart */}
            <div className="scouting-radar">
              <RadarChart player={player} />
            </div>

            {/* Quick grade chips */}
            <div className="scouting-grades-row">
              {keyGrades.map((g) => (
                <div key={g.label} className="scouting-grade-chip">
                  <span className="scouting-grade-label">{g.label}</span>
                  <span className="scouting-grade-value" style={{ color: getGradeColor(g.grade) }}>
                    {gradeToLetter(g.grade)}
                  </span>
                  <span className="scouting-grade-num">{g.grade}</span>
                </div>
              ))}
            </div>

            {/* Full scouting bars */}
            <div className="scouting-bars-section">
              <ScoutingBars player={player} />
            </div>

            {/* Comparable */}
            <div className="scouting-comparable">
              <span className="comparable-label">Scouting Report:</span>
              <span className="comparable-text">{comparable}</span>
            </div>

            {/* Specialty */}
            {specialty && (
              <div className="scouting-specialty">{specialty}</div>
            )}
          </>
        )}

        {/* Fun fact */}
        {player.funFact && (
          <div className="scouting-funfact">{player.funFact}</div>
        )}

        {/* Actions */}
        <div className="scouting-actions">
          <button className="scouting-btn draft" onClick={onDraft}>
            {isCoach ? 'Hire This Coach' : 'Draft This Player'}
          </button>
          <button className="scouting-btn close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
