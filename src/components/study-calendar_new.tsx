"use client";

import Link from "next/link";
import { useState } from "react";
import { addDays, type Plan } from "@/lib/plan_new";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function monthStart(date: string) {
  return date.slice(0, 8) + "01";
}

function shiftMonth(month: string, n: number) {
  const d = new Date(Date.parse(month));
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

function weekday(date: string) {
  return new Date(Date.parse(date)).getUTCDay();
}

function dateLabel(date: string) {
  const d = new Date(Date.parse(date));
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAYS[d.getUTCDay()]})`;
}

// 월 달력 + 고른 날의 할 일 목록
export function StudyCalendar({ plan }: { plan: Plan }) {
  const [month, setMonth] = useState(monthStart(plan.today));
  const [selected, setSelected] = useState(plan.today);

  // 달력 칸: 첫 주 앞의 빈칸 + 그 달의 날짜
  const nextMonth = shiftMonth(month, 1);
  const cells: (string | null)[] = Array(weekday(month)).fill(null);
  for (let d = month; d < nextMonth; d = addDays(d, 1)) cells.push(d);

  const [y, m] = month.split("-").map(Number);
  const entries = plan.days[selected] ?? [];
  const exams = plan.exams[selected] ?? [];
  const done = plan.done[selected] ?? [];
  const todo = entries.reduce((n, e) => n + e.units.filter((u) => !u.done).length, 0);
  const isPast = selected < plan.today;
  const selectedLight = plan.lightDays.includes(selected);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setMonth(shiftMonth(month, -1))}
          className="h-9 w-9 rounded-full text-lg text-zinc-500 hover:bg-zinc-100"
          aria-label="이전 달"
        >
          ‹
        </button>
        <span className="font-semibold">
          {y}년 {m}월
        </span>
        <button
          onClick={() => setMonth(shiftMonth(month, 1))}
          className="h-9 w-9 rounded-full text-lg text-zinc-500 hover:bg-zinc-100"
          aria-label="다음 달"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <span
            key={w}
            className={`text-xs font-medium ${
              i === 0 ? "text-rose-500" : i === 6 ? "text-sky-600" : "text-zinc-400"
            }`}
          >
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`blank-${i}`} />;
          const dayEntries = plan.days[d] ?? [];
          const dayExams = plan.exams[d] ?? [];
          const count = dayEntries.reduce((n, e) => n + e.units.length, 0);
          const doneCount = plan.done[d]?.length ?? 0;
          const isToday = d === plan.today;
          const isSelected = d === selected;
          const isLight = plan.lightDays.includes(d);
          return (
            <button
              key={d}
              onClick={() => setSelected(d)}
              className={`flex min-h-16 flex-col items-center gap-0.5 rounded-xl px-0.5 py-1 transition-colors ${
                isSelected
                  ? "bg-zinc-900 text-white"
                  : dayExams.length
                    ? "bg-rose-50 ring-1 ring-rose-200 hover:bg-rose-100"
                    : "hover:bg-zinc-100"
              } ${d < plan.today && !isSelected ? "text-zinc-400" : ""}`}
            >
              <span
                className={`text-xs ${
                  isToday && !isSelected ? "rounded-full bg-amber-400 px-1.5 font-bold text-zinc-900" : ""
                }`}
              >
                {Number(d.slice(8))}
              </span>
              {dayExams.length > 0 && <span className="text-sm leading-none">🦅</span>}
              {isLight && dayExams.length === 0 && <span className="text-[10px] leading-none">🌿</span>}
              {count > 0 && (
                <>
                  <span className="flex flex-wrap justify-center gap-0.5">
                    {dayEntries.map((e) => (
                      <span
                        key={e.subjectId}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: e.color }}
                      />
                    ))}
                  </span>
                  <span className="text-[10px] font-semibold tabular-nums">{count}단원</span>
                </>
              )}
              {count === 0 && doneCount > 0 && <span className="text-[10px]">✅{doneCount}</span>}
            </button>
          );
        })}
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold">
            {dateLabel(selected)}
            {selected === plan.today && <span className="ml-1 text-sm text-amber-600">오늘</span>}
          </h2>
          {entries.length > 0 && <span className="text-sm text-zinc-500">할 일 {todo}단원</span>}
        </div>

        {selectedLight && !isPast && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            🌿 주말이라 {entries.length > 0 ? "가볍게 짰어요. 이것만 하고 푹 쉬어요!" : "쉬는 날이에요. 푹 쉬어요!"}
          </p>
        )}

        {exams.map((e) => (
          <p key={e.subjectId} className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            🦅 {e.subjectName} 시험 날 · 보스가 와요!
          </p>
        ))}

        {entries.map((e) => (
          <div key={e.subjectId} className="flex flex-col gap-1">
            <Link
              href={`/subjects/${e.subjectId}`}
              className="flex items-center gap-2 text-sm font-semibold hover:underline"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} />
              {e.subjectName}
            </Link>
            <ul className="flex flex-col gap-1 pl-4">
              {e.units.map((u) => (
                <li key={u.id} className={`text-sm ${u.done ? "text-zinc-400 line-through" : ""}`}>
                  {u.done ? "✅ " : "· "}
                  {u.review && !u.done && <span className="mr-1 text-xs text-violet-600">복습</span>}
                  {u.title}
                </li>
              ))}
            </ul>
          </div>
        ))}

        {done.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-emerald-700">이날 끝낸 단원</span>
            <ul className="flex flex-col gap-1 pl-4">
              {done.map((d, i) => (
                <li key={i} className="text-sm text-zinc-600">
                  <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: d.color }} />
                  {d.subjectName} · {d.title}
                </li>
              ))}
            </ul>
          </div>
        )}

        {entries.length === 0 && exams.length === 0 && done.length === 0 && !selectedLight && (
          <p className="text-sm text-zinc-500">
            {isPast ? "이날은 기록이 없어요." : "이날은 계획된 공부가 없어요. 🌿"}
          </p>
        )}
        {!isPast && entries.length > 0 && (
          <p className="text-xs text-zinc-400">
            계획은 매일 다시 계산돼요. 오늘 못 끝낸 단원은 남은 날에 자동으로 나눠져요. 주말은 평일의
            1/3만 배정하고, 시험 전 일주일은 주말도 평일처럼 공부해요.
          </p>
        )}
      </section>
    </div>
  );
}
