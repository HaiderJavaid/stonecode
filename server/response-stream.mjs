export function createSseEventParser(onEvent) {
  let buffer = "";

  return {
    push(chunk) {
      buffer += chunk;
      buffer = buffer.replace(/\r\n/g, "\n");

      while (true) {
        const boundaryIndex = buffer.indexOf("\n\n");
        if (boundaryIndex === -1) break;

        const rawEvent = buffer.slice(0, boundaryIndex);
        buffer = buffer.slice(boundaryIndex + 2);

        const event = parseSseEvent(rawEvent);
        if (event) onEvent(event);
      }
    }
  };
}

function parseSseEvent(rawEvent) {
  const lines = rawEvent.split(/\r?\n/);
  let eventName = "message";
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  }

  if (!dataLines.length) return null;
  const dataText = dataLines.join("\n");
  if (dataText === "[DONE]") return { event: eventName, data: "[DONE]" };

  try {
    return {
      event: eventName,
      data: JSON.parse(dataText)
    };
  } catch {
    return null;
  }
}
