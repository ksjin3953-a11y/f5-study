// 게임 규칙: 공부하면 먹이를 받고, 먹이를 주면 딱따구리가 경험치를 얻어 레벨이 오른다.
// 받은 먹이는 단원·퀴즈·학습 기록에서 계산하고, 먹인 기록만 feedings 테이블에 저장한다.

import { isDone } from "@/lib/weather_new";

export const FOODS = {
  insect: { name: "곤충", image: "/food-insect_new.png", xp: 15, how: "단원 완료" },
  pinecone: { name: "솔방울", image: "/food-pinecone_new.png", xp: 15, how: "퀴즈 통과" },
  wood: { name: "나무 조각", image: "/food-wood_new.png", xp: 5, how: "학습 기록" },
} as const;

export type Food = keyof typeof FOODS;
export const FOOD_KEYS = Object.keys(FOODS) as Food[];

export const BOSS_BONUS_INSECTS = 3; // 보스(과목의 모든 단원)를 물리치면 곤충 보너스
export const STARTER_FOOD = 2; // 모든 사용자가 처음부터 먹이마다 이만큼 받는다

// 출석 보상: 출석한 날마다 나무 조각 1개, 누적 출석일이 5의 배수인 날은 1개 더
export const ATTENDANCE_BONUS_EVERY = 5;

export function attendanceReward(day: number) {
  return day % ATTENDANCE_BONUS_EVERY === 0 ? 2 : 1;
}

// 누적 출석일 N일까지 받은 나무 조각 합계
export function attendanceWood(days: number) {
  return days + Math.floor(days / ATTENDANCE_BONUS_EVERY);
}

type UnitLike = {
  status: string;
  completed_at: string | null;
  quiz_results?: { passed: boolean; created_at: string }[];
  study_logs?: unknown[];
};

export function isFood(value: unknown): value is Food {
  return typeof value === "string" && value in FOODS;
}

export function isBossDefeated(units: UnitLike[]) {
  return units.length > 0 && units.every(isDone);
}

// 지금까지 받은 먹이
export function earnedFood(
  subjects: { units: UnitLike[] }[],
  attendanceDays = 0
): Record<Food, number> {
  const earned = {
    insect: STARTER_FOOD,
    pinecone: STARTER_FOOD,
    wood: STARTER_FOOD + attendanceWood(attendanceDays),
  };
  for (const s of subjects) {
    for (const u of s.units) {
      if (u.status === "done") earned.insect++;
      earned.pinecone += u.quiz_results?.filter((q) => q.passed).length ?? 0;
      earned.wood += u.study_logs?.length ?? 0;
    }
    if (isBossDefeated(s.units)) earned.insect += BOSS_BONUS_INSECTS;
  }
  return earned;
}

// 가방 = 받은 먹이 − 먹인 먹이 (단원 완료를 취소하면 받은 수가 줄 수 있어 0 아래로는 내려가지 않게)
export function foodBag(earned: Record<Food, number>, fed: Record<Food, number>) {
  return Object.fromEntries(
    FOOD_KEYS.map((k) => [k, Math.max(0, earned[k] - fed[k])])
  ) as Record<Food, number>;
}

export function totalXp(fed: Record<Food, number>) {
  return FOOD_KEYS.reduce((sum, k) => sum + fed[k] * FOODS[k].xp, 0);
}

// 레벨마다 필요한 경험치가 20씩 늘어난다(30, 50, 70, ...).
export function levelFromXp(xp: number) {
  let level = 1;
  let need = 30;
  let rest = xp;
  while (rest >= need) {
    rest -= need;
    level++;
    need += 20;
  }
  return { level, current: rest, need };
}
