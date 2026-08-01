import { useEffect, useState } from "react";
import { Course, GeneratedCourseStep, learningNavigationLabel, toGeneratedCourseContentV2 } from "@/data/courses";
import { WorkspaceFile, WorkspaceFolder } from "@/services/workspaceFiles";
import { readDraggedNode, WorkspaceFileTree } from "@/components/stonecode/WorkspaceFileTree";
import { StoneSurface } from "@/components/stonecode/StoneSurface";
import { Link } from "react-router-dom";
import { resolveCourseLessonSteps, stepsForGeneratedBlock } from "@/components/stonecode/lessonData";
import { StonecodeLogoMark } from "@/components/stonecode/StonecodeBrand";

export function FilePanel({
  active,
  activeCourse,
  activeFiles,
  activeFolders,
  activeLessonIndex,
  preferredView,
  planName,
  selectedFileIndex,
  userEmail,
  onCreateFile,
  onCreateFolder,
  onRenameFile,
  onDeleteFile,
  onSelectFile,
  onSelectLesson,
  onMoveFile,
  onMoveFolder
}: {
  active: boolean;
  activeCourse: Course | null;
  activeFiles: WorkspaceFile[];
  activeFolders: WorkspaceFolder[];
  activeLessonIndex: number;
  preferredView: "course" | "files";
  planName: string;
  selectedFileIndex: number;
  userEmail: string;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onRenameFile: () => void;
  onDeleteFile: () => void;
  onSelectFile: (index: number) => void;
  onSelectLesson: (lessonIndex: number) => void;
  onMoveFile: (fileIndex: number, folderPath: string) => void;
  onMoveFolder: (folderPath: string, targetFolderPath: string) => void;
}) {
  const [isRootDropTarget, setIsRootDropTarget] = useState(false);
  const [activeTab, setActiveTab] = useState<"course" | "files">(
    preferredView === "course" && activeCourse?.courseContent ? "course" : "files"
  );

  useEffect(() => {
    if (!activeCourse?.courseContent && activeTab === "course") setActiveTab("files");
  }, [activeCourse?.courseContent, activeTab]);

  useEffect(() => {
    setActiveTab(preferredView === "course" && activeCourse?.courseContent ? "course" : "files");
  }, [activeCourse?.id, activeCourse?.courseContent, preferredView]);

  return (
    <StoneSurface as="aside" variant="side" className={`file-panel${active ? " is-visible" : ""}`} aria-label="Stonecode files" aria-hidden={!active}>
      <FilePanelBrand />
      <div className="file-panel-head">
        <span>Project</span>
        <strong>{activeCourse?.subject ?? "Courses"}</strong>
      </div>
      {activeCourse && (
        <div className="file-panel-tabs" aria-label="Left panel views">
          <button className={activeTab === "course" ? "is-active" : ""} disabled={!activeCourse.courseContent} onClick={() => setActiveTab("course")} type="button">{learningNavigationLabel(activeCourse.experienceType)}</button>
          <button className={activeTab === "files" ? "is-active" : ""} onClick={() => setActiveTab("files")} type="button">Files</button>
        </div>
      )}
      {activeTab === "course" && activeCourse?.courseContent ? (
        <CourseModuleTree activeLessonIndex={activeLessonIndex} course={activeCourse} onSelectLesson={onSelectLesson} />
      ) : (
        <div
          className={`file-tree${isRootDropTarget ? " is-root-drop-target" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsRootDropTarget(true);
          }}
          onDragLeave={() => setIsRootDropTarget(false)}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsRootDropTarget(false);
            const dragged = readDraggedNode(event);
            if (!dragged) return;
            if (dragged.type === "file") onMoveFile(dragged.index, "");
            if (dragged.type === "folder") onMoveFolder(dragged.path, "");
          }}
        >
          <div className="tree-root-label">
            /
            <TreeMenu
              disabledDelete
              disabledRename
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
              onDelete={onDeleteFile}
              onRename={onRenameFile}
            />
          </div>
          <WorkspaceFileTree
            files={activeFiles}
            folders={activeFolders}
            onCreateFile={onCreateFile}
            onCreateFolder={onCreateFolder}
            onDeleteFile={onDeleteFile}
            onMoveFile={onMoveFile}
            onMoveFolder={onMoveFolder}
            onRenameFile={onRenameFile}
            onSelectFile={onSelectFile}
            selectedFileIndex={selectedFileIndex}
          />
        </div>
      )}

      <div className="file-panel-footer">
        <div className="file-panel-status">
          <span>Git status</span>
          <strong>main</strong>
          <small>Workspace synced</small>
        </div>
        <Link className="file-panel-user settings-entry-button" to="/settings/overview">
          <div className="file-panel-user-avatar" aria-hidden="true">{userEmail[0]?.toUpperCase() ?? "S"}</div>
          <div>
            <strong>Settings</strong>
            <span>{planName}</span>
          </div>
        </Link>
      </div>
    </StoneSurface>
  );
}

export function FilePanelBrand() {
  return (
    <div className="file-panel-brand">
      <StonecodeLogoMark className="file-panel-mark" />
      <strong>stonecode</strong>
    </div>
  );
}

function CourseModuleTree({ activeLessonIndex, course, onSelectLesson }: { activeLessonIndex: number; course: Course; onSelectLesson: (lessonIndex: number) => void }) {
  const [selectedModuleIndex, setSelectedModuleIndex] = useState<number | null>(null);
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const content = course.courseContent;
  const activePath = getActiveCoursePath(course, activeLessonIndex);
  const activeModuleIndex = activePath?.moduleIndex;
  const activeChapterId = activePath?.chapterId;
  const activeBlockId = activePath?.blockId;
  const lessonIndexBySectionId = new Map(
    resolveCourseLessonSteps(course).map((lesson, lessonIndex) => [lesson.sectionId, lessonIndex])
  );

  useEffect(() => {
    if (activeModuleIndex === undefined) return;
    setSelectedModuleIndex(activeModuleIndex ?? null);
    setExpandedChapterId(activeChapterId ?? null);
    setExpandedBlockId(activeBlockId ?? null);
  }, [activeBlockId, activeChapterId, activeModuleIndex]);

  if (!content) return null;

  if (content.schemaVersion === "course-content/v1") {
    const selectedChapter = selectedModuleIndex === null ? null : content.chapters[selectedModuleIndex];
    return (
      <div className="course-module-tree" aria-label="Course modules">
        {selectedChapter ? (
          <ModuleDetail
            chapters={[{
              id: selectedChapter.id,
              title: selectedChapter.title,
              summary: selectedChapter.summary,
              locked: (selectedModuleIndex ?? 0) > 0,
              blocks: selectedChapter.sections.map((section) => ({
                id: section.id,
                kind: "theory",
                title: section.title,
                summary: section.summary,
                steps: (section.blocks.length ? section.blocks : [{ type: "theory" as const, markdown: section.summary }]).map((block, index) => {
                  const sectionId = section.blocks.length ? `${section.id}:${index}` : section.id;
                  return {
                    id: `${section.id}-${index}`,
                    lessonIndex: course.syllabus.find((item) => item.id === sectionId)?.lessonIndex,
                    title: block.type,
                    type: block.type
                  };
                })
              }))
            }]}
            expandedBlockId={expandedBlockId}
            expandedChapterId={expandedChapterId}
            activeLessonIndex={activeLessonIndex}
            moduleSummary={selectedChapter.summary}
            moduleTitle={selectedChapter.title}
            onBack={() => setSelectedModuleIndex(null)}
            onSelectLesson={onSelectLesson}
            onToggleBlock={(blockId) => setExpandedBlockId(expandedBlockId === blockId ? null : blockId)}
            onToggleChapter={(chapterId) => setExpandedChapterId(expandedChapterId === chapterId ? null : chapterId)}
          />
        ) : (
          content.chapters.map((chapter, index) => (
            <button className={`course-module-node module-title-button${index > 0 ? " is-locked" : ""}${activePath?.moduleIndex === index ? " is-current" : ""}`} disabled={index > 0} key={chapter.id} onClick={() => setSelectedModuleIndex(index)} type="button">
              <strong>{chapter.title}</strong>
            </button>
          ))
        )}
      </div>
    );
  }

  const navigableContent = toGeneratedCourseContentV2(content);
  const selectedModule = selectedModuleIndex === null ? null : navigableContent.modules[selectedModuleIndex];
  return (
    <div className="course-module-tree" aria-label="Course modules">
      {selectedModule ? (
        <ModuleDetail
          chapters={selectedModule.topics.map((topic) => ({
            id: topic.id,
            title: topic.title,
            summary: topic.summary,
            locked: !selectedModule.unlocked || !topic.unlocked,
            blocks: topic.blocks.map((block) => ({
              id: block.id,
              kind: block.kind,
              title: block.title,
              summary: block.summary,
              steps: stepsForGeneratedBlock(block).map((step, stepIndex) => ({
                id: `${block.id}-${stepIndex}`,
                lessonIndex: lessonIndexBySectionId.get(`${selectedModule.id}:${topic.id}:${block.id}:${stepIndex}`),
                title: getStepTitle(step, stepIndex),
                type: step.type
              }))
            }))
          }))}
          expandedBlockId={expandedBlockId}
          expandedChapterId={expandedChapterId}
          activeLessonIndex={activeLessonIndex}
          moduleSummary={selectedModule.summary}
          moduleTitle={selectedModule.title}
          onBack={() => setSelectedModuleIndex(null)}
          onSelectLesson={onSelectLesson}
          onToggleBlock={(blockId) => setExpandedBlockId(expandedBlockId === blockId ? null : blockId)}
          onToggleChapter={(chapterId) => setExpandedChapterId(expandedChapterId === chapterId ? null : chapterId)}
        />
      ) : (
        navigableContent.modules.map((module, index) => (
          <button
            className={`course-module-node module-title-button${!module.unlocked ? " is-locked" : ""}${activePath?.moduleIndex === index ? " is-current" : ""}`}
            disabled={!module.unlocked}
            key={module.id}
            onClick={() => {
              setSelectedModuleIndex(index);
              setExpandedChapterId(null);
              setExpandedBlockId(null);
            }}
            type="button"
          >
            <strong>{module.title}</strong>
          </button>
        ))
      )}
    </div>
  );
}

function ModuleDetail({
  chapters,
  expandedBlockId,
  expandedChapterId,
  activeLessonIndex,
  moduleSummary,
  moduleTitle,
  onBack,
  onSelectLesson,
  onToggleBlock,
  onToggleChapter
}: {
  chapters: Array<{ id: string; title: string; summary: string; locked: boolean; blocks: Array<{ id: string; kind?: string; title: string; summary: string; steps: Array<{ id: string; lessonIndex?: number; title: string; type: string }> }> }>;
  expandedBlockId: string | null;
  expandedChapterId: string | null;
  activeLessonIndex: number;
  moduleSummary: string;
  moduleTitle: string;
  onBack: () => void;
  onSelectLesson: (lessonIndex: number) => void;
  onToggleBlock: (blockId: string) => void;
  onToggleChapter: (chapterId: string) => void;
}) {
  return (
    <div className="module-detail-view">
      <button className="module-detail-back" onClick={onBack} type="button">Back to modules</button>
      <div className="module-detail-head">
        <strong>{moduleTitle}</strong>
        <p>{moduleSummary}</p>
      </div>
      <div className="module-chapter-list">
        {chapters.map((chapter) => (
          <div className={`module-chapter${chapter.locked ? " is-locked" : ""}${chapter.blocks.some((block) => block.steps.some((step) => step.lessonIndex === activeLessonIndex)) ? " is-current" : ""}`} key={chapter.id}>
            <button onClick={() => onToggleChapter(chapter.id)} type="button">
              <i aria-hidden="true">{expandedChapterId === chapter.id ? "v" : ">"}</i>
              <strong>{chapter.title}</strong>
            </button>
            {expandedChapterId === chapter.id && (
              <ol className="module-tree-branch">
                {chapter.blocks.map((block) => (
                  <li key={block.id}>
                    <button className={`module-block-toggle${block.steps.some((step) => step.lessonIndex === activeLessonIndex) ? " is-current" : ""}`} onClick={() => onToggleBlock(block.id)} type="button">
                      <i aria-hidden="true">{expandedBlockId === block.id ? "v" : ">"}</i>
                      <b>{block.title}</b>
                      <small>{blockTypeLabel(block.kind, block.steps)} · {block.steps.length} steps</small>
                    </button>
                    {expandedBlockId === block.id && (
                      <div className="module-step-grid">
                        {block.steps.map((step, stepIndex) => (
                          <button
                            className={`module-step-tile is-${step.type.replace(/_/g, "-")}${step.lessonIndex === activeLessonIndex ? " is-current" : ""}`}
                            disabled={chapter.locked || typeof step.lessonIndex !== "number"}
                            key={step.id}
                            onClick={() => {
                              if (typeof step.lessonIndex === "number") onSelectLesson(step.lessonIndex);
                            }}
                            type="button"
                          >
                            <strong>{stepIndex + 1}</strong>
                            <span>{step.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function blockTypeLabel(kind: string | undefined, steps: Array<{ type: string }>) {
  if (kind === "theory") return "Theory";
  if (kind === "quiz") return "Quiz";
  if (kind === "workshop") return "Workshop";
  if (kind === "lab") return "Lab";
  if (kind === "project") return "Project";
  if (kind === "review") return "Review";
  if (steps.some((step) => step.type === "lab")) return "Lab";
  if (steps.some((step) => step.type === "workshop" || step.type === "code_exercise")) return "Workshop";
  if (steps.some((step) => step.type === "project")) return "Project";
  if (steps.every((step) => step.type === "mcq")) return "Quiz";
  if (steps.some((step) => step.type === "mcq")) return "Theory";
  if (steps.some((step) => step.type === "reflection" || step.type === "chat_exercise")) return "Writing";
  return "Theory";
}

function getActiveCoursePath(course: Course, activeLessonIndex: number) {
  const content = course.courseContent;
  if (!content) return null;
  if (content.schemaVersion !== "course-content/v1") {
    const navigableContent = toGeneratedCourseContentV2(content);
    const activeLesson = resolveCourseLessonSteps(course)[activeLessonIndex];
    if (!activeLesson?.moduleId || !activeLesson.topicId || !activeLesson.blockId) return null;
    const moduleIndex = navigableContent.modules.findIndex((module) => module.id === activeLesson.moduleId);
    if (moduleIndex < 0) return null;
    return { moduleIndex, chapterId: activeLesson.topicId, blockId: activeLesson.blockId };
  }
  const activeSection = course.syllabus.find((section) => section.lessonIndex === activeLessonIndex);
  if (!activeSection) return null;

  const chapterIndex = content.chapters.findIndex((chapter) =>
    chapter.sections.some((section) => activeSection.id === section.id || activeSection.id.startsWith(`${section.id}:`))
  );
  if (chapterIndex < 0) return null;
  return {
    moduleIndex: chapterIndex,
    chapterId: content.chapters[chapterIndex].id,
    blockId: activeSection.id
  };
}

function getStepTitle(step: GeneratedCourseStep, stepIndex: number) {
  if ("markdown" in step) {
    const heading = step.markdown.match(/^##\s+(.+)$/m)?.[1]?.trim();
    return heading || step.type;
  }
  if ("prompt" in step) return step.prompt.length > 42 ? `${step.prompt.slice(0, 42).trim()}...` : step.prompt;
  return `Step ${stepIndex + 1}`;
}

function TreeMenu({
  disabledDelete,
  disabledRename,
  onCreateFile,
  onCreateFolder,
  onDelete,
  onRename
}: {
  disabledDelete?: boolean;
  disabledRename?: boolean;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onDelete: () => void;
  onRename: () => void;
}) {
  return (
    <details className="tree-menu" onClick={(event) => event.stopPropagation()}>
      <summary aria-label="Actions">...</summary>
      <div>
        <button onClick={onCreateFile} type="button">New file</button>
        <button onClick={onCreateFolder} type="button">New folder</button>
        <button disabled={disabledRename} onClick={onRename} type="button">Rename</button>
        <button disabled={disabledDelete} onClick={onDelete} type="button">Delete</button>
      </div>
    </details>
  );
}
