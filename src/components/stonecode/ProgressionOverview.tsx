import { useMemo, useState } from "react";
import { ArrowRight, Award, CheckCircle2, Flame, Sparkles, Trophy } from "lucide-react";
import { ProgressionSummary } from "@/services/progression";

export function ProgressionOverview({
  progression,
  userEmail,
  userInitial,
  language,
  onLanguageChange,
  onEquipTitle
}: {
  progression: ProgressionSummary;
  userEmail: string;
  userInitial: string;
  language: string;
  onLanguageChange: (language: string) => void;
  onEquipTitle: (badgeKey: string | null) => Promise<void>;
}) {
  const [equipError, setEquipError] = useState<string | null>(null);
  const languageOptions = useMemo(
    () => ["All", ...progression.languageXp.map((entry) => entry.language)],
    [progression.languageXp]
  );
  const earnedBadges = progression.badges.filter((badge) => badge.earned);
  const equippedBadge = progression.badges.find((badge) => badge.equipped);
  const latestBadge = [...earnedBadges].sort((a, b) => (b.earnedAt ?? "").localeCompare(a.earnedAt ?? ""))[0];
  const maxLanguageXp = Math.max(...progression.languageXp.map((entry) => entry.xp), 1);

  async function equipTitle(badgeKey: string | null) {
    setEquipError(null);
    try {
      await onEquipTitle(badgeKey);
    } catch (error) {
      setEquipError(error instanceof Error ? error.message : "Unable to equip title.");
    }
  }

  return (
    <>
      <section className="reference-profile-bar">
        <div className="reference-profile-avatar">{userInitial}</div>
        <div>
          <strong>{progression.displayName || readDisplayName(userEmail)}</strong>
          <span>{userEmail}</span>
        </div>
        <em>{equippedBadge?.title ?? "Learner"}</em>
      </section>

      <div className="reference-summary-grid">
        <section className="reference-card solved-card">
          <h2>Solved Challenges</h2>
          <div className="solved-card-body">
            <div className="solved-ring" style={{ "--solved-angle": `${Math.min(progression.solvedChallenges * 12, 340)}deg` } as React.CSSProperties}>
              <div><strong>{progression.solvedChallenges}</strong><span>Solved</span></div>
            </div>
            <div className="solved-breakdown">
              <ProgressRow color="green" label="Beginner" value={countDifficulty(progression, "Beginner")} total={progression.solvedChallenges} />
              <ProgressRow color="amber" label="Intermediate" value={countDifficulty(progression, "Intermediate")} total={progression.solvedChallenges} />
              <ProgressRow color="red" label="Advanced" value={countDifficulty(progression, "Advanced")} total={progression.solvedChallenges} />
            </div>
          </div>
        </section>

        <section className="reference-card badges-summary-card">
          <div className="reference-card-title">
            <div><h2>Badges</h2><strong>{earnedBadges.length}</strong></div>
            <ArrowRight />
          </div>
          <div className="badge-medal-row">
            {(earnedBadges.length ? earnedBadges : progression.badges.slice(0, 3)).slice(0, 3).map((badge, index) => (
              <button
                className={`${badge.earned ? "is-earned" : ""}${badge.equipped ? " is-equipped" : ""}`}
                disabled={!badge.earned}
                key={badge.key}
                onClick={() => void equipTitle(badge.equipped ? null : badge.key)}
                type="button"
              >
                <Award />
                <span>{String(index + 1).padStart(2, "0")}</span>
              </button>
            ))}
          </div>
          <span>Most Recent Badge</span>
          <strong className="latest-badge-name">{latestBadge?.name ?? "No badge earned yet"}</strong>
        </section>
      </div>

      <section className="reference-card reference-heatmap-card">
        <div className="heatmap-reference-head">
          <div><strong>{progression.solvedChallenges}</strong><span> accepted challenges in the last year</span></div>
          <div className="heatmap-reference-stats">
            <span>Total active days: <strong>{progression.activeDays}</strong></span>
            <span>Current streak: <strong>{progression.currentStreak}</strong></span>
            <select aria-label="Language" onChange={(event) => onLanguageChange(event.target.value)} value={language}>
              {languageOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
        </div>
        <ProgressionHeatmap days={progression.heatmap} />
        <div className="heatmap-months">
          {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((month) => <span key={month}>{month}</span>)}
        </div>
        <div className="heatmap-legend">
          <span>Less</span>
          {[0, 12, 35, 75, 150, 250].map((xp) => <i className={`level-${heatLevel(xp)}`} key={xp} />)}
          <span>More</span>
        </div>
      </section>

      <div className="reference-detail-grid">
        <section className="reference-card language-detail-card">
          <div className="reference-card-title">
            <div><h2>Language XP</h2><strong>{progression.totalXp.toLocaleString()} XP</strong></div>
            <Sparkles />
          </div>
          <div className="reference-language-list">
            {progression.languageXp.length ? progression.languageXp.map((entry) => (
              <div key={entry.language}>
                <span><strong>{entry.language}</strong><em>{entry.xp} XP</em></span>
                <i><b style={{ width: `${(entry.xp / maxLanguageXp) * 100}%` }} /></i>
              </div>
            )) : <p>No XP recorded yet.</p>}
          </div>
        </section>

        <section className="reference-card course-detail-card">
          <div className="reference-card-title">
            <div><h2>Courses Completed</h2><strong>{progression.completedCourses}</strong></div>
            <Trophy />
          </div>
          <div className="reference-course-list">
            {progression.courses.length ? progression.courses.map((course) => (
              <div key={course.id}>
                <CheckCircle2 />
                <span><strong>{course.title}</strong><small>{course.subject}</small></span>
                <em>{course.status}</em>
              </div>
            )) : <p>No courses created yet.</p>}
          </div>
        </section>
      </div>

      <section className="reference-card all-badges-card">
        <div className="reference-card-title">
          <div><h2>Achievements & Titles</h2><strong>{earnedBadges.length} earned</strong></div>
          <Flame />
        </div>
        <div className="reference-badge-list">
          {progression.badges.map((badge) => (
            <button
              className={`${badge.earned ? "is-earned" : "is-locked"}${badge.equipped ? " is-equipped" : ""}`}
              disabled={!badge.earned}
              key={badge.key}
              onClick={() => void equipTitle(badge.equipped ? null : badge.key)}
              type="button"
            >
              <Award />
              <span><strong>{badge.name}</strong><small>{badge.description}</small></span>
              <em>{badge.equipped ? "Equipped" : badge.earned ? "Equip title" : "Locked"}</em>
            </button>
          ))}
        </div>
        {equipError && <p className="settings-inline-error">{equipError}</p>}
      </section>
    </>
  );
}

function ProgressionHeatmap({ days }: { days: Array<{ date: string; xp: number }> }) {
  return (
    <div className="progression-heatmap" role="img" aria-label="Daily XP activity heatmap">
      {days.map((day) => (
        <i
          aria-label={`${day.date}: ${day.xp} XP`}
          className={`level-${heatLevel(day.xp)}`}
          key={day.date}
          title={`${day.date}: ${day.xp} XP`}
        />
      ))}
    </div>
  );
}

function ProgressRow({
  color,
  label,
  value,
  total
}: {
  color: string;
  label: string;
  value: number;
  total: number;
}) {
  const width = total ? Math.max((value / total) * 100, value ? 8 : 0) : 0;
  return (
    <div className={`progress-row is-${color}`}>
      <span><em>{label}</em><strong>{value}</strong></span>
      <i><b style={{ width: `${width}%` }} /></i>
    </div>
  );
}

function countDifficulty(progression: ProgressionSummary, difficulty: string) {
  return progression.challenges.filter((challenge) => challenge.completed && challenge.difficulty === difficulty).length;
}

function heatLevel(xp: number) {
  if (xp <= 0) return 0;
  if (xp < 25) return 1;
  if (xp < 50) return 2;
  if (xp < 100) return 3;
  if (xp < 200) return 4;
  return 5;
}

function readDisplayName(email: string) {
  return (email.split("@")[0] ?? "learner").replace(/[._-]+/g, " ");
}
