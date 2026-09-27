import { SatelliteDish, Signal } from "lucide-react";
import { josa } from "@/lib/game_new";
import { WeatherIcon } from "@/components/weather-icon_new";
import { futureMeForecast } from "@/lib/future-me-llm_new";

// "시험 날의 나" 예보 말풍선. 내 딱따구리 패널 맨 위에서 아래 딱따구리를 가리킨다.
export function ForecastBubble({ petName, children }: { petName: string; children: React.ReactNode }) {
  return (
    <div className="relative rounded-2xl bg-zinc-900 px-4 py-3 text-sm leading-relaxed text-white shadow-sm">
      <span className="mb-1 flex items-center gap-1 text-xs font-semibold tracking-wide text-zinc-400">
        <SatelliteDish className="size-3.5 shrink-0 text-brand-light" aria-hidden />
        시험 날의 나에게서 온 예보 · {josa(petName, "이", "가")} 전해요
      </span>
      {children}
      {/* 말풍선 꼬리: 아래 딱따구리를 가리킨다 */}
      <span className="absolute -bottom-2 left-8 h-4 w-4 rotate-45 bg-zinc-900" aria-hidden />
    </div>
  );
}

// Gemini가 쓴 멘트를 기다렸다가 보여 준다. Suspense로 감싸서 화면은 먼저 뜬다.
export async function FutureMeBubble({
  petName,
  ...input
}: { petName: string } & Parameters<typeof futureMeForecast>[0]) {
  const forecast = await futureMeForecast(input);
  if (!forecast) return null;
  return (
    <ForecastBubble petName={petName}>
      {/* 이미지는 과목 날씨(tone)로 고르고, 없으면 AI가 고른 이모지를 보여 준다 */}
      <WeatherIcon
        tone={input.weather.tone}
        emoji={forecast.weather}
        size={20}
        className="mr-1 align-[-0.25em]"
      />
      {forecast.message}
    </ForecastBubble>
  );
}

export function FutureMeLoading({ petName }: { petName: string }) {
  return (
    <ForecastBubble petName={petName}>
      <span className="inline-flex animate-pulse items-center gap-1 text-zinc-400">
        예보 수신 중…
        <Signal className="size-4 text-sky" aria-hidden />
      </span>
    </ForecastBubble>
  );
}
