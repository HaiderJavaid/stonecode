import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Course, GeneratedCourseContent, buildSyllabusFromGeneratedContent, createDefaultCourseMetadata, createLearningCourse } from "@/data/courses";
import { useTypedText } from "@/hooks/useTypedText";
import {
  AssessmentAnswer,
  AssessmentQuestion,
  AssessmentReview,
  requestAssessmentPlan,
  requestAssessmentQuestion,
  requestAssessmentReview,
  requestGeneratedCourseFromAssessment
} from "@/services/courseGeneration";

const favoriteIdeas = [
  "Machine learning",
  "Beginner web development",
  "React from zero",
  "Data structures basics",
  "Python automation",
  "JavaScript fundamentals"
];

const greetingOptions = [
  "Hi, I'm your personal AI Tutor. What do you want to learn today?",
  "Welcome back. What skill should we turn into a course?",
  "Tell me what you want to learn, and I’ll build the path around it.",
  "What topic should we start with today?"
];

const assessmentMaxQuestionCount = 7;

type SetupPhase = "subject" | "ready" | "assessment" | "review" | "generating";

type SetupMessage = {
  role: "assistant" | "user";
  content: string;
  id?: string;
};

export function CourseSetupCard({
  error,
  isFinalizing = false,
  onCancel,
  onFinalize
}: {
  error?: string | null;
  isOpen: boolean;
  isFinalizing?: boolean;
  onCancel: () => void;
  onFinalize: (course: Course) => void | Promise<void>;
}) {
  const [phase, setPhase] = useState<SetupPhase>("subject");
  const [messages, setMessages] = useState<SetupMessage[]>([
    { role: "assistant", content: pickSessionGreeting(), id: createSetupMessageId() }
  ]);
  const [typingMessageIndex, setTypingMessageIndex] = useState(0);
  const [suggestionsReady, setSuggestionsReady] = useState(false);
  const [subject, setSubject] = useState("");
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [answers, setAnswers] = useState<AssessmentAnswer[]>([]);
  const [assessmentTargetCount, setAssessmentTargetCount] = useState(3);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [writtenAnswer, setWrittenAnswer] = useState("");
  const [codeAnswer, setCodeAnswer] = useState("");
  const [assessmentReview, setAssessmentReview] = useState<AssessmentReview | null>(null);
  const [generatedContent, setGeneratedContent] = useState<GeneratedCourseContent | null>(null);
  const [generationSource, setGenerationSource] = useState<"ai" | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [isGeneratingCourse, setIsGeneratingCourse] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const finalizedRef = useRef(false);
  const currentQuestion = questions[answers.length] ?? null;
  const typingMessage = messages[typingMessageIndex];
  const typingText = typingMessage?.role === "assistant" ? typingMessage.content : "";
  const { typedText: typedContent } = useTypedText(typingText, { enabled: Boolean(typingText) });
  const plan = useMemo(() => generatedContent ? createPlanFromGeneratedContent(generatedContent) : createDraftPlan(subject, assessmentReview), [assessmentReview, generatedContent, subject]);

  useEffect(() => {
    const lastAssistantIndex = messages.map((message) => message.role).lastIndexOf("assistant");
    if (lastAssistantIndex >= 0) setTypingMessageIndex(lastAssistantIndex);
  }, [messages]);

  useEffect(() => {
    setSuggestionsReady(false);
  }, [typingMessage]);

  useEffect(() => {
    if (!typingText || typedContent.length < typingText.length) return;
    const timer = window.setTimeout(() => setSuggestionsReady(true), 240);
    return () => window.clearTimeout(timer);
  }, [typedContent.length, typingText]);

  useEffect(() => {
    const scrollElement = chatScrollRef.current;
    if (!scrollElement) return;
    scrollElement.scrollTop = scrollElement.scrollHeight;
  }, [messages, typedContent, currentQuestion, assessmentReview]);

  useEffect(() => {
    if (phase !== "assessment" || currentQuestion || questions.length >= assessmentTargetCount || isLoadingQuestion) return;
    void loadAssessmentQuestion();
  }, [answers.length, assessmentTargetCount, currentQuestion, isLoadingQuestion, phase, questions.length]);

  useEffect(() => {
    if (phase !== "assessment" || answers.length < assessmentTargetCount) return;
    void finishAssessment();
  }, [answers.length, assessmentTargetCount, phase]);

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const message = String(formData.get("message") ?? "").trim();
    if (!message || phase === "assessment" || phase === "generating") return;
    form.reset();
    void handleSetupText(message);
  }

  async function handleSetupText(message: string) {
    const userMessage: SetupMessage = { role: "user", content: message, id: createSetupMessageId() };
    if (phase === "subject") {
      const nextSubject = message;
      setGenerationError(null);
      let assessmentPlan;
      try {
        assessmentPlan = (await requestAssessmentPlan({ subject: nextSubject })).plan;
      } catch (caughtError) {
        setMessages((current) => [...current, userMessage]);
        setGenerationError(caughtError instanceof Error ? caughtError.message : "AI assessment planning failed.");
        return;
      }
      if (!assessmentPlan.supported) {
        setMessages((current) => [...current, userMessage, {
          role: "assistant",
          content: assessmentPlan.reason || "Stonecode currently supports programming, software, scripting, and code-related courses only. Try something like C++ game dev, Unity scripting, React, backend APIs, Python automation, or data science with code.",
          id: createSetupMessageId()
        }]);
        return;
      }
      const plannedSubject = assessmentPlan.targetSubject || nextSubject;
      setSubject(plannedSubject);
      setAssessmentTargetCount(Math.min(assessmentMaxQuestionCount, Math.max(1, assessmentPlan.prerequisiteAreas.length)));
      if (!assessmentPlan.requiresAssessment) {
        setMessages((current) => [...current, userMessage, {
          role: "assistant",
          content: `Got it: ${plannedSubject}. This can start from foundations, so I do not need a prerequisite assessment first. I’ll build the course from zero with tiny examples before workshops.`,
          id: createSetupMessageId()
        }]);
        setPhase("review");
        requestAssessmentReview({ subject: plannedSubject, answers: [] })
          .then((result) => setAssessmentReview(result.review))
          .catch((caughtError) => {
            setAssessmentReview(null);
            setGenerationError(caughtError instanceof Error ? caughtError.message : "AI assessment review failed.");
          });
        return;
      }
      setMessages((current) => [...current, userMessage, {
        role: "assistant",
        content: `Got it: ${plannedSubject}. This needs prerequisite checks first: ${assessmentPlan.prerequisiteAreas.map((area) => area.title).join(", ")}. I’ll start around entry/mid level, then drop down if you miss or choose “I don’t know.” Ready?`,
        id: createSetupMessageId()
      }]);
      setPhase("ready");
      return;
    }

    if (phase === "ready") {
      setMessages((current) => [...current, userMessage, { role: "assistant", content: "Good. I’ll generate a few prerequisite MCQ checks. Take your time; you can skip anything you do not know.", id: createSetupMessageId() }]);
      setPhase("assessment");
    }
  }

  async function loadAssessmentQuestion() {
    setIsLoadingQuestion(true);
    setGenerationError(null);
    try {
      const result = await requestAssessmentQuestion({ subject, step: questions.length, answers });
      setQuestions((current) => [...current, result.question]);
      if (result.question.type === "code") setCodeAnswer(result.question.starterCode);
    } catch (caughtError) {
      setGenerationError(caughtError instanceof Error ? caughtError.message : "AI assessment question failed.");
    } finally {
      setIsLoadingQuestion(false);
    }
  }

  function submitAssessmentAnswer(skipped = false) {
    if (!currentQuestion) return;
    const answer = skipped
      ? null
      : currentQuestion.type === "mcq"
        ? selectedOption
        : currentQuestion.type === "writing"
          ? writtenAnswer.trim()
          : codeAnswer.trim();
    const isCourseShaping = currentQuestion.type === "mcq" && currentQuestion.questionKind === "course_shaping";
    const isCorrect = currentQuestion.type === "mcq" && !isCourseShaping && !skipped && selectedOption === currentQuestion.correctOptionIndex;
    const needsFollowUp = !isCourseShaping && (skipped || (currentQuestion.type === "mcq" && !isCorrect));
    if (needsFollowUp) {
      setAssessmentTargetCount((current) => Math.min(current + 1, assessmentMaxQuestionCount));
    }
    setAnswers((current) => [...current, {
      questionId: currentQuestion.id,
      type: currentQuestion.type,
      questionKind: currentQuestion.type === "mcq" ? currentQuestion.questionKind ?? "prerequisite" : undefined,
      assessmentArea: currentQuestion.type === "mcq" ? currentQuestion.assessmentArea : undefined,
      difficulty: currentQuestion.type === "mcq" ? currentQuestion.difficulty : undefined,
      answer,
      prompt: currentQuestion.prompt,
      options: currentQuestion.type === "mcq" ? currentQuestion.options : undefined,
      correctOptionIndex: currentQuestion.type === "mcq" ? currentQuestion.correctOptionIndex : undefined,
      isCorrect: currentQuestion.type === "mcq" && !isCourseShaping ? isCorrect : undefined,
      skipped
    }]);
    setSelectedOption(null);
    setWrittenAnswer("");
    setCodeAnswer("");
  }

  async function finishAssessment() {
    setPhase("review");
    setMessages((current) => [...current, { role: "assistant", content: "Assessment complete. I’m reviewing your strengths, gaps, and the modules this course should include.", id: createSetupMessageId() }]);
    try {
      const result = await requestAssessmentReview({ subject, answers });
      setAssessmentReview(result.review);
    } catch (caughtError) {
      setAssessmentReview(null);
      setGenerationError(caughtError instanceof Error ? caughtError.message : "AI assessment review failed.");
    }
  }

  async function generateCourse() {
    setPhase("generating");
    setIsGeneratingCourse(true);
    setGenerationError(null);
    try {
      const result = await requestGeneratedCourseFromAssessment({ subject, answers, assessmentReview: assessmentReview! });
      setGeneratedContent(result.content);
      setGenerationSource(result.source);
      finalizedRef.current = true;
      await onFinalize(createLearningCourse({
        title: result.content.title,
        subject: result.content.subject,
        description: result.content.description,
        languages: result.content.languages,
        tags: result.content.tags,
        syllabus: buildSyllabusFromGeneratedContent(result.content),
        courseContent: result.content
      }));
    } catch (caughtError) {
      setGenerationError(caughtError instanceof Error ? caughtError.message : "Course generation failed.");
      setPhase("review");
    } finally {
      setIsGeneratingCourse(false);
    }
  }

  return (
    <article className="course-setup-card shadow-card is-active has-chat-canvas" aria-label="Course setup" style={{ "--card-y": "0px" } as React.CSSProperties}>
      <div className="card-top">
        <h2>New course</h2>
        <button className="card-back" onClick={onCancel} type="button">Close</button>
      </div>
      <div className="selection-panel is-chat-canvas setup-selection-panel">
        <button className="selection-back" onClick={onCancel} type="button">Back</button>
        <div className="lesson-panel ai-chat-panel">
          <div className="chat-canvas-head">
            <span>Setup</span>
            <strong>{phase === "assessment" ? "Assessment" : phase === "generating" ? "Generating course" : "Course tutor"}</strong>
          </div>
          <div className="ai-chat-scroll setup-chat" aria-label="Course setup conversation" ref={chatScrollRef}>
            {phase === "assessment" ? (
              <AssessmentPanel
                codeAnswer={codeAnswer}
                isLoading={isLoadingQuestion}
                onCodeAnswer={setCodeAnswer}
                onSelectedOption={setSelectedOption}
                onSkip={() => submitAssessmentAnswer(true)}
                onSubmit={() => submitAssessmentAnswer(false)}
                onWrittenAnswer={setWrittenAnswer}
                question={currentQuestion}
                selectedOption={selectedOption}
                step={answers.length + 1}
                total={assessmentTargetCount}
                writtenAnswer={writtenAnswer}
              />
            ) : (
              messages.map((message, index) => (
                <div className={`ai-message ${message.role === "assistant" ? "assistant-message ai-response" : "user-message"}`} key={message.id ?? `${message.role}-${index}`}>
                  <p>{message.role === "assistant" && index === typingMessageIndex ? typedContent : message.content}</p>
                  {message.role === "assistant" && index === typingMessageIndex && typedContent.length < message.content.length && <span className="typing-caret" />}
                </div>
              ))
            )}
            {(phase === "review" || phase === "generating") && assessmentReview && (
              <section className="course-proposal" aria-label="Assessment review">
                <span>Assessment review</span>
                <h3>{plan.title}</h3>
                <p>{plan.description}</p>
                <ReviewList title="Strong" items={assessmentReview.strengths} />
                <ReviewList title="Needs support" items={assessmentReview.gaps} />
                <ReviewList title="Suggested modules" items={assessmentReview.suggestedModules} />
                <div className="proposal-tags">
                  {[...plan.languages, ...plan.tags].map((tag) => <i key={tag}>{tag}</i>)}
                </div>
              </section>
            )}
            {phase === "generating" && (
              <div className="proposal-loading" role="status" aria-live="polite">
                <i aria-hidden="true" />
                <p>
                  <strong>Generating full course</strong>
                  <span>{generationSource === "ai" ? "AI course ready. Saving..." : "Building modules, topics, steps, and exercises."}</span>
                </p>
              </div>
            )}
            {generationError && <p className="setup-error">{generationError}</p>}
          </div>
          <div className="chat-dock">
            {phase !== "assessment" && phase !== "review" && phase !== "generating" && (
              <section className={`reply-suggestions setup-favorites${suggestionsReady ? " is-ready" : ""}`} aria-label="Course suggestions">
                {getSuggestions(phase).map((idea) => <button key={idea} onClick={() => handleSetupText(idea)} type="button">{idea}</button>)}
              </section>
            )}
            {phase === "review" && assessmentReview && (
              <div className="lesson-controls setup-controls">
                <button disabled={isGeneratingCourse || isFinalizing} onClick={() => void generateCourse()} type="button">
                  {isGeneratingCourse || isFinalizing ? "Finalizing..." : "Finalize course"}
                </button>
              </div>
            )}
            <form className="chat-compose setup-compose" onSubmit={submitMessage}>
              <input disabled={phase === "assessment" || phase === "review" || phase === "generating" || isFinalizing} name="message" placeholder={getInputPlaceholder(phase)} type="text" />
              <button disabled={phase === "assessment" || phase === "review" || phase === "generating" || isFinalizing} type="submit">Send</button>
            </form>
            {error && <p className="setup-error">{error}</p>}
          </div>
        </div>
      </div>
    </article>
  );
}

function AssessmentPanel({
  codeAnswer,
  isLoading,
  onCodeAnswer,
  onSelectedOption,
  onSkip,
  onSubmit,
  onWrittenAnswer,
  question,
  selectedOption,
  step,
  total,
  writtenAnswer
}: {
  codeAnswer: string;
  isLoading: boolean;
  onCodeAnswer: (value: string) => void;
  onSelectedOption: (value: number) => void;
  onSkip: () => void;
  onSubmit: () => void;
  onWrittenAnswer: (value: string) => void;
  question: AssessmentQuestion | null;
  selectedOption: number | null;
  step: number;
  total: number;
  writtenAnswer: string;
}) {
  if (isLoading || !question) {
    return (
      <div className="proposal-loading" role="status" aria-live="polite">
        <i aria-hidden="true" />
        <p><strong>Loading assessment</strong><span>Preparing question {step}.</span></p>
      </div>
    );
  }

  const submitDisabled = question.type === "mcq" ? selectedOption === null : question.type === "writing" ? !writtenAnswer.trim() : !codeAnswer.trim();
  return (
    <section className="setup-assessment exercise-view" aria-label={`Assessment question ${step}`}>
      <div className="lesson-progress-copy">
        <span>Assessment {step} / {total}</span>
        <span>{Math.round((step / total) * 100)}%</span>
      </div>
      <div className="lesson-progress-track" aria-label={`${Math.round((step / total) * 100)}% assessment progress`}>
        <i style={{ width: `${Math.round((step / total) * 100)}%` }} />
      </div>
      <h3>{question.prompt}</h3>
      {question.type === "mcq" && (
        <div className="lesson-options is-entering">
          {question.options.map((option, index) => (
            <button className={selectedOption === index ? "is-selected" : ""} key={option} onClick={() => onSelectedOption(index)} type="button">
              <span>{String.fromCharCode(65 + index)}</span>
              {option}
            </button>
          ))}
        </div>
      )}
      {question.type === "writing" && <textarea className="setup-assessment-input" onChange={(event) => onWrittenAnswer(event.target.value)} rows={4} value={writtenAnswer} />}
      {question.type === "code" && <textarea className="setup-assessment-input is-code" onChange={(event) => onCodeAnswer(event.target.value)} rows={7} value={codeAnswer} />}
      <div className="lesson-controls setup-controls">
        <button onClick={onSkip} type="button">I don&apos;t know</button>
        <button disabled={submitDisabled} onClick={onSubmit} type="button">Submit</button>
      </div>
    </section>
  );
}

function ReviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="setup-review-list">
      <strong>{title}</strong>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </div>
  );
}

function createPlanFromGeneratedContent(content: GeneratedCourseContent): Pick<Course, "title" | "subject" | "description" | "languages" | "tags" | "syllabus"> {
  return {
    title: content.title,
    subject: content.subject,
    description: content.description,
    languages: content.languages,
    tags: content.tags,
    syllabus: buildSyllabusFromGeneratedContent(content)
  };
}

function createDraftPlan(subject: string, review: AssessmentReview | null): Pick<Course, "title" | "subject" | "description" | "languages" | "tags" | "syllabus"> {
  const normalized = subject.trim() || "Programming basics";
  const metadata = createDefaultCourseMetadata(inferSubject(normalized));
  return {
    title: normalized.length > 34 ? normalized.slice(0, 34).trim() : normalized,
    subject: inferSubject(normalized),
    description: review ? `Personalized course based on prerequisite assessment. Includes ${review.suggestedModules.join(", ")}.` : `Personalized ${normalized} course.`,
    ...metadata
  };
}

function getSuggestions(phase: SetupPhase) {
  if (phase === "subject") return favoriteIdeas;
  if (phase === "ready") return ["I’m ready", "Start assessment", "Not sure, but continue"];
  return [];
}

function getInputPlaceholder(phase: SetupPhase) {
  if (phase === "subject") return "I want to learn...";
  if (phase === "ready") return "I’m ready...";
  if (phase === "review") return "Review ready. Finalize when ready.";
  return "Assessment in progress...";
}

function pickSessionGreeting() {
  if (typeof window === "undefined") return greetingOptions[0];
  const key = "stonecode.setupGreetingSeed";
  const currentSeed = Number(window.sessionStorage.getItem(key) ?? "-1");
  const nextSeed = (Number.isFinite(currentSeed) ? currentSeed + 1 : 0) % greetingOptions.length;
  window.sessionStorage.setItem(key, String(nextSeed));
  return greetingOptions[nextSeed] ?? greetingOptions[0];
}

function createSetupMessageId() {
  return `setup-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function inferSubject(message: string) {
  const value = message.toLowerCase();
  if (value.includes("react")) return "React";
  if (value.includes("python")) return "Python";
  if (value.includes("machine learning") || value.includes("ml")) return "Machine Learning";
  if (value.includes("interview") || value.includes("data structure")) return "Computer Science";
  if (value.includes("website") || value.includes("portfolio") || value.includes("web")) return "Web Development";
  if (value.includes("javascript") || value.includes("js")) return "JavaScript";
  return "Programming";
}
