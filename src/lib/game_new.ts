// 게임 규칙: 공부하면 먹이를 받고, 먹이를 주면 딱따구리가 경험치를 얻어 레벨이 오른다.
// 받은 먹이는 단원·퀴즈·학습 기록에서 계산하고, 먹인 기록만 feedings 테이블에 저장한다.

import { isDone } from "@/lib/weather_new";

export const FOODS = {
  insect: { name: "곤충", image: "/food-insect_new.png", xp: 20, how: "단원 완료" },
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

// 마지막으로 공부한 시각(학습 기록·퀴즈·단원 완료 중 가장 최근). 매 도발 타이머의 기준이다.
export function lastStudyAt(
  units: {
    completed_at: string | null;
    quiz_results?: { created_at: string }[];
    study_logs?: { studied_at?: string }[];
  }[]
) {
  let latest: string | null = null;
  const see = (t: string | null | undefined) => {
    if (t && (!latest || Date.parse(t) > Date.parse(latest))) latest = t;
  };
  for (const u of units) {
    see(u.completed_at);
    u.quiz_results?.forEach((q) => see(q.created_at));
    u.study_logs?.forEach((l) => see(l.studied_at));
  }
  return latest;
}

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

export const DEFAULT_PET_NAME = "딱따구리";
export const PET_NAME_MAX = 10;

// 로그인 계정에 저장한 딱따구리 이름. 없으면 기본 이름.
export function petNameOf(user: { user_metadata?: Record<string, unknown> } | null) {
  const name = user?.user_metadata?.pet_name;
  return typeof name === "string" && name.trim() ? name.trim() : DEFAULT_PET_NAME;
}

// 받침 유무로 조사를 고른다. 숫자로 끝나면 한국어 읽기(2 → 이)를 따른다.
export function josa(word: string, withBatchim: string, withoutBatchim: string) {
  const last = word.trim().replace(/['"]+$/, "").slice(-1); // 따옴표는 건너뛴다
  const code = last.charCodeAt(0);
  let batchim: boolean;
  if (code >= 0xac00 && code <= 0xd7a3) batchim = (code - 0xac00) % 28 !== 0;
  else if (/[0-9]/.test(last)) batchim = "013678".includes(last);
  else batchim = false;
  return word + (batchim ? withBatchim : withoutBatchim);
}

// 성장 단계: 레벨이 오르면 알 → 아기 → 어른 딱따구리로 자란다.
// height는 패널에서 보여 줄 키(px). 이미지 비율은 파일 크기를 따른다.
export const STAGES = [
  { minLevel: 1, name: "알", image: "/mascot-egg_new.png", width: 140, height: 180, show: 76, grown: "" },
  { minLevel: 3, name: "아기", image: "/mascot-baby_new.png", width: 179, height: 255, show: 96, grown: "부화했어요!" },
  { minLevel: 6, name: "어른", image: "/mascot_new.png", width: 173, height: 257, show: 104, grown: "다 컸어요!" },
] as const;

export type Stage = (typeof STAGES)[number];

export function stageForLevel(level: number): Stage {
  return STAGES.findLast((s) => level >= s.minLevel) ?? STAGES[0];
}

export function nextStage(level: number): Stage | null {
  return STAGES.find((s) => s.minLevel > level) ?? null;
}

// 레벨마다 필요한 경험치가 30씩 늘어난다(50, 80, 110, ...).
export function levelFromXp(xp: number) {
  let level = 1;
  let need = 50;
  let rest = xp;
  while (rest >= need) {
    rest -= need;
    level++;
    need += 30;
  }
  return { level, current: rest, need };
}
