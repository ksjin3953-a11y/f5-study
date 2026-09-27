// 중간고사·기말고사 보스.
// - 중간고사가 있는 과목: 앞에서부터 midterm_units개 단원이 중간 범위 → 아기 매(중간 보스)
//   아기 매를 잡거나 중간고사 날이 지나면 부모 매(기말 보스)가 온다. 부모 매 HP = 중간 이후 단원.
// - 중간고사가 없는 과목: 부모 매 하나, HP = 모든 단원.
// 날씨·계획·추천은 "지금 상대하는 보스"의 시험일과 단원으로 계산한다(examView).

import { daysUntil, isDone } from "@/lib/weather_new";

export const BOSSES = {
  mid: { exam: "중간고사", name: "아기 매", image: "/hawk-baby_new.png", width: 178, height: 230 },
  final: { exam: "기말고사", name: "매", image: "/hawk_new.png", width: 177, height: 274 },
} as const;

export type ExamKind = keyof typeof BOSSES;

type SubjectLike = { exam_date: string | null; midterm_date?: string | null; midterm_units?: number | null };
type UnitLike = { position?: number; status: string; completed_at: string | null; quiz_results?: { passed: boolean; created_at: string }[] };

export type ExamPhase<U> = {
  kind: ExamKind;
  date: string | null;
  daysLeft: number | null; // 시험일이 없으면 null
  units: U[];
  total: number;
  remaining: number;
  defeated: boolean; // 범위 단원을 모두 끝냄
  over: boolean; // 시험일이 지남
};

// 중간고사 범위 단원 수(0이면 중간고사 없음). 단원 수보다 크면 단원 수로 자른다.
export function midtermCount(subject: SubjectLike, unitCount: number) {
  const n = subject.midterm_units ?? 0;
  return Math.max(0, Math.min(n, unitCount));
}

function phase<U extends UnitLike>(kind: ExamKind, date: string | null, units: U[]): ExamPhase<U> {
  const daysLeft = date ? daysUntil(date) : null;
  const remaining = units.filter((u) => !isDone(u)).length;
  return {
    kind,
    date,
    daysLeft,
    units,
    total: units.length,
    remaining,
    defeated: units.length > 0 && remaining === 0,
    over: daysLeft !== null && daysLeft < 0,
  };
}

// 과목의 보스들. units는 position 순서로 정렬해서 넘기거나 position을 포함해야 한다.
export function examPhases<U extends UnitLike>(subject: SubjectLike, units: U[]) {
  const sorted = units.some((u) => u.position !== undefined)
    ? [...units].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    : units;
  const n = midtermCount(subject, sorted.length);
  const mid = n > 0 ? phase("mid", subject.midterm_date ?? null, sorted.slice(0, n)) : null;
  const final = phase("final", subject.exam_date, sorted.slice(n));
  // 아기 매가 살아 있고 중간고사 전이면 아기 매, 아니면 부모 매
  const current = mid && !mid.defeated && !mid.over ? mid : final;
  return { mid, final, current };
}

// 날씨·계획·추천 계산에 넘길 과목 모양: 지금 보스의 시험일과 범위 단원만.
// 중간 보스인데 중간고사 날짜가 없으면 기말 날짜를 쓴다.
export function examView<S extends SubjectLike & { units: U[] }, U extends UnitLike>(subject: S): S {
  const { current, final } = examPhases(subject, subject.units);
  return { ...subject, exam_date: current.date ?? final.date, units: current.units };
}
