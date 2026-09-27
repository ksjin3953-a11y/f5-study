"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, PencilLine } from "lucide-react";
import { SyllabusImport } from "@/components/syllabus-import_new";
import { UnitForm } from "@/components/unit-form_new";

type Tab = "pdf" | "manual";

const TABS: { key: Tab; label: string; Icon: typeof FileText }[] = [
  { key: "pdf", label: "강의계획서로 한 번에", Icon: FileText },
  { key: "manual", label: "직접 적기", Icon: PencilLine },
];

// 길 내기(단원 만들기): 강의계획서로 한 번에 / 직접 적기를 탭으로 고른다.
// 과목 추가 흐름에서 ?setup=pdf|manual로 들어오면 그 탭을 열고 이 섹션으로 스크롤해 잠깐 강조한다.
export function UnitSetup({
  subjectId,
  existingCount,
  setup,
}: {
  subjectId: string;
  existingCount: number;
  setup: Tab | null;
}) {
  const [tab, setTab] = useState<Tab>(setup ?? "pdf");
  const [highlight, setHighlight] = useState(Boolean(setup));
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!setup) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    const t = setTimeout(() => setHighlight(false), 1500);
    return () => clearTimeout(t);
  }, [setup]);

  return (
    <section
      ref={ref}
      id="unit-setup"
      className={`-mx-3 flex scroll-mt-6 flex-col gap-4 rounded-3xl px-3 py-4 transition-colors duration-700 ${
        highlight ? "bg-brand-light" : "bg-transparent"
      }`}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold">길 내기</h2>
        <p className="text-sm text-zinc-500">단원을 만들면 딱따구리가 나무에 길을 내요</p>
      </div>

      {/* 세그먼트 컨트롤 */}
      <div role="tablist" aria-label="단원 만드는 방법" className="grid grid-cols-2 gap-1 rounded-2xl bg-field p-1">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`unit-tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`unit-panel-${key}`}
            onClick={() => setTab(key)}
            className={`flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-bold transition-colors ${
              tab === key ? "bg-white text-ink shadow-sm" : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            <Icon className={`size-4 ${tab === key ? (key === "pdf" ? "text-brand" : "text-forest") : ""}`} aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {/* 두 탭 모두 마운트해 두어 전환해도 진행 중인 입력·업로드가 사라지지 않게 한다 */}
      <div role="tabpanel" id="unit-panel-pdf" aria-labelledby="unit-tab-pdf" hidden={tab !== "pdf"}>
        <SyllabusImport subjectId={subjectId} existingCount={existingCount} />
      </div>
      <div role="tabpanel" id="unit-panel-manual" aria-labelledby="unit-tab-manual" hidden={tab !== "manual"}>
        <UnitForm subjectId={subjectId} />
      </div>
    </section>
  );
}
