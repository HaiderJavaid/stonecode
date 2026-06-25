import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { lessonSteps } from "@/components/stonecode/lessonData";
import { renderMarkdown } from "@/components/stonecode/markdown";
import { CourseCardProps } from "@/components/stonecode/types";
import { useTypedText } from "@/hooks/useTypedText";
import { CourseHome } from "@/components/stonecode/CourseHome";
import { CourseRoadmap } from "@/components/stonecode/CourseRoadmap";
import { IndependentExercisePanel } from "@/components/stonecode/IndependentExercisePanel";

export function CourseCard({
  active,
  hidden,
  hiddenDirection,
  course,
  cardIndex,
  chatMessages,
  fileCount,
  lessonIndex,
  view,
  onOpen,
  onBack,
  onChat,
  onLessonIndexChange,
  onViewChange,
  onStartProject,
  onKeyDown,
  onTypingComplete,
  typingMessageId,
  plan
}: CourseCardProps) {
  const lesson = lessonSteps[lessonIndex];
  const [panelContentReady, setPanelContentReady] = useState(false);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const canvasMessages = useMemo(
    () => chatMessages.filter((message) => message.lessonIndex === lessonIndex),
    [chatMessages, lessonIndex]
  );
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const typingMessage = useMemo(
    () => canvasMessages.find((message) => message.id === typingMessageId && message.role === "assistant"),
    [canvasMessages, typingMessageId]
  );
  const isProjectStarted = fileCount > 0;
  const shouldAnimateLesson = active && view === "resume" && panelContentReady;
  const { typedText: typedLessonContent } = useTypedText(panelContentReady ? lesson.tutor : "", {
    enabled: shouldAnimateLesson
  });
  const typedLessonMarkup = useMemo(() => renderMarkdown(typedLessonContent), [typedLessonContent]);
  const typingMessageMarkup = useMemo(
    () => (panelContentReady && typingMessage ? renderMarkdown(typingMessage.content) : null),
    [panelContentReady, typingMessage]
  );
  const renderedAssistantMessages = useMemo(() => {
    if (!panelContentReady) return new Map();
    return new Map(
      canvasMessages
        .filter((message) => message.role === "assistant" && message.id !== typingMessageId)
        .map((message) => [message.id, renderMarkdown(message.content)])
    );
  }, [canvasMessages, panelContentReady, typingMessageId]);

  useEffect(() => {
    const scrollElement = chatScrollRef.current;
    if (!scrollElement) return;
    scrollElement.scrollTop = scrollElement.scrollHeight;
  }, [canvasMessages, typingMessage?.content]);

  useEffect(() => {
    if (!typingMessageId) onTypingComplete();
  }, [onTypingComplete, typingMessageId]);

  useEffect(() => {
    setPanelContentReady(false);
    setSelectedOptionIndex(null);
    if (!active || !view) return;

    const timer = window.setTimeout(() => setPanelContentReady(true), 460);
    return () => window.clearTimeout(timer);
  }, [active, course.id, view]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const message = String(formData.get("message") ?? "").trim();
    if (!message) return;
    onChat(message, lessonIndex);
    form.reset();
  }

  function sendSuggestion(message: string) {
    onChat(message, lessonIndex);
  }

  function moveLesson(direction: -1 | 1) {
    onLessonIndexChange(Math.min(Math.max(lessonIndex + direction, 0), lessonSteps.length - 1));
  }

  const lessonProgress = ((lessonIndex + 1) / lessonSteps.length) * 100;
  const selectedOption = selectedOptionIndex === null ? null : lesson.options?.[selectedOptionIndex] ?? null;

  const cardClassName = [
    "shadow-card",
    active ? "is-active" : "",
    active && (view === "resume" || view === "exercises") ? "has-chat-canvas" : "",
    hidden ? "is-hidden" : "",
    hidden ? `is-${hiddenDirection}` : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      aria-expanded={active}
      className={cardClassName}
      data-course-id={course.id}
      style={{ "--card-y": `${cardIndex * 166}px` } as React.CSSProperties}
      onClick={() => {
        if (!active) onOpen();
      }}
      onKeyDown={onKeyDown}
      role={active ? "region" : "button"}
      tabIndex={hidden ? -1 : 0}
    >
      <div className="card-top">
        <h2>{course.title}</h2>
        <button
          className="card-back"
          onClick={(event) => {
            event.stopPropagation();
            onBack();
          }}
          type="button"
        >
          Back
        </button>
      </div>
      <div className="rule" />
      <div className="card-summary">
        <p>{course.description}</p>
        <div className="progress">
          <i style={{ width: `${course.progress}%` }} />
        </div>
        <span className="percent">{course.progress}%</span>
      </div>
      <div className="card-detail">
        {active ? (
          <CourseHome
            course={course}
            isProjectStarted={isProjectStarted}
            lessonIndex={lessonIndex}
            onExercises={() => onViewChange("exercises")}
            onRoadmap={() => onViewChange("progress")}
            onStartOrResume={() => {
              if (isProjectStarted) onViewChange("resume");
              else onStartProject(course);
            }}
          />
        ) : (
          <>
            <div className="course-meta">
              <span>{course.mode}</span>
              <span>{course.checkpoint}</span>
              <span>{course.updatedAt}</span>
            </div>
          </>
        )}
      </div>
      {active && view && (
        <div className={`selection-panel${view === "resume" ? " is-chat-canvas" : ""}${panelContentReady ? " is-content-ready" : ""}`} onClick={(event) => event.stopPropagation()}>
          <button className="selection-back" onClick={() => onViewChange(null)} type="button">
            Back
          </button>
          {panelContentReady && view === "resume" && (
            <div className="lesson-panel ai-chat-panel">
              <div className="chat-canvas-head">
                <div className="lesson-progress-copy">
                  <span>Section {lessonIndex + 1} / {lessonSteps.length}</span>
                  <span>{Math.round(lessonProgress)}%</span>
                </div>
                <div className="lesson-progress-track" aria-label={`${Math.round(lessonProgress)}% course progress`}>
                  <i style={{ width: `${lessonProgress}%` }} />
                </div>
                <span>{lesson.label}</span>
                <strong>{lesson.title}</strong>
                {lesson.xp && (
                  <div className="exercise-meta">
                    <span>{lesson.language}</span>
                    <span>{lesson.difficulty}</span>
                    <strong>+{lesson.xp} XP</strong>
                  </div>
                )}
              </div>
              <div className="ai-chat-scroll" aria-label={`${lesson.label} conversation`} ref={chatScrollRef}>
                <div className="ai-message assistant-message ai-response">
                  {typedLessonMarkup}
                  {typedLessonContent.length < lesson.tutor.length && <span className="typing-caret" />}
                </div>
                {lesson.kind === "multiple-choice" && (
                  <div className="lesson-options" aria-label="Answer choices">
                    {lesson.options?.map((option, index) => (
                      <button
                        className={[
                          selectedOptionIndex === index ? "is-selected" : "",
                          selectedOptionIndex !== null && option.correct ? "is-correct" : "",
                          selectedOptionIndex === index && !option.correct ? "is-incorrect" : ""
                        ].filter(Boolean).join(" ")}
                        key={option.label}
                        onClick={() => setSelectedOptionIndex(index)}
                        type="button"
                      >
                        <span>{String.fromCharCode(65 + index)}</span>
                        {option.label}
                      </button>
                    ))}
                    {selectedOption && (
                      <p className={`option-feedback${selectedOption.correct ? " is-correct" : ""}`}>
                        {selectedOption.correct
                          ? `Correct. This answer mutates the original array and earns ${lesson.xp} XP.`
                          : "Not quite. Look for the operation that changes the existing array instead of returning a new one."}
                      </p>
                    )}
                  </div>
                )}
                {canvasMessages.map((message) => (
                  <div className={`ai-message ${message.role === "assistant" ? "assistant-message ai-response" : "user-message"}`} key={message.id}>
                    {message.role === "assistant" ? (
                      <>
                        {message.id === typingMessageId ? typingMessageMarkup : renderedAssistantMessages.get(message.id)}
                        {message.id === typingMessageId && <span className="typing-caret" />}
                      </>
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </div>
                ))}
              </div>
              <div className="chat-dock">
                <div className="quick-action-label">Quick actions</div>
                <div className="reply-suggestions" aria-label="Suggested replies">
                  {lesson.suggestions.map((suggestion) => (
                    <button key={suggestion} onClick={() => sendSuggestion(suggestion)} type="button">
                      {suggestion}
                    </button>
                  ))}
                </div>
                <form className="chat-compose" onSubmit={handleSubmit}>
                  <textarea
                    aria-label="Chat message"
                    name="message"
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    placeholder="Ask a follow-up or answer the exercise..."
                    rows={2}
                  />
                  <button type="submit">Send</button>
                </form>
                <div className="lesson-controls">
                  <button disabled={lessonIndex === 0} onClick={() => moveLesson(-1)} type="button">Prev</button>
                  <button disabled={lessonIndex === lessonSteps.length - 1} onClick={() => moveLesson(1)} type="button">
                    {lessonIndex === lessonSteps.length - 1 ? "Next topic" : "Next section"}
                  </button>
                </div>
              </div>
            </div>
          )}
          {panelContentReady && view === "progress" && (
            <CourseRoadmap
              course={course}
              lessonIndex={lessonIndex}
              onSelectSection={(nextLessonIndex) => {
                onLessonIndexChange(nextLessonIndex);
                onViewChange("resume");
              }}
            />
          )}
          {panelContentReady && view === "exercises" && (
            <IndependentExercisePanel course={course} plan={plan} />
          )}
        </div>
      )}
    </article>
  );
}
