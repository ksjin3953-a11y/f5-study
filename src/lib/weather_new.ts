// 학습 날씨: 지금 속도로 공부하면 시험 날까지 단원을 얼마나 끝낼 수 있는지로 정한다.

const DAY = 86_400_000;
const PACE_WINDOW_DAYS = 14; // 최근 이 기간의 완료 속도로 예측한다.
export const QUIZ_PASS_RATIO = 0.6; // 퀴즈 통과 기준 (5문제 중 3개)

export type Weather = {
  icon: string;
  label: string;
  detail: string;
  tone: "sunny" | "cloudy" | "rainy" | "stormy" | "none";
  risk: number; // 클수록 위험. 대시보드 정렬에 쓴다.
  // 시험 전 예보가 가능할 때만 채운다("시험 날의 나" 메시지에 쓴다).
  forecast?: { daysLeft: number; remaining: number; projectedPercent: number | null };
};

type QuizLike = { passed: boolean; created_at: string };
type UnitLike = { status: string; completed_at: string | null; quiz_results?: QuizLike[] };

// 완료했지만 가장 최근 퀴즈를 통과하지 못한 단원은 복습이 필요하다.
export function needsReview(unit: UnitLike) {
  if (unit.status !== "done" || !unit.quiz_results?.length) return false;
  const latest = unit.quiz_results.reduce((a, b) => (a.created_at > b.created_at ? a : b));
  return !latest.passed;
}

// 진도·날씨 계산에서 끝난 것으로 치는 단원
export function isDone(unit: UnitLike) {
  return unit.status === "done" && !needsReview(unit);
}

// 오늘(한국 시간) 날짜를 YYYY-MM-DD로
export function todayInSeoul() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

// 오늘부터 시험일까지 남은 날 수
export function daysUntil(examDate: string) {
  return Math.round((Date.parse(examDate) - Date.parse(todayInSeoul())) / DAY);
}

export function dDayLabel(days: number) {
  if (days > 0) return `D-${days}`;
  if (days === 0) return "D-Day";
  return "시험 끝";
}

export function studyWeather(subject: {
  exam_date: string | null;
  created_at: string;
  units: UnitLike[];
}): Weather {
  const total = subject.units.length;
  const done = subject.units.filter(isDone).length;
  const remaining = total - done;

  if (total === 0) {
    return { icon: "📋", label: "단원 없음", detail: "단원을 추가하면 날씨를 알려드려요.", tone: "none", risk: 1 };
  }
  if (remaining === 0) {
    return { icon: "☀️", label: "맑음", detail: "모든 단원을 끝냈어요!", tone: "sunny", risk: 2 };
  }
  if (!subject.exam_date) {
    return { icon: "📅", label: "시험일 미정", detail: "시험일을 정하면 날씨를 알려드려요.", tone: "none", risk: 1 };
  }

  const daysLeft = daysUntil(subject.exam_date);
  if (daysLeft < 0) {
    return { icon: "🏁", label: "시험 끝", detail: `${done}/${total} 단원을 끝냈어요.`, tone: "none", risk: 0 };
  }

  const need =
    daysLeft === 0
      ? `오늘이 시험일이에요. 남은 ${remaining}단원을 훑어보세요.`
      : `하루 ${(remaining / daysLeft).toFixed(1)}단원씩 하면 다 끝내요.`;

  // 최근 완료 속도(단원/일). 과목을 만든 지 얼마 안 됐으면 그 기간으로 나눈다.
  const now = Date.now();
  const window = Math.min(
    PACE_WINDOW_DAYS,
    Math.max(1, Math.ceil((now - Date.parse(subject.created_at)) / DAY))
  );
  const recentDone = subject.units.filter(
    (u) => isDone(u) && u.completed_at && now - Date.parse(u.completed_at) <= window * DAY
  ).length;

  if (done === 0 && recentDone === 0) {
    return {
      icon: "🌫️",
      label: "관측 중",
      detail: `첫 단원을 끝내면 예보가 시작돼요. ${need}`,
      tone: "none",
      risk: 3,
      forecast: { daysLeft, remaining, projectedPercent: null },
    };
  }

  const pace = recentDone / window;
  const projected = Math.min(total, done + pace * daysLeft);
  const ratio = projected / total;
  const reviews = subject.units.filter(needsReview).length;
  const fc = { daysLeft, remaining, projectedPercent: Math.round(ratio * 100) };
  const forecast =
    `지금 속도면 시험 날까지 ${Math.floor(projected)}/${total} 단원(${Math.round(ratio * 100)}%).` +
    (reviews > 0 ? ` 복습 필요 ${reviews}단원.` : "");

  if (ratio >= 1) return { icon: "☀️", label: "맑음", detail: `${forecast} 이대로만 가요!`, tone: "sunny", risk: 2, forecast: fc };
  if (ratio >= 0.8) return { icon: "⛅", label: "구름", detail: `${forecast} ${need}`, tone: "cloudy", risk: 4, forecast: fc };
  if (ratio >= 0.5) return { icon: "🌧️", label: "비", detail: `${forecast} ${need}`, tone: "rainy", risk: 5, forecast: fc };
  return { icon: "⛈️", label: "폭풍", detail: `${forecast} ${need}`, tone: "stormy", risk: 6, forecast: fc };
}

// 대시보드 맨 위 전체 날씨: 가장 위험한 과목의 날씨를 대표로 하고, 과목별 날씨 개수를 함께 보여 준다.
export function overallWeather(subjects: { name: string; weather: Weather }[]) {
  const worst = [...subjects].sort((a, b) => b.weather.risk - a.weather.risk)[0];
  if (!worst) return null;

  const counts = new Map<string, number>();
  for (const s of subjects) counts.set(s.weather.icon, (counts.get(s.weather.icon) ?? 0) + 1);
  const summary = [...counts].map(([icon, n]) => `${icon}${n}`).join(" · ");

  const name = worst.name;
  const message: Record<Weather["tone"], string> = {
    stormy: `⛈️ 폭풍 경보! ${name} 쪽이 제일 험해요. 오늘은 ${name}부터 챙겨요.`,
    rainy: `🌧️ 비 소식이 있어요. ${name}부터 우산 챙기듯 공부해 두면 금방 개요.`,
    cloudy: `⛅ 대체로 구름이에요. ${name}만 조금 더 밀면 전부 맑아져요.`,
    sunny: "☀️ 전 과목 맑음! 이 페이스 그대로만 가요.",
    none: worst.weather.forecast
      ? "🌫️ 아직 관측 중이에요. 단원을 하나 끝내면 예보가 시작돼요."
      : `${worst.weather.icon} ${worst.weather.detail}`,
  };
  return { tone: worst.weather.tone, message: message[worst.weather.tone], summary };
}
