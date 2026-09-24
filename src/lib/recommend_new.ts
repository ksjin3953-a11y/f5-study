// 오늘의 추천 공부: 하루에 끝내야 할 단원 수가 많은(급한) 과목부터 다음 단원을 고른다.

import { daysUntil, isDone, needsReview, studyWeather } from "@/lib/weather_new";

const MAX_SUBJECTS = 3;
const MAX_UNITS_PER_SUBJECT = 3;

type UnitLike = {
  id: string;
  title: string;
  status: string;
  position: number;
  completed_at: string | null;
  quiz_results?: { passed: boolean; created_at: string }[];
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

export function recommendToday(subjects: SubjectLike[]): Recommendation[] {
  return subjects
    .flatMap((s) => {
      if (!s.exam_date) return [];
      const daysLeft = daysUntil(s.exam_date);
      if (daysLeft < 0) return [];

      // 하는 중인 단원 먼저, 그다음 복습 단원, 그다음 목차 순서
      const rank = (u: UnitLike & { review: boolean }) =>
        u.status === "doing" ? 0 : u.review ? 1 : 2;
      const pending = s.units
        .filter((u) => !isDone(u))
        .map((u) => ({ ...u, review: needsReview(u) }))
        .sort((a, b) => rank(a) - rank(b) || a.position - b.position);
      if (pending.length === 0) return [];

      const perDay = pending.length / Math.max(daysLeft, 1);
      const count = Math.min(MAX_UNITS_PER_SUBJECT, Math.ceil(perDay));
      const reason =
        daysLeft === 0
          ? `오늘 시험 · 남은 ${pending.length}단원`
          : `D-${daysLeft} · 남은 ${pending.length}단원, 하루 ${perDay.toFixed(1)}단원 필요`;

      return [
        {
          perDay,
          rec: {
            subjectId: s.id,
            subjectName: s.name,
            weatherIcon: studyWeather(s).icon,
            reason,
            units: pending.slice(0, count),
          },
        },
      ];
    })
    .sort((a, b) => b.perDay - a.perDay)
    .slice(0, MAX_SUBJECTS)
    .map(({ rec }) => rec);
}
