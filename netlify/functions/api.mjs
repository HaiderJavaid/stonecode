import { Readable } from "node:stream";
import { handleStonecodeApiRequest } from "../../server/stonecode-server.mjs";

export const config = {
  path: "/api/*"
};

export async function handler(event) {
  const request = createNodeLikeRequest(event);
  const response = createBufferedResponse();

  const handled = await handleStonecodeApiRequest(request, response);
  if (!handled) {
    response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "Unknown API route." }));
  }

  return response.toNetlifyResponse();
}

function createNodeLikeRequest(event) {
  const body = event.body
    ? Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8")
    : Buffer.alloc(0);
  const request = Readable.from(body.length ? [body] : []);
  request.method = event.httpMethod;
  request.url = readPathAndSearch(event);
  request.headers = normalizeHeaders(event.headers ?? {});
  return request;
}

function readPathAndSearch(event) {
  if (event.rawUrl) {
    const url = new URL(event.rawUrl);
    return `${url.pathname}${url.search}`;
  }
  return `${event.path ?? "/"}${event.rawQuery ? `?${event.rawQuery}` : ""}`;
}

function normalizeHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );
}

function createBufferedResponse() {
  let statusCode = 200;
  const headers = {};
  const chunks = [];
  let ended = false;

  return {
    writeHead(status, nextHeaders = {}) {
      statusCode = status;
      Object.assign(headers, nextHeaders);
    },
    setHeader(name, value) {
      headers[name] = value;
    },
    write(chunk) {
      if (chunk !== undefined && chunk !== null) chunks.push(Buffer.from(chunk));
    },
    end(chunk) {
      if (ended) return;
      if (chunk !== undefined && chunk !== null) chunks.push(Buffer.from(chunk));
      ended = true;
    },
    toNetlifyResponse() {
      const body = Buffer.concat(chunks).toString("utf8");
      return {
        statusCode,
        headers,
        body
      };
    }
  };
}
