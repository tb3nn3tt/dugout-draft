import { useRef, useEffect } from 'react';
import './PlayLog.css';

interface PlayLogProps {
  logs: string[];
}

export function PlayLog({ logs }: PlayLogProps) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="play-log">
      <h4 className="play-log-title">Play-by-Play</h4>
      <div className="play-log-content" ref={logRef}>
        {logs.map((log, index) => (
          <div
            key={index}
            className={`log-entry ${log.startsWith('---') ? 'inning-header' : ''} ${
              log.includes('HOME RUN') ? 'highlight-hr' :
              log.includes('run') ? 'highlight-run' :
              log.includes('WALK-OFF') ? 'highlight-walkoff' :
              log.includes('Final') ? 'highlight-final' : ''
            }`}
          >
            {log}
          </div>
        ))}
        {logs.length === 0 && (
          <div className="log-empty">Game log will appear here...</div>
        )}
      </div>
    </div>
  );
}
