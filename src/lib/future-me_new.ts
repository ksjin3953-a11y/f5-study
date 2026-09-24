// "시험 날의 나" 캐스터 멘트. 지금은 규칙 기반 기본 문구이고,
// 나중에 LLM이 같은 { weather, message } 형태로 대신 써 준다.
// 숫자는 날씨 계산 결과만 쓰고 여기서 새로 계산하지 않는다(하루 필요 단원 수만 나눗셈).

import type { Weather } from "@/lib/weather_new";

export type FutureMeMessage = { weather: string; message: string };

type Input = {
  subjectName: string;
  weather: Weather;
  nextUnitTitle: string | null; // 오늘의 추천 첫 단원
};

// 받침 유무로 조사를 고른다. 숫자로 끝나면 한국어 읽기(2 → 이)를 따른다.
function josa(word: string, withBatchim: string, withoutBatchim: string) {
  const last = word.trim().replace(/['"]+$/, "").slice(-1); // 따옴표는 건너뛴다
  const code = last.charCodeAt(0);
  let batchim: boolean;
  if (code >= 0xac00 && code <= 0xd7a3) batchim = (code - 0xac00) % 28 !== 0;
  else if (/[0-9]/.test(last)) batchim = "013678".includes(last);
  else batchim = false;
  return word + (batchim ? withBatchim : withoutBatchim);
}

// 같은 날에는 같은 문구, 날이 바뀌면 다른 문구가 나오게 고른다.
function pick<T>(options: T[], seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return options[h % options.length];
}

export function futureMeMessage({ subjectName, weather, nextUnitTitle }: Input): FutureMeMessage | null {
  const fc = weather.forecast;
  if (!fc) return null;

  const name = subjectName;
  const unit = nextUnitTitle ? `'${nextUnitTitle}'` : "다음 단원";
  const perDay = fc.daysLeft > 0 ? (fc.remaining / fc.daysLeft).toFixed(1) : null;
  const p = fc.projectedPercent;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const seed = today + name;

  let message: string;
  switch (weather.tone) {
    case "stormy":
      message = pick(
        [
          `지금 속도면 시험 날 ${name} 진도는 ${p}% 지점에서 멈춰요. ${josa(name, "이", "가")} 폭풍전야인데 당신만 몰라요, 오늘 ${unit} 하나만 끝내고 갑시다.`,
          `시험 날의 제가 전해요, 지금 속도면 ${josa(name, "은", "는")} ${p}%에서 시험지를 받아요. 제발 오늘 ${unit}부터요, 미래의 나는 이미 울고 있어요.`,
        ],
        seed
      );
      break;
    case "rainy":
      message = pick(
        [
          `지금 속도면 시험 날 ${name} 진도는 ${p}%, 우산 없이 시험장에 들어가는 각이에요. 오늘 ${unit}${perDay ? `부터, 하루 ${perDay}단원이면` : "만 끝내면"} 비가 그치기 시작해요.`,
          `예보 나갑니다, ${name} 시험 날 예상 진도 ${p}%로 흐리고 비. 오늘 ${unit} 끝내면 내일 예보가 달라져요, 믿어 봐요!`,
        ],
        seed
      );
      break;
    case "cloudy":
      message = pick(
        [
          `지금 속도면 시험 날 ${josa(name, "은", "는")} ${p}%까지 가요, 조금만 더 밀면 맑음이에요. ${perDay ? `하루 ${perDay}단원, ` : ""}오늘 ${josa(unit, "으로", "로")} 구름 걷어 봅시다!`,
          `${name} 시험 날 예상 진도 ${p}%, 구름 살짝 낀 날씨예요. 거의 다 왔어요, ${unit} 하나면 해가 보여요 ☀️`,
        ],
        seed
      );
      break;
    case "sunny":
      message = pick(
        [
          `이 속도면 ${josa(name, "은", "는")} 시험 날 ${p}% 완주 확정이에요. 이미 이긴 게임, 그냥 즐기면서 가세요 🔥`,
          `속보입니다, ${name} 시험 날 예상 진도 ${p}%로 전국이 맑음! 이 페이스 그대로면 시험장이 런웨이예요 ✨`,
        ],
        seed
      );
      break;
    default:
      // 관측 중: 완료한 단원이 없어 예보를 낼 수 없다.
      message = `${josa(name, "은", "는")} 아직 예보를 낼 데이터가 없어요. 첫 단원 ${unit} 하나만 끝내면 바로 시험 날 예보 들어갑니다!`;
  }

  return { weather: weather.icon, message };
}
