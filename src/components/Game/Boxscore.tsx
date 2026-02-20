import { GameBoxScore } from '../../types';
import './Boxscore.css';

interface BoxscoreProps {
  boxScore: GameBoxScore;
  awayTeamName: string;
  homeTeamName: string;
  lineScore: number[][];
  onClose: () => void;
}

function formatIP(ip: number): string {
  const fullInnings = Math.floor(ip);
  const decimal = ip - fullInnings;
  if (decimal < 0.05) return `${fullInnings}.0`;
  if (decimal < 0.15) return `${fullInnings}.1`;
  if (decimal < 0.25) return `${fullInnings}.2`;
  return `${fullInnings}.0`;
}

export function Boxscore({ boxScore, awayTeamName, homeTeamName, lineScore, onClose }: BoxscoreProps) {
  const awayRuns = boxScore.away.totals.r;
  const homeRuns = boxScore.home.totals.r;
  const awayHits = boxScore.away.totals.h;
  const homeHits = boxScore.home.totals.h;

  // Calculate errors (simplified - not tracked, show 0)
  const awayErrors = 0;
  const homeErrors = 0;

  return (
    <div className="boxscore-overlay">
      <div className="boxscore-modal">
        <div className="boxscore-header">
          <h2>Final Score</h2>
          <button className="boxscore-close" onClick={onClose}>&times;</button>
        </div>

        {/* Line Score */}
        <div className="line-score-container">
          <table className="line-score">
            <thead>
              <tr>
                <th className="team-col"></th>
                {lineScore[0].map((_, i) => (
                  <th key={i} className="inning-col">{i + 1}</th>
                ))}
                <th className="total-col">R</th>
                <th className="total-col">H</th>
                <th className="total-col">E</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="team-name">{awayTeamName}</td>
                {lineScore[0].map((runs, i) => (
                  <td key={i} className="inning-runs">{runs}</td>
                ))}
                <td className="total-runs">{awayRuns}</td>
                <td className="total-hits">{awayHits}</td>
                <td className="total-errors">{awayErrors}</td>
              </tr>
              <tr>
                <td className="team-name">{homeTeamName}</td>
                {lineScore[1].map((runs, i) => (
                  <td key={i} className="inning-runs">{runs}</td>
                ))}
                {/* Pad home line score if they didn't bat in bottom of last */}
                {lineScore[1].length < lineScore[0].length && (
                  <td className="inning-runs">X</td>
                )}
                <td className="total-runs">{homeRuns}</td>
                <td className="total-hits">{homeHits}</td>
                <td className="total-errors">{homeErrors}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Batting Stats */}
        <div className="boxscore-section">
          <h3>{awayTeamName} Batting</h3>
          <table className="batting-table">
            <thead>
              <tr>
                <th className="player-col">Player</th>
                <th className="pos-col">Pos</th>
                <th>AB</th>
                <th>R</th>
                <th>H</th>
                <th>RBI</th>
                <th>BB</th>
                <th>SO</th>
              </tr>
            </thead>
            <tbody>
              {boxScore.away.batters.map((batter, i) => (
                <tr key={i}>
                  <td className="player-name">{batter.name}</td>
                  <td className="pos">{batter.position}</td>
                  <td>{batter.ab}</td>
                  <td>{batter.r}</td>
                  <td>{batter.h}</td>
                  <td>{batter.rbi}</td>
                  <td>{batter.bb}</td>
                  <td>{batter.so}</td>
                </tr>
              ))}
              <tr className="totals-row">
                <td colSpan={2}>Totals</td>
                <td>{boxScore.away.totals.ab}</td>
                <td>{boxScore.away.totals.r}</td>
                <td>{boxScore.away.totals.h}</td>
                <td>{boxScore.away.totals.rbi}</td>
                <td>{boxScore.away.totals.bb}</td>
                <td>{boxScore.away.totals.so}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="boxscore-section">
          <h3>{homeTeamName} Batting</h3>
          <table className="batting-table">
            <thead>
              <tr>
                <th className="player-col">Player</th>
                <th className="pos-col">Pos</th>
                <th>AB</th>
                <th>R</th>
                <th>H</th>
                <th>RBI</th>
                <th>BB</th>
                <th>SO</th>
              </tr>
            </thead>
            <tbody>
              {boxScore.home.batters.map((batter, i) => (
                <tr key={i}>
                  <td className="player-name">{batter.name}</td>
                  <td className="pos">{batter.position}</td>
                  <td>{batter.ab}</td>
                  <td>{batter.r}</td>
                  <td>{batter.h}</td>
                  <td>{batter.rbi}</td>
                  <td>{batter.bb}</td>
                  <td>{batter.so}</td>
                </tr>
              ))}
              <tr className="totals-row">
                <td colSpan={2}>Totals</td>
                <td>{boxScore.home.totals.ab}</td>
                <td>{boxScore.home.totals.r}</td>
                <td>{boxScore.home.totals.h}</td>
                <td>{boxScore.home.totals.rbi}</td>
                <td>{boxScore.home.totals.bb}</td>
                <td>{boxScore.home.totals.so}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pitching Stats */}
        <div className="boxscore-section">
          <h3>{awayTeamName} Pitching</h3>
          <table className="pitching-table">
            <thead>
              <tr>
                <th className="player-col">Pitcher</th>
                <th>IP</th>
                <th>H</th>
                <th>R</th>
                <th>ER</th>
                <th>BB</th>
                <th>SO</th>
              </tr>
            </thead>
            <tbody>
              {boxScore.away.pitchers.map((pitcher, i) => (
                <tr key={i}>
                  <td className="player-name">{pitcher.name}</td>
                  <td>{formatIP(pitcher.ip)}</td>
                  <td>{pitcher.h}</td>
                  <td>{pitcher.r}</td>
                  <td>{pitcher.er}</td>
                  <td>{pitcher.bb}</td>
                  <td>{pitcher.so}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="boxscore-section">
          <h3>{homeTeamName} Pitching</h3>
          <table className="pitching-table">
            <thead>
              <tr>
                <th className="player-col">Pitcher</th>
                <th>IP</th>
                <th>H</th>
                <th>R</th>
                <th>ER</th>
                <th>BB</th>
                <th>SO</th>
              </tr>
            </thead>
            <tbody>
              {boxScore.home.pitchers.map((pitcher, i) => (
                <tr key={i}>
                  <td className="player-name">{pitcher.name}</td>
                  <td>{formatIP(pitcher.ip)}</td>
                  <td>{pitcher.h}</td>
                  <td>{pitcher.r}</td>
                  <td>{pitcher.er}</td>
                  <td>{pitcher.bb}</td>
                  <td>{pitcher.so}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="boxscore-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
