import { useEffect, useState } from 'react';
import './SeriesCelebration.css';

interface SeriesCelebrationProps {
  winner: string;
  seriesScore: string;
  onContinue: () => void;
}

export function SeriesCelebration({ winner, seriesScore, onContinue }: SeriesCelebrationProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 1000);
    const t3 = setTimeout(() => setPhase(3), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div className="celebration-overlay" onClick={phase >= 3 ? onContinue : undefined}>
      <div className="celebration-content">
        <div className={`celebration-trophy ${phase >= 1 ? 'show' : ''}`}>
          🏆
        </div>
        <div className={`celebration-title ${phase >= 2 ? 'show' : ''}`}>
          {winner} Wins the World Series!
        </div>
        <div className={`celebration-score ${phase >= 2 ? 'show' : ''}`}>
          {seriesScore}
        </div>
        <div className={`celebration-action ${phase >= 3 ? 'show' : ''}`}>
          Tap to view recap
        </div>
      </div>

      {phase >= 1 && (
        <div className="confetti-container">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
                backgroundColor: ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ff9ff3'][i % 6],
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
