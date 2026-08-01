export type HttpClientErrorInput = {
  status: number;
  code: string;
  message: string;
  correlationId?: string;
  details?: unknown;
  cause?: unknown;
};

export class HttpClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly correlationId?: string;
  readonly details?: unknown;

  constructor(input: HttpClientErrorInput) {
    super(input.message, { cause: input.cause });
    this.name = "HttpClientError";
    this.status = input.status;
    this.code = input.code;
    this.correlationId = input.correlationId;
    this.details = input.details;
  }

  get retryable() {
    return this.status === 0 || this.status >= 500;
  }

  toJSON() {
    return {
      name: this.name,
      status: this.status,
      code: this.code,
      message: this.message,
      correlationId: this.correlationId,
      details: this.details,
      retryable: this.retryable,
    };
  }
}

export function shouldRetryRequest(failureCount: number, error: unknown) {
  return failureCount < 1 && error instanceof HttpClientError && error.retryable;
}

export type JsonDecoder<T> = (body: unknown) => T;

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

type ParsedResponseBody = {
  body: unknown;
  parseError?: unknown;
};

async function parseResponseBody(response: Response): Promise<ParsedResponseBody> {
  if (response.status === 204) return { body: undefined };
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (!text) return { body: undefined };
  if (!contentType.includes("application/json")) return { body: text };

  try {
    return { body: JSON.parse(text) };
  } catch (parseError) {
    return { body: undefined, parseError };
  }
}

function responseError(
  response: Response,
  body: unknown,
  parseError?: unknown
) {
  const payload =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  return new HttpClientError({
    status: response.status,
    code: stringValue(payload.code) ?? `HTTP_${response.status}`,
    message:
      stringValue(payload.message) ??
      `Die Anfrage ist mit HTTP ${response.status} fehlgeschlagen.`,
    correlationId:
      stringValue(payload.correlationId) ??
      stringValue(response.headers.get("x-correlation-id")),
    details: payload.details,
    cause: parseError,
  });
}

export async function requestJson<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  decode: JsonDecoder<T>
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("accept")) headers.set("accept", "application/json");
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  try {
    const response = await fetch(input, {
      ...init,
      cache: "no-store",
      credentials: init.credentials ?? "same-origin",
      headers,
    });
    const { body, parseError } = await parseResponseBody(response);
    if (!response.ok) throw responseError(response, body, parseError);
    if (parseError) {
      throw new HttpClientError({
        status: response.status,
        code: "INVALID_JSON_RESPONSE",
        message: "Die Serverantwort enthielt ungültiges JSON.",
        correlationId: stringValue(response.headers.get("x-correlation-id")),
        cause: parseError,
      });
    }

    try {
      return decode(body);
    } catch (cause) {
      throw new HttpClientError({
        status: response.status,
        code: "INVALID_RESPONSE",
        message: "Die Serverantwort hatte nicht das erwartete Format.",
        correlationId: stringValue(response.headers.get("x-correlation-id")),
        cause,
      });
    }
  } catch (error) {
    if (error instanceof HttpClientError) throw error;
    if (init.signal?.aborted) throw init.signal.reason ?? error;
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new HttpClientError({
      status: 0,
      code: "NETWORK_ERROR",
      message: "Die Serververbindung konnte nicht hergestellt werden.",
      cause: error,
    });
  }
}
