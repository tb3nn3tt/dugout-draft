import { Player } from '../domain/types';
import { getRatings } from '../domain/ratings';

export interface Axis { label: string; value: number; }

/** The radar axes for a player, derived from the detailed ratings. */
export function axesFor(player: Player): Axis[] {
  const r = getRatings(player);
  if (r.kind === 'hitter') {
    return [
      { label: 'CON', value: Math.round((r.conVL + r.conVR) / 2) },
      { label: 'HR', value: Math.round((r.hrVL + r.hrVR) / 2) },
      { label: 'GAP', value: Math.round((r.gapVL + r.gapVR) / 2) },
      { label: 'EYE', value: r.eye },
      { label: 'RUN', value: r.run },
      { label: 'FLD', value: r.field },
      { label: 'BNT', value: r.bunt },
    ];
  }
  return [
    { label: 'STUFF', value: Math.round((r.stuffVL + r.stuffVR) / 2) },
    { label: 'CTL', value: r.control },
    { label: 'CMD', value: Math.round((r.cmdVL + r.cmdVR) / 2) },
    { label: 'STAM', value: r.stamina },
    { label: 'GB', value: r.gb },
  ];
}

const norm = (g: number) => Math.max(0, Math.min(1, (g - 20) / 60));

export function RatingRadar({ axes, color, size = 200, showLabels = true }: {
  axes: Axis[]; color: string; size?: number; showLabels?: boolean;
}) {
  const cx = size / 2, cy = size / 2;
  const R = showLabels ? size * 0.36 : size * 0.44;
  const n = axes.length;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const rings = [0.5, 1].map(f => axes.map((_, i) => pt(i, R * f).join(',')).join(' '));
  const valuePts = axes.map((ax, i) => pt(i, R * norm(ax.value)).join(',')).join(' ');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings.map((r, i) => <polygon key={i} points={r} fill="none" stroke="var(--line)" strokeWidth="1" />)}
      {axes.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)" strokeWidth="1" />; })}
      <polygon points={valuePts} fill={color} fillOpacity="0.38" stroke={color} strokeWidth="2" />
      {showLabels && axes.map((ax, i) => {
        const [x, y] = pt(i, R + size * 0.075);
        return <text key={i} x={x} y={y} fill="var(--text-dim)" fontSize={size * 0.05} fontWeight="800" textAnchor="middle" dominantBaseline="middle">{ax.label}</text>;
      })}
    </svg>
  );
}
