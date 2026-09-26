// 공부 캘린더: 과목마다 남은 단원을 오늘부터 시험 전날까지 고르게 나눈다.
// 매일 다시 계산하므로 계획이 밀리면 남은 날에 자동으로 다시 나눠진다.
// 오늘 끝낸 단원은 오늘 몫으로 남겨서, 오늘 할 일을 끝내도 새 단원이 끌려오지 않게 한다.
// 주말은 평일보다 가볍게 배정한다. 단, 시험 전 일주일은 주말도 평일처럼 공부한다.

import { daysUntil, isDone, needsReview, todayInSeoul } from "@/lib/weather_new";
import { isFading } from "@/lib/memory_new";

const DAY = 86_400_000;
const WEEKEND_WEIGHT = 0.3; // 주말 배정량(평일 = 1). 양이 적으면 주말은 아예 쉬게 된다.
const FINAL_WEEK_DAYS = 7; // 시험까지 이 날수 이내면 주말도 평일처럼

// 과목 색(캘린더 점·목록). 과목 순서대로 돌려 쓴다.
export const SUBJECT_COLORS = ["#0ea5e9", "#f43f5e", "#f59e0b", "#10b981", "#8b5cf6", "#f97316"];

type UnitLike = {
  id: string;
  title: string;
  status: string;
  position: number;
  completed_at: string | null;
  quiz_results?: { passed: boolean; created_at: string }[];
  study_logs?: { studied_at?: string }[];
};

type SubjectLike = { id: string; name: string; exam_date: string | null; units: UnitLike[] };

export type PlanItem = { id: string; title: string; done: boolean; review: boolean };
export type PlanEntry = { subjectId: string; subjectName: string; color: string; units: PlanItem[] };
export type Plan = {
  today: string;
  days: Record<string, PlanEntry[]>; // YYYY-MM-DD → 그날 할 과목별 단원
  lightDays: string[]; // 주말이라 가볍게 짠 날(시험 전 일주일이 아닌 주말)
  exams: Record<string, { subjectId: string; subjectName: string; color: string }[]>;
  done: Record<string, { subjectName: string; color: string; title: string }[]>; // 지난날 끝낸 단원
};

// YYYY-MM-DD에 n일 더하기
export function addDays(date: string, n: number) {
  return new Date(Date.parse(date) + n * DAY).toISOString().slice(0, 10);
}

function seoulDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

export function buildPlan(subjects: SubjectLike[]): Plan {
  const today = todayInSeoul();
  const plan: Plan = { today, days: {}, lightDays: [], exams: {}, done: {} };
  const light = new Set<string>();
  const heavy = new Set<string>(); // 어떤 과목이든 시험 전 일주일에 걸린 주말

  subjects.forEach((s, i) => {
    const color = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
    const base = { subjectId: s.id, subjectName: s.name, color };

    // 지난날 끝낸 단원 기록
    for (const u of s.units) {
      if (!isDone(u) || !u.completed_at) continue;
      const day = seoulDate(u.completed_at);
      if (day < today) (plan.done[day] ??= []).push({ subjectName: s.name, color, title: u.title });
    }

    if (!s.exam_date) return;
    const daysLeft = daysUntil(s.exam_date);
    (plan.exams[s.exam_date] ??= []).push(base);
    if (daysLeft < 0) return;

    // 계획에 넣을 단원: 안 끝낸 단원 + 기억이 옅어진 단원(복습) + 오늘 끝냈거나 오늘 퀴즈로 복습한 단원(✅)
    const doneToday = (u: UnitLike) =>
      isDone(u) &&
      !isFading(u) &&
      ((!!u.completed_at && seoulDate(u.completed_at) === today) ||
        !!u.quiz_results?.some((q) => q.passed && seoulDate(q.created_at) === today));

    // 오늘 끝낸 단원 → 하는 중 → 복습 → 목차 순서 (오늘의 추천과 같은 순서)
    const rank = (u: PlanItem & { status: string }) =>
      u.done ? 0 : u.status === "doing" ? 1 : u.review ? 2 : 3;
    const items = s.units
      .filter((u) => !isDone(u) || isFading(u) || doneToday(u))
      .map((u) => ({
        id: u.id,
        title: u.title,
        status: u.status,
        position: u.position,
        done: doneToday(u),
        review: needsReview(u) || isFading(u),
      }))
      .sort((a, b) => rank(a) - rank(b) || a.position - b.position);
    if (!items.some((u) => !u.done)) return; // 남은 단원이 없으면 계획도 없다

    // 오늘부터 시험 전날까지(시험 당일이면 오늘 하루) 날마다 가중치를 주고, 가중치에 비례해 나눈다.
    const slots = Array.from({ length: Math.max(daysLeft, 1) }, (_, j) => {
      const date = addDays(today, j);
      const isLight = isWeekend(date) && daysLeft - j > FINAL_WEEK_DAYS;
      if (isLight) light.add(date);
      else if (isWeekend(date)) heavy.add(date);
      return { date, weight: isLight ? WEEKEND_WEIGHT : 1 };
    });
    const totalWeight = slots.reduce((w, d) => w + d.weight, 0);
    const slotAt = (pos: number) => {
      let acc = 0;
      for (const d of slots) if ((acc += d.weight) > pos) return d.date;
      return slots[slots.length - 1].date;
    };

    items.forEach((u, k) => {
      // 오늘 끝낸 단원은 오늘에 둔다. 나머지는 k번째 단원의 가운데 위치가 떨어지는 날로.
      const day = u.done ? today : slotAt(((k + 0.5) * totalWeight) / items.length);
      const entries = (plan.days[day] ??= []);
      let entry = entries.find((e) => e.subjectId === s.id);
      if (!entry) entries.push((entry = { ...base, units: [] }));
      entry.units.push({ id: u.id, title: u.title, done: u.done, review: u.review });
    });
  });

  plan.lightDays = [...light].filter((d) => !heavy.has(d));
  return plan;
}

function isWeekend(date: string) {
  const d = new Date(Date.parse(date)).getUTCDay();
  return d === 0 || d === 6;
}
