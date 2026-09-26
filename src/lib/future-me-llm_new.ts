// "시험 날의 나" 캐스터 멘트를 Gemini로 만든다. 서버에서만 쓴다.
// 숫자는 날씨 계산 결과를 그대로 넘기고, 모델은 문장만 쓴다.
// 같은 날·같은 상황이면 만든 멘트를 다시 쓰고(캐시), 실패하면 규칙 기반 문구로 대신한다.
import "server-only";
import { unstable_cache } from "next/cache";
import { generateJson } from "@/lib/gemini_new";
import { futureMeMessage, type FutureMeMessage } from "@/lib/future-me_new";
import { todayInSeoul, type Weather } from "@/lib/weather_new";

const SYSTEM = `너는 텐션 높은 날씨 캐스터야 (듀오링고 부엉이가 뉴스 진행하는 느낌).
"시험 날의 나"라는 컨셉으로, 계산된 예상 진도·날씨·남은 일수 데이터를 보고 1~2문장짜리 캐스터 멘트를 써.
숫자는 절대 새로 계산하거나 추측하지 말고 주어진 데이터에 있는 숫자만 그대로 써.
첫 문장은 반드시 "지금 상태가 뭔지 + 시험 날 어떻게 되는지"를 농담 없이 명확하게 전달하고, 두 번째 문장에서 오늘 할 행동 하나(오늘_추천_단원)를 캐스터 톤으로 권해.
등급 나쁠수록 죄책감 살짝 자극(가스라이팅 아님, 애정어린 잔소리), 좋을수록 과하게 칭찬.
시험날_예상_진도_퍼센트가 null이면 아직 예보를 낼 수 없다는 것과, 첫 단원을 끝내면 예보가 시작된다는 걸 전해.
해요체로, 전체 120자 안쪽으로 써.
반드시 JSON으로만 답해.

출력 예시 (나쁨)
{ "weather": "⛈️", "message": "지금 속도면 시험 날 진도 62% 지점에서 멈춰요. 자료구조가 폭풍전야인데 당신만 몰라요, 오늘 2단원 하나만 끝내고 갑시다." }

출력 예시 (좋음)
{ "weather": "☀️", "message": "이 속도면 시험 날 100% 완주 확정이에요. 이미 이긴 게임, 그냥 즐기면서 가세요 🔥" }`;

const SCHEMA = {
  type: "OBJECT",
  properties: { weather: { type: "STRING" }, message: { type: "STRING" } },
  required: ["weather", "message"],
};

const GRADE: Record<Weather["tone"], string> = {
  sunny: "맑음 (여유, 아주 좋음)",
  cloudy: "구름 (주의, 조금 부족)",
  rainy: "비 (위험, 많이 부족)",
  stormy: "폭풍 (매우 위험)",
  none: "관측 중 (아직 예측 불가)",
};

type Facts = Record<string, string | number | null>;

// 같은 날짜·같은 데이터면 캐시된 멘트를 쓴다. 실패는 캐시하지 않도록 던진다.
const askGemini = unstable_cache(
  async (facts: Facts, day: string) => {
    void day; // 캐시 키에만 쓴다(날이 바뀌면 새 멘트)
    const data = (await generateJson(JSON.stringify(facts, null, 1), SCHEMA, [], SYSTEM)) as {
      message?: unknown;
    };
    const message = typeof data.message === "string" ? data.message.trim() : "";
    if (!message || message.length > 200) throw new Error(`bad future-me message: ${JSON.stringify(data)}`);
    return message;
  },
  ["future-me-v1"],
  { revalidate: 60 * 60 * 24 }
);

export async function futureMeForecast(input: {
  subjectName: string;
  weather: Weather;
  nextUnitTitle: string | null;
  daysSinceStudy: number | null; // 공부 기록이 없으면 null
}): Promise<FutureMeMessage | null> {
  const fallback = futureMeMessage(input);
  const fc = input.weather.forecast;
  if (!fallback || !fc) return fallback;

  const facts: Facts = {
    과목: input.subjectName,
    날씨: `${input.weather.icon} ${input.weather.label}`,
    등급: GRADE[input.weather.tone],
    시험까지_남은_일수: fc.daysLeft,
    남은_단원_수: fc.remaining,
    시험날_예상_진도_퍼센트: fc.projectedPercent,
    하루_필요_단원_수: fc.daysLeft > 0 ? (fc.remaining / fc.daysLeft).toFixed(1) : null,
    오늘_추천_단원: input.nextUnitTitle,
    마지막_공부_후_지난_일수: input.daysSinceStudy,
  };

  try {
    const message = await askGemini(facts, todayInSeoul());
    // 날씨 아이콘은 모델이 고르지 않고 계산 결과를 쓴다.
    return { weather: input.weather.icon, message };
  } catch (e) {
    console.error("futureMeForecast fell back to rule-based:", e);
    return fallback;
  }
}
