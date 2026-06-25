import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Course, createDefaultCourseMetadata, createLearningCourse } from "@/data/courses";
import { useTypedText } from "@/hooks/useTypedText";

const favoriteIdeas = [
  "JavaScript fundamentals",
  "Build a portfolio website",
  "React from zero",
  "Data structures basics",
  "Python automation",
  "Interview problem solving"
];

type SetupMessage = {
  role: "assistant" | "user";
  content: string;
};

export function CourseSetupCard({
  error,
  isOpen,
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
  const [messages, setMessages] = useState<SetupMessage[]>([
    {
      role: "assistant",
      content: "What do you want to learn today?"
    }
  ]);
  const [typingMessageIndex, setTypingMessageIndex] = useState(0);
  const [suggestionsReady, setSuggestionsReady] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const proposalRef = useRef<HTMLElement | null>(null);
  const userMessages = messages.filter((message) => message.role === "user").map((message) => message.content);
  const plan = useMemo(() => createDraftPlan(userMessages), [userMessages]);
  const planReady = userMessages.length >= 3;
  const typingMessage = messages[typingMessageIndex];
  const typingText = typingMessage?.role === "assistant" ? typingMessage.content : "";
  const { typedText: typedContent } = useTypedText(typingText, {
    enabled: Boolean(typingText)
  });

  useEffect(() => {
    const lastAssistantIndex = messages.map((message) => message.role).lastIndexOf("assistant");
    if (lastAssistantIndex >= 0) setTypingMessageIndex(lastAssistantIndex);
  }, [messages]);

  useEffect(() => {
    setSuggestionsReady(false);
  }, [typingMessage]);

  useEffect(() => {
    if (!typingText || typedContent.length < typingText.length) return;
    const timer = window.setTimeout(() => setSuggestionsReady(true), 360);
    return () => window.clearTimeout(timer);
  }, [typedContent.length, typingText]);

  useEffect(() => {
    const scrollElement = chatScrollRef.current;
    if (!scrollElement) return;
    scrollElement.scrollTop = planReady && proposalRef.current
      ? Math.max(proposalRef.current.offsetTop - scrollElement.offsetTop - 8, 0)
      : scrollElement.scrollHeight;
  }, [messages, planReady, typedContent]);

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const message = String(formData.get("message") ?? "").trim();
    if (!message) return;

    addAnswer(message);
    form.reset();
  }

  function useFavorite(idea: string) {
    addAnswer(idea);
  }

  function addAnswer(answer: string) {
    setMessages((current) => [
      ...current,
      { role: "user", content: answer },
      {
        role: "assistant",
        content: createFollowUp(current.filter((message) => message.role === "user").length + 1, answer)
      }
    ]);
  }

  async function finalizeCourse() {
    const course = createLearningCourse({
      title: plan.title,
      subject: plan.subject,
      description: plan.description,
      languages: plan.languages,
      tags: plan.tags,
      syllabus: plan.syllabus
    });
    await onFinalize(course);
  }

  return (
    <article className="course-setup-card shadow-card is-active has-chat-canvas" aria-label="Course setup" style={{ "--card-y": "0px" } as React.CSSProperties}>
      <div className="card-top">
        <h2>New course</h2>
        <button className="card-back" onClick={onCancel} type="button">Close</button>
      </div>
      <div className="selection-panel is-chat-canvas setup-selection-panel">
        <button className="selection-back" onClick={onCancel} type="button">
          Back
        </button>
        <div className="lesson-panel ai-chat-panel">
          <div className="chat-canvas-head">
            <span>Setup</span>
            <strong>What do you want to learn today?</strong>
          </div>
          <div className="ai-chat-scroll setup-chat" aria-label="Course setup conversation" ref={chatScrollRef}>
            {messages.map((message, index) => (
              <div
                className={`ai-message ${message.role === "assistant" ? "assistant-message ai-response" : "user-message"}`}
                key={`${message.role}-${index}-${message.content}`}
              >
                <p>{message.role === "assistant" && index === typingMessageIndex ? typedContent : message.content}</p>
                {message.role === "assistant" && index === typingMessageIndex && typedContent.length < message.content.length && (
                  <span className="typing-caret" />
                )}
              </div>
            ))}
            {planReady && (
              <section className="course-proposal" aria-label="Proposed course plan" ref={proposalRef}>
                <span>Proposed course</span>
                <h3>{plan.title}</h3>
                <p>{plan.description}</p>
                <div className="proposal-tags">
                  {[...plan.languages, ...plan.tags].map((tag) => <i key={tag}>{tag}</i>)}
                </div>
                <ol>
                  {plan.syllabus.map((section) => <li key={section.id}>{section.title}</li>)}
                </ol>
              </section>
            )}
          </div>
          <div className="chat-dock">
            <section className={`reply-suggestions setup-favorites${suggestionsReady ? " is-ready" : ""}`} aria-label="Course suggestions">
              {getSuggestions(userMessages.length).map((idea) => (
                <button key={idea} onClick={() => useFavorite(idea)} type="button">
                  {idea}
                </button>
              ))}
            </section>
            <form className="chat-compose setup-compose" onSubmit={submitMessage}>
              <input name="message" placeholder={getInputPlaceholder(userMessages.length)} type="text" />
              <button type="submit">Send</button>
            </form>
            <div className="lesson-controls setup-controls">
              {error && <p className="setup-error">{error}</p>}
              <button disabled={!planReady || isFinalizing} onClick={finalizeCourse} type="button">
                {isFinalizing ? "Finalizing..." : "Finalize"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function createFollowUp(answerNumber: number, answer: string) {
  if (answerNumber === 1) {
    return `I’ll build the course around "${answer}". What is your current level with programming and this topic?`;
  }
  if (answerNumber === 2) {
    return "What practical outcome do you want: a project, job skill, interview preparation, automation, or something else?";
  }
  if (answerNumber === 3) {
    return "Here is the proposed course. You can Finalize it now, or keep chatting to change the focus, languages, or syllabus.";
  }
  return `I’ve added "${answer}" as an amendment to the proposal. Review it below or keep refining it.`;
}

function createDraftPlan(messages: string[]): Pick<Course, "title" | "subject" | "description" | "languages" | "tags" | "syllabus"> {
  const [objective = "Programming basics", level = "Beginner", outcome = "Build practical projects", ...amendments] = messages;
  const normalized = objective.trim() || "Programming basics";
  const title = normalized.length > 34 ? normalized.slice(0, 34).trim() : normalized;
  const subject = inferSubject(normalized);
  const metadata = createDefaultCourseMetadata(subject);
  const amendmentCopy = amendments.length ? ` Updated focus: ${amendments.at(-1)}.` : "";
  const description = `${level} path for ${normalized}, aimed at ${outcome}.${amendmentCopy}`;

  return {
    title,
    subject,
    description,
    ...metadata
  };
}

function getSuggestions(answerCount: number) {
  if (answerCount === 0) return favoriteIdeas;
  if (answerCount === 1) return ["Complete beginner", "Know the basics", "Built small projects"];
  if (answerCount === 2) return ["Build a real project", "Prepare for a job", "Solve practical problems"];
  return ["Use more projects", "Add debugging practice", "Change the language"];
}

function getInputPlaceholder(answerCount: number) {
  if (answerCount === 0) return "I want to learn...";
  if (answerCount === 1) return "My current level is...";
  if (answerCount === 2) return "I want to be able to...";
  return "Amend the proposed course...";
}

function inferSubject(message: string) {
  const value = message.toLowerCase();
  if (value.includes("react")) return "React";
  if (value.includes("python")) return "Python";
  if (value.includes("interview") || value.includes("data structure")) return "Computer Science";
  if (value.includes("website") || value.includes("portfolio")) return "Web Development";
  if (value.includes("javascript") || value.includes("js")) return "JavaScript";
  return "Programming";
}
