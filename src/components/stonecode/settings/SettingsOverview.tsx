import { CSSProperties, useEffect, useMemo, useState } from "react";
import { Award, BookOpen, Check, ChevronDown, Code2, Languages, Trophy } from "lucide-react";
import { Course, learningExperienceLabel } from "@/data/courses";
import { ProgressionHeatmapDay, ProgressionSummary } from "@/services/progression";
import { getCourseProgress } from "@/services/courseProgress";

const skillColors = ["#8fbe7d", "#e1b85a", "#d4756c", "#7297cc", "#a881c5", "#71817a"];

export function SettingsOverview({
  courses,
  isLoading,
  lessonStepByCourse,
  onEquipTitle,
  progression
}: {
  courses: Course[];
  isLoading: boolean;
  lessonStepByCourse: Record<string, number>;
  onEquipTitle: (badgeId: string | null) => Promise<void>;
  progression: ProgressionSummary;
}) {
  const programs = useMemo(
    () => courses
      .filter((course) => course.experienceType !== "exercise")
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [courses]
  );
  const [selectedProgramId, setSelectedProgramId] = useState(programs[0]?.id ?? "");
  const selectedProgram = programs.find((course) => course.id === selectedProgramId) ?? programs[0] ?? null;
  const topLanguages = progression.languageXp.slice(0, 3);
  const extraLanguages = progression.languageXp.slice(3);

  useEffect(() => {
    if (!programs.length) {
      setSelectedProgramId("");
      return;
    }
    if (!programs.some((course) => course.id === selectedProgramId)) setSelectedProgramId(programs[0].id);
  }, [programs, selectedProgramId]);

  return (
    <div className="settings-v2-overview">
      <section className="settings-v2-card settings-v2-solved-card">
        <div className="settings-v2-card-title">
          <div>
            <span>Skill distribution</span>
            <strong>{isLoading ? "Loading" : `${progression.solvedExercises} solved exercises`}</strong>
          </div>
          <Code2 aria-hidden="true" />
        </div>
        <div className="settings-v2-solved-body">
          <SolvedRing progression={progression} />
          <div className="settings-v2-top-languages">
            <div className="settings-v2-subheading">
              <span><Languages aria-hidden="true" />Top languages</span>
              <small>by verified XP</small>
            </div>
            {topLanguages.length ? topLanguages.map((item, index) => (
              <LanguageRow item={item} key={item.language} rank={index + 1} totalXp={progression.totalXp} />
            )) : (
              <EmptyCompact title="No language XP yet" copy="Verified exercises will appear here." />
            )}
            {extraLanguages.length > 0 && (
              <details className="settings-v2-popover">
                <summary>View all {progression.languageXp.length}<ChevronDown aria-hidden="true" /></summary>
                <div className="settings-v2-popover-menu">
                  {progression.languageXp.map((item, index) => (
                    <LanguageRow item={item} key={item.language} rank={index + 1} totalXp={progression.totalXp} />
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      </section>

      <section className="settings-v2-card settings-v2-heatmap-card">
        <div className="settings-v2-heatmap-head">
          <div>
            <strong>{progression.totalXp} XP</strong>
            <span>in the last year</span>
          </div>
          <div>
            <span>Active days <strong>{progression.heatmap.filter((day) => day.xp > 0).length}</strong></span>
            <span>Current streak <strong>{progression.currentStreak}</strong></span>
            <span>Best <strong>{progression.longestStreak}</strong></span>
          </div>
        </div>
        <ProgressionHeatmap days={progression.heatmap} />
      </section>

      <div className="settings-v2-overview-bottom">
        <section className="settings-v2-card settings-v2-achievements-card">
          <div className="settings-v2-card-title">
            <div>
              <span>Badges & titles</span>
              <strong>{progression.equippedTitle ?? "No title equipped"}</strong>
            </div>
            <Award aria-hidden="true" />
          </div>
          {progression.badges.length ? (
            <div className="settings-v2-badge-list" aria-label="Earned badges">
              {progression.badges.map((badge) => {
                const isEquipped = badge.id === progression.equippedBadgeId;
                return (
                  <article className={isEquipped ? "is-equipped" : ""} key={badge.id}>
                    <span><Award aria-hidden="true" /></span>
                    <div><strong>{badge.title}</strong><small>{badge.description}</small></div>
                    <button
                      aria-pressed={isEquipped}
                      className={isEquipped ? "is-equipped" : ""}
                      onClick={() => void onEquipTitle(isEquipped ? null : badge.id)}
                      type="button"
                    >
                      {isEquipped ? "Unequip" : "Equip"}
                      {isEquipped && <Check aria-hidden="true" />}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : <EmptyCompact title="No badges yet" copy="Complete a verified exercise to start." />}
        </section>

        <section className="settings-v2-card settings-v2-program-card">
          <div className="settings-v2-card-title">
            <div>
              <span>Learning programs</span>
              <strong>{programs.length} active or saved</strong>
            </div>
            <BookOpen aria-hidden="true" />
          </div>
          {selectedProgram ? (
            <>
              <label className="settings-v2-select-row">
                <span>Program</span>
                <select onChange={(event) => setSelectedProgramId(event.target.value)} value={selectedProgram.id}>
                  {programs.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                </select>
              </label>
              <ProgramProgress course={selectedProgram} lessonIndex={lessonStepByCourse[selectedProgram.id] ?? 0} />
            </>
          ) : <EmptyCompact title="No learning programs" copy="Start one from the dashboard." />}
        </section>
      </div>
    </div>
  );
}

function SolvedRing({ progression }: { progression: ProgressionSummary }) {
  const displayedSkills = progression.skillBreakdown.slice(0, 5);
  const total = Math.max(progression.solvedExercises, 1);
  let offset = 0;
  const gradient = displayedSkills.length
    ? displayedSkills.map((item, index) => {
      const start = offset;
      offset += item.solvedCount / total * 100;
      return `${skillColors[index]} ${start}% ${offset}%`;
    }).join(", ")
    : "#292c2a 0 100%";

  return (
    <div className="settings-v2-ring-wrap">
      <div className="settings-v2-ring" key={`${progression.solvedExercises}-${gradient}`} style={{ "--settings-ring": gradient } as CSSProperties}>
        <div><strong>{progression.solvedExercises}</strong><span>Solved</span></div>
      </div>
      <div className="settings-v2-ring-legend">
        {displayedSkills.slice(0, 3).map((item, index) => (
          <span key={item.skill}><i style={{ background: skillColors[index] }} />{item.skill}</span>
        ))}
      </div>
    </div>
  );
}

function LanguageRow({ item, rank, totalXp }: { item: { language: string; xp: number }; rank: number; totalXp: number }) {
  return (
    <div className="settings-v2-language-row">
      <span>{rank}</span>
      <div><strong>{item.language}</strong><i><b style={{ "--settings-progress": `${item.xp / Math.max(totalXp, 1) * 100}%` } as CSSProperties} /></i></div>
      <em>{item.xp} XP</em>
    </div>
  );
}

function ProgramProgress({ course, lessonIndex }: { course: Course; lessonIndex: number }) {
  const progress = getCourseProgress(course, lessonIndex);
  return (
    <div className="settings-v2-program-progress">
      <div>
        <span>{learningExperienceLabel(course.experienceType)}</span>
        <strong>{progress}%</strong>
      </div>
      <i><b style={{ "--settings-progress": `${progress}%` } as CSSProperties} /></i>
      <small>{course.subject} · Updated {new Date(course.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small>
    </div>
  );
}

function ProgressionHeatmap({ days }: { days: ProgressionHeatmapDay[] }) {
  return (
    <div className="settings-v2-heatmap-wrap">
      <div className="settings-v2-heatmap" role="img" aria-label="Yearly verified XP activity">
        {days.map((day) => {
          const band = day.xp <= 0 ? 0 : day.xp < 20 ? 1 : day.xp < 50 ? 2 : day.xp < 100 ? 3 : 4;
          return <span className={`heat-band-${band}`} key={day.date} title={`${day.date}: ${day.xp} XP`} />;
        })}
      </div>
      <div className="settings-v2-months">
        {["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((month) => <span key={month}>{month}</span>)}
      </div>
      <div className="settings-v2-heatmap-legend"><span>Less</span>{[0, 1, 2, 3, 4].map((band) => <i className={`heat-band-${band}`} key={band} />)}<span>More</span></div>
    </div>
  );
}

function EmptyCompact({ title, copy }: { title: string; copy: string }) {
  return <div className="settings-v2-empty"><Trophy aria-hidden="true" /><div><strong>{title}</strong><span>{copy}</span></div></div>;
}
