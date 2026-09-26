// Gemini API 호출. API 키는 서버에서만 쓴다(브라우저로 보내지 않는다).
import "server-only";

// 앞 모델이 혼잡(503)·한도 초과(429)·시간 초과·잘못된 JSON이면 다음 모델로 시도한다.
// 기본 모델은 혼잡이 잦아서 잠깐 쉬었다가 한 번 더 부른다.
const MODELS = ["gemini-3.8-flash", "gemini-3.8-flash", "gemini-3.1-flash-lite"];
const RETRY_DELAY_MS = 1_500;
const TIMEOUT_MS = 60_000; // PDF를 읽으면 오래 걸릴 수 있다
const API = "https://generativelanguage.googleapis.com";

export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly rateLimited = false,
    public readonly retryable = false
  ) {
    super(message);
  }
}

export type GeminiFile = { uri: string; mimeType: string };

// 프롬프트(+첨부 파일)를 보내고 schema 모양의 JSON을 받는다. 모양 검사는 호출하는 쪽에서 한다.
export async function generateJson(
  prompt: string,
  schema: object,
  files: GeminiFile[] = []
): Promise<unknown> {
  const key = apiKey();
  const parts = [
    ...files.map((f) => ({ file_data: { mime_type: f.mimeType, file_uri: f.uri } })),
    { text: prompt },
  ];

  let lastError: unknown;
  for (const [i, model] of MODELS.entries()) {
    if (i > 0 && model === MODELS[i - 1]) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    try {
      return await callModel(model, key, parts, schema);
    } catch (e) {
      lastError = e;
      const retryable =
        (e instanceof GeminiError && e.retryable) ||
        e instanceof SyntaxError || // JSON 모양이 깨져서 옴
        (e instanceof DOMException && e.name === "TimeoutError");
      if (!retryable) throw e;
      console.warn(`Gemini ${model} failed, trying again:`, e instanceof Error ? e.message.slice(0, 200) : e);
    }
  }
  throw lastError;
}

// Gemini Files API에 파일을 올린다. 올린 파일은 48시간 동안 쓸 수 있다.
export async function uploadFile(bytes: ArrayBuffer, mimeType: string, displayName: string) {
  const key = apiKey();
  const start = await fetch(`${API}/upload/v1beta/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": key,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: displayName.slice(0, 100) } }),
  });
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!start.ok || !uploadUrl) {
    throw new GeminiError(`Gemini upload start ${start.status}: ${await start.text()}`);
  }

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" },
    body: bytes,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new GeminiError(`Gemini upload ${res.status}: ${await res.text()}`);
  let file = (await res.json()).file as { name: string; uri: string; state: string; expirationTime: string };

  // 큰 PDF는 잠깐 처리 중(PROCESSING)일 수 있다. 준비될 때까지 기다린다.
  for (let i = 0; file.state === "PROCESSING" && i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2_000));
    const check = await fetch(`${API}/v1beta/${file.name}`, { headers: { "x-goog-api-key": key } });
    file = await check.json();
  }
  if (file.state !== "ACTIVE") throw new GeminiError(`Gemini file not ready: ${file.state}`);
  return { uri: file.uri, expiresAt: file.expirationTime };
}

function apiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY가 없어요.");
  return key;
}

async function callModel(model: string, key: string, parts: object[], schema: object) {
  const res = await fetch(`${API}/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new GeminiError(
      `Gemini ${model} ${res.status}: ${await res.text()}`,
      res.status === 429,
      res.status === 429 || res.status >= 500
    );
  }

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new GeminiError(`Gemini 응답이 비었어요: ${JSON.stringify(data).slice(0, 300)}`, false, true);
  return JSON.parse(text);
}
