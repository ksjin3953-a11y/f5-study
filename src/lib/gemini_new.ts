// Gemini API 호출. API 키는 서버에서만 쓴다(브라우저로 보내지 않는다).
import "server-only";

// 앞 모델이 혼잡(503)·한도 초과(429)·시간 초과면 다음 모델로 한 번 더 시도한다.
const MODELS = ["gemini-3.8-flash", "gemini-3.1-flash-lite"];
const TIMEOUT_MS = 25_000;

export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly rateLimited = false,
    public readonly retryable = false
  ) {
    super(message);
  }
}

// 프롬프트를 보내고 schema 모양의 JSON을 받는다. 모양 검사는 호출하는 쪽에서 한다.
export async function generateJson(prompt: string, schema: object): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY가 없어요.");

  let lastError: unknown;
  for (const model of MODELS) {
    try {
      return await callModel(model, key, prompt, schema);
    } catch (e) {
      lastError = e;
      const retryable =
        (e instanceof GeminiError && e.retryable) ||
        (e instanceof DOMException && e.name === "TimeoutError");
      if (!retryable) throw e;
      console.warn(`Gemini ${model} failed, trying next model:`, e);
    }
  }
  throw lastError;
}

async function callModel(model: string, key: string, prompt: string, schema: object) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }
  );
  if (!res.ok) {
    throw new GeminiError(
      `Gemini ${model} ${res.status}: ${await res.text()}`,
      res.status === 429,
      res.status === 429 || res.status >= 500
    );
  }

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new GeminiError(`Gemini 응답이 비었어요: ${JSON.stringify(data).slice(0, 300)}`);
  return JSON.parse(text);
}
