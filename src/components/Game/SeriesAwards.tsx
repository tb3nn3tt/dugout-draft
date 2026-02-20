import { useState, useEffect } from 'react';
import { SeriesAward } from '../../utils/seriesStats';
import './SeriesAwards.css';

interface SeriesAwardsProps {
  awards: SeriesAward[];
}

export function SeriesAwards({ awards }: SeriesAwardsProps) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    awards.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleCount(i + 1), (i + 1) * 400));
    });
    return () => timers.forEach(clearTimeout);
  }, [awards.length]);

  if (awards.length === 0) return null;

  return (
    <div className="series-awards">
      <h3 className="awards-title">Series Awards</h3>
      <div className="awards-grid">
        {awards.map((award, i) => (
          <div
            key={award.title}
            className={`award-card ${i < visibleCount ? 'visible' : ''} ${award.team}`}
          >
            <span className="award-icon">{award.icon}</span>
            <div className="award-info">
              <div className="award-title">{award.title}</div>
              <div className="award-player">{award.playerName}</div>
              <div className="award-stat-line">{award.statLine}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
