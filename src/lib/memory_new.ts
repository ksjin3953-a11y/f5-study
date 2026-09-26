// 망각 곡선: 끝낸 단원도 시간이 지나면 기억이 옅어진다.
// 기억도 = 100 × 0.5^(마지막으로 다진 뒤 지난 일수 ÷ 반감기)
// - 다지기: 단원 완료, 퀴즈 통과, 학습 기록 중 가장 최근 시각
// - 반감기: 3일에서 시작해 퀴즈를 통과할 때마다 두 배(3 → 6 → 12 → 24일…)
// 진도율·날씨·보스 HP에는 영향을 주지 않고, 기억도가 절반 아래면 복습을 추천한다.

import { isDone } from "@/lib/weather_new";

const DAY = 86_400_000;
export const BASE_HALF_LIFE_DAYS = 3;
const MAX_HALF_LIFE_DAYS = 60;
export const REVIEW_BELOW_PERCENT = 50; // 기억도가 이 아래면 복습할 때

type UnitLike = {
  status: string;
  completed_at: string | null;
  quiz_results?: { passed: boolean; created_at: string }[];
  study_logs?: { studied_at?: string }[];
};

// 통과한 퀴즈 수만큼 반감기가 두 배가 된다.
export function halfLifeDays(unit: UnitLike) {
  const passes = unit.quiz_results?.filter((q) => q.passed).length ?? 0;
  return Math.min(MAX_HALF_LIFE_DAYS, BASE_HALF_LIFE_DAYS * 2 ** passes);
}

// 마지막으로 기억을 다진 시각(완료·퀴즈 통과·학습 기록)
export function lastReinforcedAt(unit: UnitLike) {
  const times = [
    unit.completed_at,
    ...(unit.quiz_results ?? []).filter((q) => q.passed).map((q) => q.created_at),
    ...(unit.study_logs ?? []).map((l) => l.studied_at),
  ].filter((t): t is string => !!t);
  if (times.length === 0) return null;
  return times.reduce((a, b) => (Date.parse(a) > Date.parse(b) ? a : b));
}

// 끝낸 단원의 기억도. 끝내지 않은 단원은 null.
export function memoryOf(unit: UnitLike, now = Date.now()) {
  if (!isDone(unit)) return null;
  const last = lastReinforcedAt(unit);
  if (!last) return null;
  const halfLife = halfLifeDays(unit);
  const days = Math.max(0, (now - Date.parse(last)) / DAY);
  const percent = Math.round(100 * 0.5 ** (days / halfLife));
  // 기억도가 50%가 되는 날 = 마지막으로 다진 날 + 반감기
  const reviewAt = new Date(Date.parse(last) + halfLife * DAY).toISOString();
  return { percent, halfLife, reviewAt, fading: percent < REVIEW_BELOW_PERCENT };
}

// 끝냈지만 기억이 옅어져 복습할 때가 된 단원
export function isFading(unit: UnitLike) {
  return memoryOf(unit)?.fading ?? false;
}
