"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { Brain, Ellipsis, Trash2 } from "lucide-react";
import { deleteUnit, setUnitStatus, type UnitStatus } from "@/app/unit-actions_new";
import { RecordForm } from "@/components/record-form_new";
import { Button } from "@/components/ui-button_new";
import { KIND_LABEL, leafColor, type NodeKind, type PathUnit } from "@/components/unit-path_new";

const STATUSES: { value: UnitStatus; label: string }[] = [
  { value: "todo", label: "할 일" },
  { value: "doing", label: "하는 중" },
  { value: "done", label: "완료" },
];

const BADGE: Record<NodeKind, string> = {
  todo: "bg-field text-zinc-600",
  doing: "bg-brand-light text-brand",
  done: "bg-forest-light text-forest-dark",
  fading: "bg-amber-100 text-amber-800",
  review: "bg-brand text-white",
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" });

// 시트·팝오버 공통 내용
export function UnitSheetBody({ unit, onQuiz }: { unit: PathUnit; onQuiz: () => void }) {
  const [recordOpen, setRecordOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pecked = unit.kind === "done" || unit.kind === "fading";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <h2 id={`sheet-title-${unit.id}`} className="break-keep text-xl font-bold">
          {unit.title}
        </h2>
        <span className={`mt-1 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${BADGE[unit.kind]}`}>
          {KIND_LABEL[unit.kind]}
        </span>
      </div>

      {/* 상태 전환: 기존 setUnitStatus 폼 액션 그대로 */}
      <div role="group" aria-label="단원 상태" className="grid grid-cols-3 gap-1 rounded-2xl bg-field p-1">
        {STATUSES.map((s) => (
          <form key={s.value} action={setUnitStatus.bind(null, unit.id, s.value)} className="contents">
            <StatusButton selected={unit.status === s.value}>{s.label}</StatusButton>
          </form>
        ))}
      </div>

      {pecked && unit.memory && (
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex shrink-0 items-center gap-1 font-bold text-zinc-600">
            <Brain className="size-3.5" style={{ color: leafColor(unit.memory.percent) }} aria-hidden />
            기억 {unit.memory.percent}%
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200/80">
            <span
              className="block h-full rounded-full"
              style={{ width: `${unit.memory.percent}%`, background: leafColor(unit.memory.percent) }}
            />
          </span>
          <span className="shrink-0 text-zinc-500">
            {unit.kind === "fading" ? "AI 퀴즈로 되살려요" : `복습 ${shortDate(unit.memory.reviewAt)}`}
          </span>
        </div>
      )}

      {(unit.logCount > 0 || unit.latestQuiz) && (
        <p className="text-sm text-zinc-500">
          {[
            unit.logCount > 0 && `공부 ${unit.logCount}회`,
            unit.latestQuiz &&
              `최근 퀴즈 ${unit.latestQuiz.score}/${unit.latestQuiz.total} ${unit.latestQuiz.passed ? "통과" : "미통과"}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      <Button type="button" onClick={onQuiz} variant="primary" size="md" className="w-full">
        {pecked ? "복습 퀴즈" : "AI 퀴즈 풀기"}
      </Button>
      <Button
        type="button"
        onClick={() => setRecordOpen((v) => !v)}
        aria-expanded={recordOpen}
        variant="neutral"
        size="md"
        className="w-full"
      >
        기록 남기기
      </Button>

      {recordOpen && (
        <div className="flex flex-col gap-3">
          <RecordForm unitId={unit.id} />
          {unit.logs.length > 0 && (
            <ul className="flex flex-col divide-y divide-zinc-200/80 text-sm">
              {unit.logs.map((log) => (
                <li key={log.id} className="flex gap-2 py-2 text-zinc-600">
                  <span className="shrink-0 tabular-nums text-zinc-400">{shortDate(log.studied_at)}</span>
                  <span className="min-w-0 break-keep">{log.memo ?? "공부함"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 맨 아래 오른쪽 "..." 메뉴: 단원 삭제 */}
      <div className="relative flex justify-end">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label="더 보기"
          className="flex size-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        >
          <Ellipsis className="size-5" />
        </button>
        {menuOpen && (
          <form
            action={deleteUnit.bind(null, unit.id)}
            onSubmit={(e) => {
              if (!confirm(`"${unit.title}" 단원을 삭제할까요? 학습 기록과 퀴즈 결과도 함께 지워져요.`)) e.preventDefault();
            }}
            className="absolute bottom-10 right-0 z-10 rounded-2xl bg-white p-1 shadow-lg"
          >
            <button className="flex h-10 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-bold text-red-600 hover:bg-red-50">
              <Trash2 className="size-4" aria-hidden />
              단원 삭제
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function StatusButton({ selected, children }: { selected: boolean; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={selected || pending}
      aria-pressed={selected}
      className={`h-10 rounded-xl text-sm font-bold transition-colors ${
        selected ? "bg-white text-ink shadow-sm" : "text-zinc-500 hover:text-zinc-800"
      } ${pending ? "opacity-60" : ""}`}
    >
      {children}
    </button>
  );
}

// 모바일: 아래에서 올라오는 시트. 바깥을 누르거나 아래로 끌어내리면 닫힌다.
export function BottomSheet({
  onClose,
  label,
  children,
}: {
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const [drag, setDrag] = useState<{ start: number; dy: number } | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={label}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        className={`sheet-up absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-paper px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl ${
          drag ? "" : "transition-transform duration-200"
        }`}
        style={{ transform: drag && drag.dy > 0 ? `translateY(${drag.dy}px)` : undefined }}
      >
        {/* 손잡이: 여기를 아래로 끌면 닫힌다 */}
        <div
          className="sticky top-0 -mx-5 flex touch-none justify-center bg-paper pb-3 pt-3"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrag({ start: e.clientY, dy: 0 });
          }}
          onPointerMove={(e) => drag && setDrag({ ...drag, dy: e.clientY - drag.start })}
          onPointerUp={() => {
            if (drag && drag.dy > 90) onClose();
            setDrag(null);
          }}
          onPointerCancel={() => setDrag(null)}
        >
          <span className="h-1.5 w-12 rounded-full bg-zinc-300" aria-hidden />
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

// 데스크톱: 노드 아래에 꼬리 달린 말풍선 팝오버. shift만큼 가운데를 옮겨 경로 밖으로 나가지 않게 한다.
export function SheetPopover({
  onClose,
  shift,
  children,
}: {
  onClose: () => void;
  shift: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const li = ref.current?.parentElement; // 노드 버튼을 다시 누르는 건 노드가 처리한다
      if (li && !li.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      className="absolute top-full z-30 mt-4 w-[360px] max-w-[calc(100vw-2rem)] rounded-3xl bg-white p-5 text-left shadow-xl"
      style={{ left: `calc(50% - 180px + ${shift}px)` }}
    >
      {/* 꼬리: 노드를 가리킨다 */}
      <span
        className="absolute -top-2 size-4 rotate-45 bg-white"
        style={{ left: `calc(180px - ${shift}px - 8px)` }}
        aria-hidden
      />
      {children}
    </div>
  );
}
