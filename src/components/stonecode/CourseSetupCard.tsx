import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Course,
  LearningBrief,
  buildSyllabusFromGeneratedContent,
  createLearningCourse,
  learningExperienceLabel
} from "@/data/courses";
import { useTypedText } from "@/hooks/useTypedText";
import {
  LearningProposal,
  clearPendingGenerationJob,
  finalizeLearningProposal,
  generationJobFailureMessage,
  patchLearningProposal,
  requestGeneratedLearningExperience,
  requestGenerationJob,
  requestLearningDiscoveryTurn,
  requestLearningProposal,
  requestProductFeatures,
  rememberPendingGenerationJob
} from "@/services/courseGeneration";
import { StoneStackMark } from "@/components/stonecode/StonecodeBrand";

type SetupPhase = "discovery" | "proposal" | "generating";
type SetupMessage = { role: "assistant" | "user"; content: string; id?: string };

export type CourseSetupServices = {
  requestDiscoveryTurn: typeof requestLearningDiscoveryTurn;
  requestProposal: typeof requestLearningProposal;
  patchProposal: typeof patchLearningProposal;
  finalizeProposal: typeof finalizeLearningProposal;
  requestJob: typeof requestGenerationJob;
  requestFeatures: typeof requestProductFeatures;
  requestGeneratedExperience: typeof requestGeneratedLearningExperience;
};

const defaultCourseSetupServices: CourseSetupServices = {
  requestDiscoveryTurn: requestLearningDiscoveryTurn,
  requestProposal: requestLearningProposal,
  patchProposal: patchLearningProposal,
  finalizeProposal: finalizeLearningProposal,
  requestJob: requestGenerationJob,
  requestFeatures: requestProductFeatures,
  requestGeneratedExperience: requestGeneratedLearningExperience
};

export function CourseSetupCard({
  error,
  isFinalizing = false,
  onCancel,
  onFinalize,
  onGenerationComplete,
  services
}: {
  error?: string | null;
  isOpen: boolean;
  isFinalizing?: boolean;
  onCancel: () => void;
  onFinalize: (course: Course) => void | Promise<void>;
  onGenerationComplete?: (courseId: string) => void | Promise<void>;
  services?: Partial<CourseSetupServices>;
}) {
  const setupServices = useMemo(() => ({ ...defaultCourseSetupServices, ...services }), [services]);
  const [phase, setPhase] = useState<SetupPhase>("discovery");
  const [messages, setMessages] = useState<SetupMessage[]>([]);
  const [typingMessageIndex, setTypingMessageIndex] = useState(0);
  const [suggestionsReady, setSuggestionsReady] = useState(false);
  const [discoverySuggestions, setDiscoverySuggestions] = useState<string[]>([]);
  const [discoverySelectionMode, setDiscoverySelectionMode] = useState<"single" | "multi">("single");
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const [discoveryTurn, setDiscoveryTurn] = useState(0);
  const [isLoadingDiscovery, setIsLoadingDiscovery] = useState(false);
  const [brief, setBrief] = useState<LearningBrief | null>(null);
  const [proposal, setProposal] = useState<LearningProposal | null>(null);
  const [proposalDraft, setProposalDraft] = useState<LearningProposal | null>(null);
  const [isEditingProposal, setIsEditingProposal] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isGeneratingCourse, setIsGeneratingCourse] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const finalizedRef = useRef(false);
  const discoveryStartedRef = useRef(false);
  const discoveryRequestRef = useRef(0);
  const proposalSupportRef = useRef<boolean | null>(null);
  const proposalKeyRef = useRef(createRequestKey("proposal"));
  const proposalEditRef = useRef(0);
  const continueLearningDiscoveryRef = useRef(continueLearningDiscovery);
  continueLearningDiscoveryRef.current = continueLearningDiscovery;
  const typingMessage = messages[typingMessageIndex];
  const typingText = typingMessage?.role === "assistant" ? typingMessage.content : "";
  const { typedText: typedContent } = useTypedText(typingText, { enabled: Boolean(typingText) });

  useEffect(() => {
    if (discoveryStartedRef.current) return;
    discoveryStartedRef.current = true;
    void continueLearningDiscoveryRef.current([], 0);
  }, []);

  useEffect(() => {
    const lastAssistantIndex = messages.map((message) => message.role).lastIndexOf("assistant");
    if (lastAssistantIndex >= 0) setTypingMessageIndex(lastAssistantIndex);
  }, [messages]);

  useEffect(() => setSuggestionsReady(false), [typingMessage]);

  useEffect(() => {
    if (!typingText || typedContent.length < typingText.length) return;
    const timer = window.setTimeout(() => setSuggestionsReady(true), 240);
    return () => window.clearTimeout(timer);
  }, [typedContent.length, typingText]);

  useEffect(() => {
    const scrollElement = chatScrollRef.current;
    if (scrollElement) scrollElement.scrollTop = scrollElement.scrollHeight;
  }, [messages, typedContent, phase, proposal]);

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = String(new FormData(form).get("message") ?? "").trim();
    if (!message || phase !== "discovery" || isLoadingDiscovery) return;
    form.reset();
    const userMessage: SetupMessage = { role: "user", content: message, id: createSetupMessageId() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDiscoverySuggestions([]);
    setSelectedSuggestions([]);
    void continueLearningDiscovery(nextMessages, discoveryTurn + 1);
  }

  function submitSuggestedAnswer(message: string) {
    if (!message || isLoadingDiscovery) return;
    const userMessage: SetupMessage = { role: "user", content: message, id: createSetupMessageId() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDiscoverySuggestions([]);
    setSelectedSuggestions([]);
    void continueLearningDiscovery(nextMessages, discoveryTurn + 1);
  }

  async function continueLearningDiscovery(conversation: SetupMessage[], turn: number) {
    const requestNumber = ++discoveryRequestRef.current;
    setIsLoadingDiscovery(true);
    setGenerationError(null);
    try {
      const result = await setupServices.requestDiscoveryTurn({
        messages: conversation.map(({ role, content }) => ({ role, content })),
        turn
      });
      if (requestNumber !== discoveryRequestRef.current || result.discovery.responseTurn !== turn) return;
      setMessages((current) => [...current, { role: "assistant", content: result.discovery.reply, id: createSetupMessageId() }]);
      setDiscoverySuggestions(result.discovery.suggestions);
      setDiscoverySelectionMode(result.discovery.selectionMode ?? "single");
      setSelectedSuggestions([]);
      setDiscoveryTurn(turn);
      if (result.discovery.status === "ready" && result.discovery.brief) {
        await prepareLearningProposal(result.discovery.brief);
      }
    } catch (caughtError) {
      if (requestNumber !== discoveryRequestRef.current) return;
      setGenerationError(caughtError instanceof Error ? caughtError.message : "AI learning discovery failed.");
    } finally {
      if (requestNumber === discoveryRequestRef.current) setIsLoadingDiscovery(false);
    }
  }

  async function prepareLearningProposal(nextBrief: LearningBrief) {
    setBrief(nextBrief);
    setGenerationError(null);
    let proposalsEnabled = proposalSupportRef.current;
    if (proposalsEnabled === null) {
      if (services && !services.requestProposal) {
        proposalsEnabled = false;
      } else {
        const featureResult: { features: Record<string, boolean> } = await setupServices.requestFeatures().catch(() => ({ features: {} }));
        proposalsEnabled = Boolean(featureResult.features.learning_proposals_v1 && featureResult.features.credits_v1);
      }
      proposalSupportRef.current = proposalsEnabled;
    }
    if (proposalsEnabled) {
      const result = await setupServices.requestProposal({ brief: nextBrief, idempotencyKey: proposalKeyRef.current });
      setProposal(result.proposal);
      setProposalDraft(cloneProposal(result.proposal));
    }
    setMessages((current) => [...current, {
      role: "assistant",
      content: proposalsEnabled
        ? "Your editable outline and deterministic Stone quote are ready. Review both before creating anything."
        : "Your learning brief is ready. Review it before creating the learning path.",
      id: createSetupMessageId()
    }]);
    setPhase("proposal");
  }

  async function saveProposal() {
    if (!proposal || !proposalDraft) return proposal;
    setGenerationError(null);
    const result = await setupServices.patchProposal({
      proposalId: proposal.id,
      proposal: {
        title: proposalDraft.title,
        summary: proposalDraft.summary,
        outcomes: proposalDraft.outcomes,
        items: proposalDraft.items,
        totals: proposalDraft.totals
      },
      idempotencyKey: `edit-${proposal.id}-${++proposalEditRef.current}`
    });
    setProposal(result.proposal);
    setProposalDraft(cloneProposal(result.proposal));
    setIsEditingProposal(false);
    return result.proposal;
  }

  async function generateLearningExperience() {
    if (!brief || finalizedRef.current) return;
    finalizedRef.current = true;
    setPhase("generating");
    setIsGeneratingCourse(true);
    setGenerationError(null);
    setGenerationProgress(1);
    try {
      if (proposal) {
        const approved = isEditingProposal ? await saveProposal() : proposal;
        if (!approved) throw new Error("Learning proposal is unavailable.");
        const { job } = await setupServices.finalizeProposal({
          proposalId: approved.id,
          idempotencyKey: createRequestKey(`finalize-${approved.id}`)
        });
        rememberPendingGenerationJob(job.id);
        const completed = await waitForGenerationJob(job.id, setupServices.requestJob, setGenerationProgress);
        if (!completed.result_course_id) throw new Error("Generation finished without a learning path.");
        if (onGenerationComplete) await onGenerationComplete(completed.result_course_id);
        clearPendingGenerationJob(job.id);
        return;
      }

      const assessmentReview = directReview(brief);
      const result = await setupServices.requestGeneratedExperience({ brief, answers: [], assessmentReview });
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
      setGenerationError(caughtError instanceof Error ? caughtError.message : "Learning-path generation failed.");
      setPhase("proposal");
    } finally {
      setIsGeneratingCourse(false);
    }
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
            <strong>{phase === "generating" ? "Creating learning path" : phase === "proposal" ? "Review proposal" : "AI learning guide"}</strong>
          </div>
          <div className="ai-chat-scroll setup-chat" aria-label="Learning setup conversation" ref={chatScrollRef}>
            {messages.map((message, index) => (
              <div className={`ai-message ${message.role === "assistant" ? "assistant-message ai-response" : "user-message"}`} key={message.id ?? `${message.role}-${index}`}>
                <p>{message.role === "assistant" && index === typingMessageIndex ? typedContent : message.content}</p>
                {message.role === "assistant" && index === typingMessageIndex && typedContent.length < message.content.length && <span className="typing-caret" />}
              </div>
            ))}
            {phase === "discovery" && isLoadingDiscovery && <TypingIndicator />}
            {(phase === "proposal" || phase === "generating") && brief && (
              <ProposalReview
                brief={brief}
                draft={proposalDraft}
                editing={isEditingProposal}
                onDraft={setProposalDraft}
              />
            )}
            {phase === "generating" && (
              <LoadingStatus
                title={`Creating ${proposal ? proposalTypeLabel(proposal.type).toLowerCase() : learningExperienceLabel(brief?.type ?? "course").toLowerCase()}`}
                detail={proposal ? `${generationProgress}% complete. You can safely refresh; this job is persisted.` : "Building lessons and exercises."}
              />
            )}
            {generationError && <p className="setup-error">{generationError}</p>}
          </div>
          <div className="chat-dock">
            {phase === "discovery" && (
              <section className={`reply-suggestions setup-favorites${suggestionsReady ? " is-ready" : ""}${discoverySelectionMode === "multi" ? " is-multi" : ""}`} aria-label="Suggested answers">
                {discoverySuggestions.map((idea) => {
                  const selected = selectedSuggestions.includes(idea);
                  return <button
                    aria-pressed={discoverySelectionMode === "multi" ? selected : undefined}
                    className={selected ? "is-selected" : undefined}
                    disabled={isLoadingDiscovery}
                    key={idea}
                    onClick={() => discoverySelectionMode === "multi"
                      ? setSelectedSuggestions((current) => current.includes(idea) ? current.filter((item) => item !== idea) : [...current, idea])
                      : submitSuggestedAnswer(idea)}
                    type="button"
                  >
                    {discoverySelectionMode === "multi" && <span className="setup-focus-checkbox" aria-hidden="true">{selected ? "✓" : ""}</span>}
                    <span>{idea}</span>
                  </button>;
                })}
                {discoverySelectionMode === "multi" && selectedSuggestions.length > 0 && (
                  <button className="setup-focus-continue" disabled={isLoadingDiscovery} onClick={() => submitSuggestedAnswer(`Focus areas: ${selectedSuggestions.join(", ")}`)} type="button">
                    Continue with {selectedSuggestions.length} selected
                  </button>
                )}
              </section>
            )}
            {phase === "proposal" && (
              <div className="lesson-controls setup-controls">
                {proposal && (
                  <button className="is-secondary" disabled={isGeneratingCourse || isFinalizing} onClick={() => {
                    if (isEditingProposal) void saveProposal().catch((caughtError) => setGenerationError(caughtError instanceof Error ? caughtError.message : "Could not save proposal."));
                    else setIsEditingProposal(true);
                  }} type="button">{isEditingProposal ? "Save changes" : "Edit proposal"}</button>
                )}
                <button className={proposal ? "setup-stone-action" : undefined} disabled={isEditingProposal || isGeneratingCourse || isFinalizing} onClick={() => void generateLearningExperience()} type="button">
                  {isGeneratingCourse || isFinalizing ? (
                    <span>Creating...</span>
                  ) : proposal ? (
                    <>
                      <span>Generate</span>
                      <span className="setup-stone-cost"><StoneStackMark /><strong>{proposal.creditQuote.credits}</strong></span>
                    </>
                  ) : (
                    <span>{confirmationButtonLabel(brief)}</span>
                  )}
                </button>
              </div>
            )}
            <form className="chat-compose setup-compose" onSubmit={submitMessage}>
              <input disabled={phase !== "discovery" || isLoadingDiscovery || isFinalizing} name="message" placeholder={phase === "discovery" ? "Tell me what you want to learn or build..." : "Proposal ready. Edit or create when ready."} type="text" />
              <button disabled={phase !== "discovery" || isLoadingDiscovery || isFinalizing} type="submit">Send</button>
            </form>
            {error && <p className="setup-error">{error}</p>}
          </div>
        </div>
      </div>
    </article>
  );
}

function ProposalReview({ brief, draft, editing, onDraft }: {
  brief: LearningBrief;
  draft: LearningProposal | null;
  editing: boolean;
  onDraft: (value: LearningProposal) => void;
}) {
  if (!draft) {
    return (
      <section className="course-proposal" aria-label="Learning brief">
        <span>{learningExperienceLabel(brief.type)} plan</span>
        <h3>{brief.subject || brief.framework || brief.language || brief.goal}</h3>
        <dl className="setup-plan-summary">
          <div><dt>Goal</dt><dd>{brief.goal}</dd></div>
          {brief.priorKnowledge && <div><dt>Starting point</dt><dd>{brief.priorKnowledge}</dd></div>}
          {brief.topics?.length ? <div><dt>Topics</dt><dd>{brief.topics.join(", ")}</dd></div> : null}
        </dl>
      </section>
    );
  }
  return (
    <section className="course-proposal learning-proposal-v1" aria-label="Editable learning proposal">
      <span>{proposalTypeLabel(draft.type)} · {draft.creditQuote.credits} Stone{draft.creditQuote.credits === 1 ? "" : "s"}</span>
      {editing
        ? <input aria-label="Proposal title" className="proposal-title-input" onChange={(event) => onDraft({ ...draft, title: event.target.value })} value={draft.title} />
        : <h3>{draft.title}</h3>}
      {editing
        ? <textarea aria-label="Proposal summary" onChange={(event) => onDraft({ ...draft, summary: event.target.value })} rows={3} value={draft.summary} />
        : <p>{draft.summary}</p>}
      <dl className="setup-plan-summary">
        <div><dt>Learning area</dt><dd>{domainLabel(draft.domainId ?? brief.domainId)}</dd></div>
        {draft.technologyId && <div><dt>Technology</dt><dd>{draft.technology}</dd></div>}
        {draft.focusAreas?.length ? <div><dt>Focus</dt><dd>{draft.focusAreas.join(", ")}</dd></div> : null}
        <div><dt>Scope</dt><dd>{scopeCopy(draft)}</dd></div>
      </dl>
      <ol className="learning-proposal-items">
        {draft.items.map((item, index) => (
          <li key={item.id}>
            {editing ? (
              <>
                <input aria-label={`Item ${index + 1} title`} onChange={(event) => onDraft({ ...draft, items: draft.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, title: event.target.value } : entry) })} value={item.title} />
                <textarea aria-label={`Item ${index + 1} summary`} onChange={(event) => onDraft({ ...draft, items: draft.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, summary: event.target.value } : entry) })} rows={2} value={item.summary} />
              </>
            ) : <><strong>{item.title}</strong><p>{item.summary}</p></>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function LoadingStatus({ title, detail }: { title: string; detail: string }) {
  return <div className="proposal-loading" role="status" aria-live="polite"><i aria-hidden="true" /><p><strong>{title}</strong><span>{detail}</span></p></div>;
}

function TypingIndicator() {
  return (
    <div className="setup-typing-indicator" role="status" aria-label="AI is typing" aria-live="polite">
      <i aria-hidden="true" />
      <i aria-hidden="true" />
      <i aria-hidden="true" />
    </div>
  );
}

async function waitForGenerationJob(jobId: string, requestJob: typeof requestGenerationJob, onProgress: (progress: number) => void) {
  for (let attempt = 0; attempt < 600; attempt += 1) {
    const { job } = await requestJob(jobId);
    onProgress(job.progress ?? 0);
    if (job.status === "succeeded") return job;
    if (job.status === "failed" || job.status === "cancelled") throw new Error(generationJobFailureMessage(job));
    await new Promise((resolve) => window.setTimeout(resolve, 1500));
  }
  throw new Error("Generation is still running. Refresh to resume from the persisted job.");
}

function directReview(brief: LearningBrief) {
  return {
    strengths: [brief.priorKnowledge || "Starting point captured in discovery"],
    gaps: [],
    suggestedModules: brief.topics?.length ? brief.topics : [brief.subject || brief.framework || brief.language || brief.goal]
  };
}

function confirmationButtonLabel(brief: LearningBrief | null) {
  if (brief?.type === "exercise") return "Start exercise pack";
  if (brief?.type === "guided_project") return "Start guided project";
  return "Create course";
}

function proposalTypeLabel(type: LearningProposal["type"]) {
  if (type === "exercise") return "Exercise pack";
  if (type === "project") return "Guided project";
  return "Course";
}

function scopeCopy(proposal: LearningProposal) {
  if (proposal.type === "exercise") return `${proposal.totals.exercises} exercises`;
  if (proposal.type === "project") return `${proposal.totals.steps} steps · up to ${proposal.totals.files} files`;
  return `${proposal.totals.modules} modules · ${proposal.totals.steps} steps`;
}

function cloneProposal(proposal: LearningProposal) {
  return { ...proposal, focusAreas: [...(proposal.focusAreas ?? [])], outcomes: [...proposal.outcomes], items: proposal.items.map((item) => ({ ...item })), totals: { ...proposal.totals }, creditQuote: { ...proposal.creditQuote } };
}

function domainLabel(domainId: LearningBrief["domainId"]) {
  return {
    programming: "Programming",
    computer_fundamentals: "Computer & IT Fundamentals",
    internet_web: "Internet & Web Fundamentals",
    algorithms_data_structures: "Algorithms & Data Structures",
    math_for_programmers: "Math for Programmers"
  }[domainId ?? "programming"];
}

function createSetupMessageId() {
  return `setup-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createRequestKey(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomUUID()}`;
}
