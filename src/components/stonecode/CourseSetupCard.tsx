import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Course,
  GeneratedLearningContent,
  LearningBrief,
  buildSyllabusFromGeneratedContent,
  createDefaultCourseMetadata,
  createLearningCourse,
  learningExperienceLabel
} from "@/data/courses";
import { useTypedText } from "@/hooks/useTypedText";
import {
  AssessmentAnswer,
  AssessmentQuestion,
  AssessmentReview,
  requestGeneratedLearningExperience,
  requestLearningAssessmentPlan,
  requestLearningAssessmentQuestion,
  requestLearningAssessmentReview,
  requestLearningDiscoveryTurn
} from "@/services/courseGeneration";

const assessmentMaxQuestionCount = 3;

type SetupPhase = "discovery" | "ready" | "assessment" | "gap-choice" | "review" | "generating";

type SetupMessage = {
  role: "assistant" | "user";
  content: string;
  id?: string;
};

export type CourseSetupServices = {
  requestDiscoveryTurn: typeof requestLearningDiscoveryTurn;
  requestAssessmentPlan: typeof requestLearningAssessmentPlan;
  requestAssessmentQuestion: typeof requestLearningAssessmentQuestion;
  requestAssessmentReview: typeof requestLearningAssessmentReview;
  requestGeneratedExperience: typeof requestGeneratedLearningExperience;
};

const defaultCourseSetupServices: CourseSetupServices = {
  requestDiscoveryTurn: requestLearningDiscoveryTurn,
  requestAssessmentPlan: requestLearningAssessmentPlan,
  requestAssessmentQuestion: requestLearningAssessmentQuestion,
  requestAssessmentReview: requestLearningAssessmentReview,
  requestGeneratedExperience: requestGeneratedLearningExperience
};

export function CourseSetupCard({
  error,
  isFinalizing = false,
  onCancel,
  onFinalize,
  services
}: {
  error?: string | null;
  isOpen: boolean;
  isFinalizing?: boolean;
  onCancel: () => void;
  onFinalize: (course: Course) => void | Promise<void>;
  services?: Partial<CourseSetupServices>;
}) {
  const setupServices = useMemo(() => ({ ...defaultCourseSetupServices, ...services }), [services]);
  const [phase, setPhase] = useState<SetupPhase>("discovery");
  const [messages, setMessages] = useState<SetupMessage[]>([]);
  const [typingMessageIndex, setTypingMessageIndex] = useState(0);
  const [suggestionsReady, setSuggestionsReady] = useState(false);
  const [discoverySuggestions, setDiscoverySuggestions] = useState<string[]>([]);
  const [discoveryTurn, setDiscoveryTurn] = useState(0);
  const [isLoadingDiscovery, setIsLoadingDiscovery] = useState(false);
  const [subject, setSubject] = useState("");
  const [brief, setBrief] = useState<LearningBrief | null>(null);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [answers, setAnswers] = useState<AssessmentAnswer[]>([]);
  const [assessmentTargetCount, setAssessmentTargetCount] = useState(3);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [writtenAnswer, setWrittenAnswer] = useState("");
  const [codeAnswer, setCodeAnswer] = useState("");
  const [assessmentReview, setAssessmentReview] = useState<AssessmentReview | null>(null);
  const [generatedContent, setGeneratedContent] = useState<GeneratedLearningContent | null>(null);
  const [generationSource, setGenerationSource] = useState<"ai" | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [isGeneratingCourse, setIsGeneratingCourse] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const finalizedRef = useRef(false);
  const discoveryStartedRef = useRef(false);
  const currentQuestion = questions[answers.length] ?? null;
  const typingMessage = messages[typingMessageIndex];
  const typingText = typingMessage?.role === "assistant" ? typingMessage.content : "";
  const { typedText: typedContent } = useTypedText(typingText, { enabled: Boolean(typingText) });
  const plan = useMemo(() => generatedContent ? createPlanFromGeneratedContent(generatedContent) : createDraftPlan(subject, assessmentReview, brief), [assessmentReview, brief, generatedContent, subject]);

  useEffect(() => {
    if (discoveryStartedRef.current) return;
    discoveryStartedRef.current = true;
    void continueLearningDiscovery([], 0);
  }, []);

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
    scrollElement.scrollTop = phase === "assessment" ? 0 : scrollElement.scrollHeight;
  }, [messages, typedContent, currentQuestion, assessmentReview, phase]);

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
    if (!message || phase === "assessment" || phase === "generating" || isLoadingDiscovery) return;
    form.reset();
    void handleSetupText(message);
  }

  async function handleSetupText(message: string) {
    const userMessage: SetupMessage = { role: "user", content: message, id: createSetupMessageId() };
    if (phase === "discovery") {
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setDiscoverySuggestions([]);
      await continueLearningDiscovery(nextMessages, discoveryTurn + 1);
      return;
    }

    if (phase === "gap-choice" && brief) {
      const chooseFoundation = /foundation|course first/i.test(message);
      const nextBrief: LearningBrief = chooseFoundation
        ? { ...brief, type: "course", goal: `Learn the prerequisites for ${brief.goal}`, subject: brief.language || brief.framework || brief.subject || brief.goal, supportMode: "standard" }
        : { ...brief, supportMode: "teaching_heavy" };
      setBrief(nextBrief);
      setSubject(nextBrief.subject || nextBrief.goal);
      setMessages((current) => [...current, userMessage, {
        role: "assistant",
        content: chooseFoundation
          ? "Good call. I changed this into a focused foundation course. Review it below, then confirm."
          : "Got it. We’ll build the project slowly, with narrow refreshers inside the introduction and guided build where you need them.",
        id: createSetupMessageId()
      }]);
      setPhase("review");
      return;
    }

    if (phase === "ready") {
      if (!/\b(take|start|quick|assessment|check me)\b/i.test(message) || /\b(skip|without|no|not now|review plan)\b/i.test(message)) {
        setAssessmentReview(createDirectReview(brief!));
        setMessages((current) => [...current, userMessage, { role: "assistant", content: "No problem—assessment skipped. I’ll use the experience you described and teach from there. Review the plan below and change anything you want.", id: createSetupMessageId() }]);
        setPhase("review");
        return;
      }
      setMessages((current) => [...current, userMessage, { role: "assistant", content: "Okay. This is a quick optional prerequisite check—up to three questions. You can skip anything you do not know.", id: createSetupMessageId() }]);
      setPhase("assessment");
    }
  }

  async function continueLearningDiscovery(conversation: SetupMessage[], turn: number) {
    setIsLoadingDiscovery(true);
    setGenerationError(null);
    try {
      const result = await setupServices.requestDiscoveryTurn({
        messages: conversation.map(({ role, content }) => ({ role, content })),
        turn
      });
      const assistantMessage: SetupMessage = { role: "assistant", content: result.discovery.reply, id: createSetupMessageId() };
      setMessages((current) => [...current, assistantMessage]);
      setDiscoverySuggestions(result.discovery.suggestions);
      setDiscoveryTurn(turn);
      if (result.discovery.status === "ready" && result.discovery.brief) {
        await prepareLearningBrief(result.discovery.brief, result.discovery.nextAction);
      }
    } catch (caughtError) {
      setGenerationError(caughtError instanceof Error ? caughtError.message : "AI course discovery failed.");
    } finally {
      setIsLoadingDiscovery(false);
    }
  }

  async function prepareLearningBrief(nextBrief: LearningBrief, nextAction: "clarify" | "confirm" | "assessment_offer" | "assessment_plan") {
    if (brief && assessmentSignature(brief) !== assessmentSignature(nextBrief)) {
      setQuestions([]);
      setAnswers([]);
      setAssessmentReview(null);
      setAssessmentTargetCount(3);
    }
    setBrief(nextBrief);
    const nextSubject = nextBrief.subject || nextBrief.framework || nextBrief.language || nextBrief.goal;
    setSubject(nextSubject);
    if (nextAction === "confirm") {
      setAssessmentReview(createDirectReview(nextBrief));
      setMessages((current) => [...current, {
        role: "assistant",
        content: confirmationSummary(nextBrief),
        id: createSetupMessageId()
      }]);
      setPhase("review");
      return;
    }

    let assessmentPlan;
    try {
      assessmentPlan = (await setupServices.requestAssessmentPlan({ brief: nextBrief })).plan;
    } catch (caughtError) {
      setGenerationError(caughtError instanceof Error ? caughtError.message : "AI assessment planning failed.");
      return;
    }
    if (!assessmentPlan.supported) {
      setMessages((current) => [...current, {
        role: "assistant",
        content: assessmentPlan.reason || "Stonecode currently supports programming, software, scripting, and code-related courses only. Tell me another programming goal and I’ll help narrow it down.",
        id: createSetupMessageId()
      }]);
      setDiscoverySuggestions([]);
      return;
    }
    const plannedSubject = assessmentPlan.targetSubject || nextSubject;
    const plannedQuestionCount = Math.min(assessmentMaxQuestionCount, Math.max(1, assessmentPlan.prerequisiteAreas.length));
    setSubject(plannedSubject);
    setAssessmentTargetCount(plannedQuestionCount);
    if (!assessmentPlan.requiresAssessment) {
      setAssessmentReview(createDirectReview(nextBrief));
      setMessages((current) => [...current, {
        role: "assistant",
        content: `Great—we’ll make this a ${plannedSubject} ${learningExperienceLabel(nextBrief.type).toLowerCase()}. It starts from the right foundation, so a prerequisite check would not add much. Review the plan below.`,
        id: createSetupMessageId()
      }]);
      setPhase("review");
      return;
    }
    setMessages((current) => [...current, {
      role: "assistant",
        content: `I have enough to plan this ${learningExperienceLabel(nextBrief.type).toLowerCase()}. If you want, take a quick ${plannedQuestionCount === 1 ? "one-question" : `${plannedQuestionCount}-question`} prerequisite check so I can target refreshers. Or skip it and I’ll use what you already told me.`,
      id: createSetupMessageId()
    }]);
    setPhase("ready");
  }

  async function loadAssessmentQuestion() {
    setIsLoadingQuestion(true);
    setGenerationError(null);
    try {
      if (!brief) return;
      const result = await setupServices.requestAssessmentQuestion({ brief, step: questions.length, answers });
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
    setMessages((current) => [...current, { role: "assistant", content: "Quick check complete. I’m using it to tune your learning plan and any focused refreshers.", id: createSetupMessageId() }]);
    try {
      if (!brief) return;
      const result = await setupServices.requestAssessmentReview({ brief, answers });
      setAssessmentReview(result.review);
      if (brief.type === "guided_project" && hasMajorPrerequisiteGaps(result.review)) {
        setMessages((current) => [...current, {
          role: "assistant",
          content: "This project needs a few foundations first. Choose a focused foundation course, or keep the project and let me teach those gaps more slowly inside it.",
          id: createSetupMessageId()
        }]);
        setPhase("gap-choice");
      }
    } catch (caughtError) {
      setAssessmentReview(null);
      setGenerationError(caughtError instanceof Error ? caughtError.message : "AI assessment review failed.");
    }
  }

  async function generateLearningExperience() {
    if (!brief || !assessmentReview || finalizedRef.current) return;
    finalizedRef.current = true;
    setPhase("generating");
    setIsGeneratingCourse(true);
    setGenerationError(null);
    try {
      const result = generatedContent
        ? { content: generatedContent, source: generationSource ?? "ai" as const }
        : await setupServices.requestGeneratedExperience({ brief, answers, assessmentReview });
      if (!generatedContent) {
        setGeneratedContent(result.content);
        setGenerationSource(result.source);
      }
      await onFinalize(createLearningCourse({
        title: result.content.title,
        subject: result.content.subject,
        description: result.content.description,
        languages: result.content.languages,
        tags: result.content.tags,
        syllabus: buildSyllabusFromGeneratedContent(result.content),
        courseContent: result.content,
        experienceType: brief.type,
        learningBrief: brief
      }));
    } catch (caughtError) {
      finalizedRef.current = false;
      setGenerationError(caughtError instanceof Error ? caughtError.message : "Course generation failed.");
      setPhase("review");
    } finally {
      setIsGeneratingCourse(false);
    }
  }

  function modifyLearningPlan() {
    if (!brief) return;
    finalizedRef.current = false;
    setGeneratedContent(null);
    setGenerationSource(null);
    setGenerationError(null);
    setMessages((current) => [...current, {
      role: "assistant",
      content: `Current plan: ${compactBriefSummary(brief)} Tell me what you want to change.`,
      id: createSetupMessageId()
    }]);
    setDiscoverySuggestions(modificationSuggestions(brief));
    setPhase("discovery");
  }

  return (
    <article className="course-setup-card shadow-card is-active has-chat-canvas" aria-label="Learning setup" style={{ "--card-y": "0px" } as React.CSSProperties}>
      <div className="card-top">
        <h2>New learning conversation</h2>
        <button className="card-back" onClick={onCancel} type="button">Close</button>
      </div>
      <div className="selection-panel is-chat-canvas setup-selection-panel">
        <button className="selection-back" onClick={onCancel} type="button">Back</button>
        <div className="lesson-panel ai-chat-panel">
          <div className="chat-canvas-head">
            <span>Setup</span>
            <strong>{phase === "assessment" ? "Assessment" : phase === "generating" ? "Creating experience" : "AI learning guide"}</strong>
          </div>
          <div className="ai-chat-scroll setup-chat" aria-label="Learning setup conversation" ref={chatScrollRef}>
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
            {phase === "discovery" && isLoadingDiscovery && (
              <div className="proposal-loading is-compact" role="status" aria-live="polite">
                <i aria-hidden="true" />
                <p><strong>Learning guide is thinking</strong><span>Finding the most useful next question.</span></p>
              </div>
            )}
            {(phase === "review" || phase === "generating") && assessmentReview && (
              <section className="course-proposal" aria-label="Assessment review">
                <span>{brief ? `${learningExperienceLabel(brief.type)} plan` : "Learning plan"}</span>
                <h3>{plan.title}</h3>
                {brief && <LearningPlanReview brief={brief} review={assessmentReview} />}
              </section>
            )}
            {phase === "generating" && (
              <div className="proposal-loading" role="status" aria-live="polite">
                <i aria-hidden="true" />
                <p>
                  <strong>Creating {brief ? learningExperienceLabel(brief.type).toLowerCase() : "learning experience"}</strong>
                  <span>{generationSource === "ai" ? "AI content ready. Saving..." : generationProgressCopy(brief)}</span>
                </p>
              </div>
            )}
            {generationError && <p className="setup-error">{generationError}</p>}
          </div>
          <div className="chat-dock">
            {phase !== "assessment" && phase !== "review" && phase !== "generating" && (
              <section className={`reply-suggestions setup-favorites${suggestionsReady ? " is-ready" : ""}`} aria-label="Suggested answers">
                {getSuggestions(phase, discoverySuggestions).map((idea) => <button disabled={isLoadingDiscovery} key={idea} onClick={() => void handleSetupText(idea)} type="button">{idea}</button>)}
              </section>
            )}
            {phase === "review" && assessmentReview && (
              <div className="lesson-controls setup-controls">
                <button className="is-secondary" disabled={isGeneratingCourse || isFinalizing} onClick={modifyLearningPlan} type="button">Modify plan</button>
                <button disabled={isGeneratingCourse || isFinalizing} onClick={() => void generateLearningExperience()} type="button">
                  {isGeneratingCourse || isFinalizing ? "Creating..." : confirmationButtonLabel(brief)}
                </button>
              </div>
            )}
            <form className="chat-compose setup-compose" onSubmit={submitMessage}>
              <input disabled={phase === "assessment" || phase === "review" || phase === "generating" || isFinalizing || isLoadingDiscovery} name="message" placeholder={getInputPlaceholder(phase)} type="text" />
              <button disabled={phase === "assessment" || phase === "review" || phase === "generating" || isFinalizing || isLoadingDiscovery} type="submit">Send</button>
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

function LearningPlanReview({ brief, review }: { brief: LearningBrief; review: AssessmentReview }) {
  const topics = brief.topics?.length ? brief.topics : review.suggestedModules;
  return (
    <dl className="setup-plan-summary">
      <div><dt>Goal</dt><dd>{brief.goal}</dd></div>
      {brief.motivation && <div><dt>Purpose</dt><dd>{brief.motivation}</dd></div>}
      {brief.priorKnowledge && <div><dt>Starting point</dt><dd>{brief.priorKnowledge}</dd></div>}
      {topics.length > 0 && <div><dt>{brief.type === "guided_project" ? "Project flow" : "Topics"}</dt><dd><ul>{topics.map((topic) => <li key={topic}>{topic}</li>)}</ul></dd></div>}
      {brief.type === "exercise" && (
        <>
          <div><dt>Difficulty</dt><dd>{titleCase(brief.difficulty || "adaptive")}</dd></div>
          <div><dt>Exercises</dt><dd>{brief.exerciseCount ?? 10} total</dd></div>
          <div><dt>Mix</dt><dd>{brief.codingCount ?? 7} coding · {brief.mcqCount ?? 3} MCQ</dd></div>
        </>
      )}
      {review.gaps.length > 0 && <div><dt>Refreshers</dt><dd><ul>{review.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul></dd></div>}
    </dl>
  );
}

function createPlanFromGeneratedContent(content: GeneratedLearningContent): Pick<Course, "title" | "subject" | "description" | "languages" | "tags" | "syllabus"> {
  return {
    title: content.title,
    subject: content.subject,
    description: content.description,
    languages: content.languages,
    tags: content.tags,
    syllabus: buildSyllabusFromGeneratedContent(content)
  };
}

function createDraftPlan(subject: string, review: AssessmentReview | null, brief: LearningBrief | null): Pick<Course, "title" | "subject" | "description" | "languages" | "tags" | "syllabus"> {
  const normalized = subject.trim() || "Programming basics";
  const metadata = createDefaultCourseMetadata(inferSubject(normalized));
  const description = brief?.type === "exercise"
    ? `${brief.exerciseCount ?? 10} ${brief.difficulty || "adaptive"} practice problems tailored to ${normalized}.`
    : brief?.type === "short_course"
      ? `A compact explanation, analogy, checks, and guided workshop for ${normalized}.`
      : brief?.type === "guided_project"
        ? `A guided build of ${brief.desiredOutcome || brief.goal}: project introduction, 10–20 micro-steps, then a complete-code recap.`
        : review
          ? `Personalized course based on prerequisite assessment. Includes ${review.suggestedModules.join(", ")}.`
          : `Personalized ${normalized} course.`;
  const tags = brief?.type === "exercise"
    ? ["Practice", brief.difficulty || "Adaptive"]
    : brief?.type === "short_course"
      ? ["Short course", "Focused concept"]
      : brief?.type === "guided_project"
        ? ["Guided project", brief.platform || "Build"]
        : metadata.tags;
  return {
    title: brief?.type === "exercise" ? `${normalized} practice`.slice(0, 42) : normalized.length > 42 ? normalized.slice(0, 42).trim() : normalized,
    subject: inferSubject(normalized),
    ...metadata,
    description,
    tags
  };
}

function getSuggestions(phase: SetupPhase, discoverySuggestions: string[]) {
  if (phase === "discovery") return discoverySuggestions;
  if (phase === "ready") return ["Skip assessment and review plan", "Take a quick assessment"];
  if (phase === "gap-choice") return ["Build it slowly with refreshers", "Create a foundation course first"];
  return [];
}

function getInputPlaceholder(phase: SetupPhase) {
  if (phase === "discovery") return "Tell me what you want to learn or build...";
  if (phase === "ready") return "Choose the quick check or skip it...";
  if (phase === "gap-choice") return "Choose how you want to continue...";
  if (phase === "review") return "Review ready. Finalize when ready.";
  return "Assessment in progress...";
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

function createDirectReview(brief: LearningBrief): AssessmentReview {
  const focus = brief.subject || brief.framework || brief.language || brief.goal;
  if (brief.type === "exercise") {
    const count = brief.exerciseCount ?? 10;
    return {
      strengths: [brief.difficulty === "adaptive" ? "Adaptive starting point" : `${brief.difficulty || "Adaptive"} difficulty`],
      gaps: [],
      suggestedModules: brief.topics?.length ? brief.topics : [`${count} ${focus} problem${count === 1 ? "" : "s"}`]
    };
  }
  return {
    strengths: [brief.priorKnowledge || "Starting point captured in discovery"],
    gaps: [],
    suggestedModules: brief.type === "guided_project"
      ? [`Understand ${brief.desiredOutcome || focus}`, "Build it in guided micro-steps", "Review the finished code and concepts"]
      : [focus, "Quick checks", "Small guided workshop"]
  };
}

function confirmationSummary(brief: LearningBrief) {
  if (brief.type === "exercise") return `I’ve prepared a concise practice plan with the exact topics and ${brief.codingCount ?? 7}/${brief.mcqCount ?? 3} coding-to-MCQ split. Review it, modify anything you want, then start practice.`;
  if (brief.type === "short_course") return `This is a focused concept, so I’ll make a compact short course with an explanation, analogy, quick checks, and a small workshop. Review it, then confirm.`;
  return `I have enough to create your ${learningExperienceLabel(brief.type).toLowerCase()}. Review the brief, then confirm.`;
}

function confirmationButtonLabel(brief: LearningBrief | null) {
  if (brief?.type === "short_course") return "Create short course";
  if (brief?.type === "exercise") return "Start practice";
  if (brief?.type === "guided_project") return "Start project";
  return "Finalize course";
}

function generationProgressCopy(brief: LearningBrief | null) {
  if (brief?.type === "exercise") return "Building targeted problems and diagnostics.";
  if (brief?.type === "guided_project") return "Building the project introduction, guided micro-steps, and finished-code recap.";
  if (brief?.type === "short_course") return "Building theory, checks, and a small workshop.";
  return "Building modules, topics, steps, and exercises.";
}

function hasMajorPrerequisiteGaps(review: AssessmentReview) {
  return review.gaps.length >= 3 && review.gaps.length > review.strengths.length;
}

function compactBriefSummary(brief: LearningBrief) {
  const parts = [
    `${learningExperienceLabel(brief.type)} for ${brief.subject || brief.framework || brief.language || brief.goal}`,
    brief.topics?.length ? `topics: ${brief.topics.join(", ")}` : "",
    brief.type === "exercise" ? `${brief.exerciseCount ?? 10} exercises (${brief.codingCount ?? 7} coding, ${brief.mcqCount ?? 3} MCQ)` : "",
    brief.motivation ? `purpose: ${brief.motivation}` : "",
    brief.priorKnowledge ? `starting point: ${brief.priorKnowledge}` : ""
  ].filter(Boolean);
  return `${parts.join("; ")}.`;
}

function modificationSuggestions(brief: LearningBrief) {
  if (brief.type === "exercise") return ["Make it 5 exercises", "Keep 10 exercises", "Make it 20 exercises", "Change the coding/MCQ mix"];
  if (brief.type === "guided_project") return ["Change the stack", "Change the deliverable", "Add a refresher"];
  return ["Change the topics", "Make it more advanced", "Change the goal"];
}

function assessmentSignature(brief: LearningBrief) {
  return [brief.type, brief.subject, brief.language, brief.framework, brief.platform, brief.desiredOutcome, brief.priorKnowledge].join("|").toLowerCase();
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
