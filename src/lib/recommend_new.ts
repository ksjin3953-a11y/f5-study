// 오늘의 추천 공부: 공부 캘린더의 오늘 계획에서 아직 안 끝낸 단원을 보여 준다.
// 캘린더와 같은 계산이라 주말에 가볍게 짠 날은 추천도 가볍다(쉬는 날이면 추천 없음).

import { daysUntil, isDone, needsReview, studyWeather } from "@/lib/weather_new";
import { buildPlan } from "@/lib/plan_new";
import { isFading } from "@/lib/memory_new";

const MAX_SUBJECTS = 3;

type UnitLike = {
  id: string;
  title: string;
  status: string;
  position: number;
  completed_at: string | null;
  quiz_results?: { passed: boolean; created_at: string }[];
  study_logs?: { studied_at?: string }[];
};

type SubjectLike = {
  id: string;
  name: string;
  exam_date: string | null;
  created_at: string;
  units: UnitLike[];
};

export type Recommendation = {
  subjectId: string;
  subjectName: string;
  weatherIcon: string;
  reason: string;
  units: (UnitLike & { review: boolean })[];
};

// status: 추천이 없을 때 이유. rest = 주말 쉬는 날, done = 오늘 몫을 다 끝냄, none = 계획할 게 없음
export type TodayRecommendations = {
  recommendations: Recommendation[];
  status: "todo" | "rest" | "done" | "none";
  light: boolean; // 오늘이 주말이라 가볍게 짠 날인지
};

export function recommendToday(subjects: SubjectLike[]): TodayRecommendations {
  const plan = buildPlan(subjects);
  const todayEntries = plan.days[plan.today] ?? [];
  const light = plan.lightDays.includes(plan.today);

  const recommendations = todayEntries
    .flatMap((entry) => {
      const s = subjects.find((x) => x.id === entry.subjectId);
      if (!s?.exam_date) return [];
      const planned = new Set(entry.units.filter((u) => !u.done).map((u) => u.id));
      const units = s.units
        .filter((u) => planned.has(u.id))
        .map((u) => ({ ...u, review: needsReview(u) || isFading(u) }))
        .sort(
          (a, b) =>
            [...planned].indexOf(a.id) - [...planned].indexOf(b.id)
        );
      if (units.length === 0) return [];

      const daysLeft = daysUntil(s.exam_date);
      const remaining = s.units.filter((u) => !isDone(u)).length;
      const reason =
        daysLeft === 0
          ? `오늘 시험 · 남은 ${remaining}단원`
          : remaining === 0
            ? `D-${daysLeft} · 다 끝냈어요, 오늘은 복습 ${units.length}단원`
            : `D-${daysLeft} · 오늘 ${units.length}단원 (남은 ${remaining}단원)`;
      return [
        {
          urgency: remaining / Math.max(daysLeft, 1),
          rec: { subjectId: s.id, subjectName: s.name, weatherIcon: studyWeather(s).icon, reason, units },
        },
      ];
    })
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, MAX_SUBJECTS)
    .map(({ rec }) => rec);

  const hasPlanAhead = Object.keys(plan.days).some((d) => d > plan.today);
  const status =
    recommendations.length > 0
      ? "todo"
      : todayEntries.length > 0
        ? "done"
        : light && hasPlanAhead
          ? "rest"
          : "none";
  return { recommendations, status, light };
}
