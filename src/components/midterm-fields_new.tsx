"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { setMidterm } from "@/app/subject-actions_new";
import { Button } from "@/components/ui-button_new";
import { BOSSES } from "@/lib/exam_new";

export type MidtermValue = {
  has: boolean | null; // null = 아직 모름(사용자에게 물어봐야 함)
  units: number; // 앞에서부터 몇 단원까지가 중간고사 범위인지
  date: string; // YYYY-MM-DD, 없으면 ""
};

// 중간고사 입력 칸: 있음/없음 → 범위(몇 번째 단원까지) → 날짜.
// 강의계획서 미리보기와 과목 페이지의 중간고사 설정이 같이 쓴다.
export function MidtermFields({
  value,
  onChange,
  unitTitles,
}: {
  value: MidtermValue;
  onChange: (v: MidtermValue) => void;
  unitTitles: string[]; // 범위 선택지(단원 순서대로)
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Image src={BOSSES.mid.image} alt="" width={31} height={40} />
        <span className="text-sm font-bold">중간고사가 있나요?</span>
      </div>
      <div role="group" aria-label="중간고사 여부" className="grid grid-cols-2 gap-2">
        {[
          { v: true, label: "있어요" },
          { v: false, label: "없어요" },
        ].map((o) => (
          <button
            key={String(o.v)}
            type="button"
            onClick={() =>
              onChange({ ...value, has: o.v, units: o.v && value.units === 0 ? Math.ceil(unitTitles.length / 2) : value.units })
            }
            aria-pressed={value.has === o.v}
            className={`h-10 rounded-xl border-2 text-sm font-bold transition-colors ${
              value.has === o.v ? "border-brand bg-brand-light text-brand" : "border-zinc-200 bg-white text-zinc-600"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {value.has && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-zinc-700">중간고사 범위 (처음부터 이 단원까지)</span>
            <select
              value={Math.min(value.units, unitTitles.length)}
              onChange={(e) => onChange({ ...value, units: Number(e.target.value) })}
              className="h-10 rounded-xl border border-zinc-300 bg-white px-2"
            >
              {unitTitles.map((t, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}. {t || "(이름 없는 단원)"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-zinc-700">중간고사 날짜</span>
            <input
              type="date"
              value={value.date}
              onChange={(e) => onChange({ ...value, date: e.target.value })}
              className="h-10 rounded-xl border border-zinc-300 bg-white px-2"
            />
          </label>
          <p className="text-xs text-zinc-500">
            {Math.min(value.units, unitTitles.length)}단원까지는 아기 매, 그 뒤{" "}
            {Math.max(0, unitTitles.length - value.units)}단원은 부모 매(기말)의 HP가 돼요.
          </p>
        </>
      )}
      {value.has === false && (
        <p className="text-xs text-zinc-500">기말고사 보스(매) 하나만 나오고, 모든 단원이 HP가 돼요.</p>
      )}
    </div>
  );
}

// 과목 페이지: 이미 만든 과목의 중간고사 설정 (강의계획서에 없었거나 바꾸고 싶을 때)
export function MidtermSettings({
  subjectId,
  unitTitles,
  initial,
}: {
  subjectId: string;
  unitTitles: string[];
  initial: { units: number | null; date: string | null };
}) {
  const [value, setValue] = useState<MidtermValue>({
    has: initial.units ? true : initial.units === 0 ? false : null,
    units: initial.units || Math.ceil(unitTitles.length / 2),
    date: initial.date ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  if (unitTitles.length === 0) return null;

  const summary = initial.units
    ? `중간고사 ${initial.date?.slice(5).replace("-", "/") ?? ""} · ${Math.min(initial.units, unitTitles.length)}단원까지`
    : "중간고사 없음 (기말 보스만)";

  const save = () =>
    startTransition(async () => {
      setError(null);
      setSaved(false);
      const res = await setMidterm(subjectId, {
        units: value.has ? value.units : 0,
        date: value.has ? value.date || null : null,
      });
      if (res.error) setError(res.error);
      else setSaved(true);
    });

  return (
    <details className="group rounded-2xl border-2 border-zinc-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm">
        <span className="font-bold">중간고사 설정</span>
        <span className="text-zinc-500">{summary} ▾</span>
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <MidtermFields value={value} onChange={setValue} unitTitles={unitTitles} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-forest-dark">저장했어요.</p>}
        <Button type="button" onClick={save} disabled={pending || value.has === null} size="sm">
          {pending ? "저장 중…" : "저장"}
        </Button>
      </div>
    </details>
  );
}
