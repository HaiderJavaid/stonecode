import { buildTutorContext, TutorContextInput } from "@/ai/buildTutorContext";
import type { TutorPatchProposal } from "@/ai/tutorTools";
import { authenticatedFetch } from "@/services/authenticatedApi";

export type TutorStreamResult = {
  reply: string;
  tools: TutorPatchProposal[];
  toolErrors: string[];
};

export async function requestTutorReplyStream(
  input: TutorContextInput,
  handlers: {
    onDelta: (chunk: string) => void;
  }
): Promise<TutorStreamResult> {
  const response = await authenticatedFetch("/api/tutor", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      context: buildTutorContext(input)
    })
  }, "use the tutor");

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? "Tutor request failed.");
  }

  if (!response.body) {
    throw new Error("Tutor returned an empty response stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let reply = "";
  const tools: TutorPatchProposal[] = [];
  const toolErrors: string[] = [];
  const structured = response.headers.get("content-type")?.includes("text/event-stream") ?? false;
  let eventBuffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (!chunk) continue;
    if (!structured) {
      reply += chunk;
      handlers.onDelta(chunk);
      continue;
    }
    eventBuffer += chunk.replace(/\r\n/g, "\n");
    eventBuffer = consumeTutorEvents(eventBuffer, {
      onDelta(text) {
        reply += text;
        handlers.onDelta(text);
      },
      onTool(tool) {
        tools.push(tool);
      },
      onToolError(message) {
        toolErrors.push(message);
      }
    });
  }

  const tail = decoder.decode();
  if (structured) {
    eventBuffer += tail;
    consumeTutorEvents(`${eventBuffer}\n\n`, {
      onDelta(text) {
        reply += text;
        handlers.onDelta(text);
      },
      onTool(tool) { tools.push(tool); },
      onToolError(message) { toolErrors.push(message); }
    });
  } else {
    reply += tail;
  }
  if (!reply.trim() && !tools.length) {
    throw new Error("Tutor returned an empty reply.");
  }

  return { reply: reply.trim(), tools, toolErrors };
}

function consumeTutorEvents(buffer: string, handlers: {
  onDelta: (text: string) => void;
  onTool: (tool: TutorPatchProposal) => void;
  onToolError: (message: string) => void;
}) {
  while (true) {
    const boundary = buffer.indexOf("\n\n");
    if (boundary < 0) return buffer;
    const raw = buffer.slice(0, boundary);
    buffer = buffer.slice(boundary + 2);
    const lines = raw.split("\n");
    const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim() ?? "message";
    const dataText = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
    if (!dataText) continue;
    try {
      const data = JSON.parse(dataText);
      if (event === "delta" && typeof data.text === "string") handlers.onDelta(data.text);
      if (event === "tool" && data.tool?.version === "tutor-patch/v1") handlers.onTool(data.tool as TutorPatchProposal);
      if (event === "tool_error" && typeof data.message === "string") handlers.onToolError(data.message);
    } catch {
      // Ignore malformed stream frames; the server emits a final status event.
    }
  }
}
