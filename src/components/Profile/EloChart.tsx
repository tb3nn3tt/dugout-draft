interface EloDataPoint {
  matchIndex: number;
  elo: number;
}

interface EloChartProps {
  data: EloDataPoint[];
  width?: number;
  height?: number;
}

export function EloChart({ data, width = 600, height = 200 }: EloChartProps) {
  if (data.length < 2) {
    return (
      <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
        Play more matches to see your ELO chart
      </div>
    );
  }

  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const minElo = Math.min(...data.map(d => d.elo)) - 50;
  const maxElo = Math.max(...data.map(d => d.elo)) + 50;
  const eloRange = maxElo - minElo;

  const scaleX = (index: number) =>
    padding.left + (index / (data.length - 1)) * chartWidth;

  const scaleY = (elo: number) =>
    padding.top + chartHeight - ((elo - minElo) / eloRange) * chartHeight;

  // Build SVG path
  const pathPoints = data.map((d, i) => `${scaleX(i)},${scaleY(d.elo)}`);
  const linePath = `M ${pathPoints.join(' L ')}`;

  // Area fill path
  const areaPath = `${linePath} L ${scaleX(data.length - 1)},${padding.top + chartHeight} L ${scaleX(0)},${padding.top + chartHeight} Z`;

  // Y-axis labels
  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks }, (_, i) => {
    const elo = minElo + (i / (yTicks - 1)) * eloRange;
    return Math.round(elo);
  });

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      {/* Grid lines */}
      {yLabels.map((elo) => (
        <g key={elo}>
          <line
            x1={padding.left}
            y1={scaleY(elo)}
            x2={width - padding.right}
            y2={scaleY(elo)}
            stroke="rgba(30, 95, 187, 0.15)"
            strokeDasharray="4,4"
          />
          <text
            x={padding.left - 8}
            y={scaleY(elo) + 4}
            fill="#94a3b8"
            fontSize="10"
            textAnchor="end"
            fontFamily="Barlow Condensed, sans-serif"
          >
            {elo}
          </text>
        </g>
      ))}

      {/* 1200 baseline */}
      <line
        x1={padding.left}
        y1={scaleY(1200)}
        x2={width - padding.right}
        y2={scaleY(1200)}
        stroke="rgba(240, 180, 41, 0.3)"
        strokeDasharray="6,3"
      />

      {/* Area fill */}
      <path d={areaPath} fill="rgba(40, 114, 219, 0.1)" />

      {/* Line */}
      <path d={linePath} fill="none" stroke="#2872db" strokeWidth="2" />

      {/* Data points */}
      {data.map((d, i) => (
        <circle
          key={i}
          cx={scaleX(i)}
          cy={scaleY(d.elo)}
          r="3"
          fill="#2872db"
          stroke="#0f1f3d"
          strokeWidth="1.5"
        />
      ))}

      {/* Current ELO label */}
      {data.length > 0 && (
        <text
          x={scaleX(data.length - 1)}
          y={scaleY(data[data.length - 1].elo) - 10}
          fill="#f0b429"
          fontSize="12"
          textAnchor="middle"
          fontFamily="Teko, sans-serif"
          fontWeight="600"
        >
          {data[data.length - 1].elo}
        </text>
      )}
    </svg>
  );
}
