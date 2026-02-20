import { useEffect, useState } from 'react';
import './GameHighlight.css';

interface GameHighlightProps {
  message: string;
  type: 'homerun' | 'walkoff' | 'strikeout' | 'double' | 'triple' | 'save' | 'win';
  onDone: () => void;
  duration?: number;
}

const EMOJIS: Record<string, string> = {
  homerun: '💣',
  walkoff: '🎉',
  strikeout: '🔥',
  double: '💥',
  triple: '💥',
  save: '💾',
  win: '🏆',
};

// Big plays get longer display time
const TYPE_DURATIONS: Record<string, number> = {
  homerun: 2500,
  walkoff: 2500,
  triple: 2500,
  strikeout: 1800,
  double: 1800,
  save: 1800,
  win: 2500,
};

export function GameHighlight({ message, type, onDone, duration }: GameHighlightProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const displayTime = duration ?? TYPE_DURATIONS[type] ?? 1800;
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 300);
    }, displayTime);
    return () => clearTimeout(timer);
  }, [onDone, type, duration]);

  return (
    <div className={`game-highlight ${type} ${visible ? 'visible' : 'exit'}`}>
      <span className="highlight-emoji">{EMOJIS[type] || '⚾'}</span>
      <span className="highlight-text">{message}</span>
    </div>
  );
}
