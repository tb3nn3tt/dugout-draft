import { Player } from '../../types';
import { gradeToLetter, getGradeColor, isPitcher } from '../../utils/helpers';
import { inferGradesFromStats } from '../../utils/simulation';
import './ScoutingBars.css';

interface ScoutingBarsProps {
  player: Player;
  compact?: boolean;
}

interface GradeBarProps {
  label: string;
  grade: number;
  isElite?: boolean;
}

function GradeBar({ label, grade, isElite }: GradeBarProps) {
  const letter = gradeToLetter(grade);
  const color = getGradeColor(grade);
  const fillPercent = ((grade - 20) / 60) * 100; // 20-80 scale to 0-100%

  return (
    <div className={`grade-bar ${isElite ? 'elite' : ''}`}>
      <span className="grade-label">{label}</span>
      <div className="grade-track">
        <div
          className="grade-fill"
          style={{
            width: `${fillPercent}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span className="grade-value">{grade}</span>
      <span className="grade-letter" style={{ color }}>{letter}</span>
    </div>
  );
}

export function ScoutingBars({ player, compact }: ScoutingBarsProps) {
  const pitcher = isPitcher(player);

  // Use explicit grades or infer from legacy stats
  const effectiveGrades = player.grades ?? inferGradesFromStats(player);

  if (compact) {
    // Compact mode - show top 3 grades only
    if (pitcher) {
      const topGrades = [
        { label: 'VEL', grade: effectiveGrades.fastball ?? 50 },
        { label: 'MOV', grade: effectiveGrades.breaking ?? 50 },
        { label: 'CMD', grade: effectiveGrades.control ?? 50 },
        { label: 'STM', grade: effectiveGrades.stamina ?? 50 },
      ];
      return (
        <div className="scouting-bars compact">
          {topGrades.map(g => (
            <GradeBar key={g.label} label={g.label} grade={g.grade} isElite={g.grade >= 80} />
          ))}
        </div>
      );
    } else {
      const topGrades = [
        { label: 'BAT', grade: effectiveGrades.contact ?? 50 },
        { label: 'POW', grade: effectiveGrades.power ?? 50 },
        { label: 'EYE', grade: effectiveGrades.eye ?? 50 },
        { label: 'SPD', grade: effectiveGrades.speed ?? 50 },
        { label: 'DEF', grade: effectiveGrades.fielding ?? 50 },
      ];
      return (
        <div className="scouting-bars compact">
          {topGrades.map(g => (
            <GradeBar key={g.label} label={g.label} grade={g.grade} isElite={g.grade >= 80} />
          ))}
        </div>
      );
    }
  }

  // Full mode - show all grades
  if (pitcher) {
    return (
      <div className="scouting-bars">
        <GradeBar label="Fastball" grade={effectiveGrades.fastball ?? 50} isElite={(effectiveGrades.fastball ?? 0) >= 80} />
        <GradeBar label="Breaking" grade={effectiveGrades.breaking ?? 50} isElite={(effectiveGrades.breaking ?? 0) >= 80} />
        <GradeBar label="Changeup" grade={effectiveGrades.changeup ?? 50} isElite={(effectiveGrades.changeup ?? 0) >= 80} />
        <GradeBar label="Control" grade={effectiveGrades.control ?? 50} isElite={(effectiveGrades.control ?? 0) >= 80} />
        <GradeBar label="Stamina" grade={effectiveGrades.stamina ?? 50} isElite={(effectiveGrades.stamina ?? 0) >= 80} />
      </div>
    );
  }

  return (
    <div className="scouting-bars">
      <GradeBar label="Contact" grade={effectiveGrades.contact ?? 50} isElite={(effectiveGrades.contact ?? 0) >= 80} />
      <GradeBar label="Power" grade={effectiveGrades.power ?? 50} isElite={(effectiveGrades.power ?? 0) >= 80} />
      <GradeBar label="Speed" grade={effectiveGrades.speed ?? 50} isElite={(effectiveGrades.speed ?? 0) >= 80} />
      <GradeBar label="Fielding" grade={effectiveGrades.fielding ?? 50} isElite={(effectiveGrades.fielding ?? 0) >= 80} />
      <GradeBar label="Arm" grade={effectiveGrades.arm ?? 50} isElite={(effectiveGrades.arm ?? 0) >= 80} />
      <GradeBar label="Eye" grade={effectiveGrades.eye ?? 50} isElite={(effectiveGrades.eye ?? 0) >= 80} />
    </div>
  );
}
