import { FormEvent, useEffect, useMemo, useState } from "react";
import { Course, createLearningCourse } from "@/data/courses";

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
  isOpen,
  onCancel,
  onFinalize
}: {
  isOpen: boolean;
  onCancel: () => void;
  onFinalize: (course: Course) => void;
}) {
  const [messages, setMessages] = useState<SetupMessage[]>([
    {
      role: "assistant",
      content: "What do you want to learn today?"
    }
  ]);
  const [typingMessageIndex, setTypingMessageIndex] = useState(0);
  const [typedContent, setTypedContent] = useState("");
  const [suggestionsReady, setSuggestionsReady] = useState(false);
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const plan = useMemo(() => createDraftPlan(latestUserMessage), [latestUserMessage]);
  const typingMessage = messages[typingMessageIndex];

  useEffect(() => {
    const lastAssistantIndex = messages.map((message) => message.role).lastIndexOf("assistant");
    if (lastAssistantIndex >= 0) setTypingMessageIndex(lastAssistantIndex);
  }, [messages]);

  useEffect(() => {
    if (!typingMessage || typingMessage.role !== "assistant") return;
    setTypedContent("");
    setSuggestionsReady(false);
    let index = 0;
    let interval = 0;
    const delay = window.setTimeout(() => {
      const step = Math.max(1, Math.ceil(typingMessage.content.length / 120));
      interval = window.setInterval(() => {
        index = Math.min(index + step, typingMessage.content.length);
        setTypedContent(typingMessage.content.slice(0, index));
        if (index >= typingMessage.content.length) {
          window.clearInterval(interval);
          window.setTimeout(() => setSuggestionsReady(true), 360);
        }
      }, 18);
    }, 520);

    return () => {
      window.clearTimeout(delay);
      window.clearInterval(interval);
    };
  }, [typingMessage]);

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const message = String(formData.get("message") ?? "").trim();
    if (!message) return;

    setMessages((current) => [
      ...current,
      { role: "user", content: message },
      {
        role: "assistant",
        content: createFollowUp(message)
      }
    ]);
    form.reset();
  }

  function useFavorite(idea: string) {
    setMessages((current) => [
      ...current,
      { role: "user", content: idea },
      {
        role: "assistant",
        content: createFollowUp(idea)
      }
    ]);
  }

  function finalizeCourse() {
    const course = createLearningCourse({
      title: plan.title,
      subject: plan.subject,
      description: plan.description
    });
    onFinalize(course);
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
          <div className="ai-chat-scroll setup-chat" aria-label="Course setup conversation">
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
          </div>
          <div className="chat-dock">
            <section className={`reply-suggestions setup-favorites${suggestionsReady ? " is-ready" : ""}`} aria-label="Course suggestions">
              {favoriteIdeas.map((idea) => (
                <button key={idea} onClick={() => useFavorite(idea)} type="button">
                  {idea}
                </button>
              ))}
            </section>
            <form className="chat-compose setup-compose" onSubmit={submitMessage}>
              <input name="message" placeholder="I want to learn..." type="text" />
              <button type="submit">Send</button>
            </form>
            <div className="lesson-controls setup-controls">
              <button disabled={!latestUserMessage} onClick={finalizeCourse} type="button">
                Finalize
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function createFollowUp(message: string) {
  return `Good. I can set up a beginner course for "${message}". Tell me your goal, current level, or the kind of project you want, then finalize when it feels right.`;
}

function createDraftPlan(message: string): {
  title: string;
  subject: string;
  description: string;
} {
  const normalized = message.trim() || "Programming basics";
  const title = normalized.length > 34 ? normalized.slice(0, 34).trim() : normalized;
  const subject = inferSubject(normalized);
  const description = `A beginner-friendly path for ${normalized}, with notes, exercises, and a first practice file.`;

  return {
    title,
    subject,
    description
  };
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
