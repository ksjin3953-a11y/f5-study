"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { deleteMaterial, registerMaterial, setMaterialUnit } from "@/app/material-actions_new";
import { MAX_PDF_MB, uploadPdf } from "@/lib/upload-pdf_new";
import { MascotSays } from "@/components/mascot_new";

type Material = { id: string; name: string; size: number; unit_id: string | null };
type Unit = { id: string; title: string };

const ALL = ""; // 단원 선택: 과목 전체

function sizeLabel(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(bytes / 1024)}KB`;
}

// 자료 칩에 올리면 경로의 해당 마디가 살짝 커진다(unit-path_new의 data-unit-node)
function hintNode(unitId: string | null) {
  document.querySelectorAll(".node-hint").forEach((el) => el.classList.remove("node-hint"));
  if (unitId) document.querySelector(`[data-unit-node="${unitId}"]`)?.classList.add("node-hint");
}

// 자료 곳간: 도토리딱따구리가 나무 구멍에 먹이를 모아 두듯 강의자료 PDF를 넣어 둔다.
// 단원을 고르면 그 단원 퀴즈에, 과목 전체로 두면 자료가 없는 단원 퀴즈에 쓰인다.
export function Materials({
  subjectId,
  units,
  materials,
  ready,
}: {
  subjectId: string;
  units: Unit[];
  materials: Material[];
  ready: boolean; // materials 테이블이 있는지
}) {
  const [unitId, setUnitId] = useState(ALL);
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [dragging, setDragging] = useState(false);
  const [flash, setFlash] = useState<string | null>(null); // 경로의 도토리 뱃지로 들어오면 그 단원 자료를 강조
  const fileRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const list = [...files];
    setErrors([]);
    startTransition(async () => {
      const failed: string[] = [];
      for (const [i, file] of list.entries()) {
        setStatus(`올리는 중… (${i + 1}/${list.length}) ${file.name}`);
        const up = await uploadPdf(file, subjectId);
        if ("error" in up) {
          failed.push(up.error);
          continue;
        }
        const reg = await registerMaterial({
          subjectId,
          unitId: unitId || null,
          kind: "lecture",
          name: file.name,
          path: up.path,
          size: file.size,
        });
        if ("error" in reg) failed.push(`${file.name}: ${reg.error}`);
      }
      setErrors(failed);
      setStatus(null);
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onShow = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      setFlash(id);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      sectionRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      clearTimeout(timer);
      timer = setTimeout(() => setFlash(null), 1500);
    };
    window.addEventListener("f5:show-materials", onShow);
    return () => {
      window.removeEventListener("f5:show-materials", onShow);
      clearTimeout(timer);
    };
  }, []);

  if (!ready) {
    // 테이블이 없으면 운영에서는 섹션을 숨기고, 개발 중에만 안내를 보여 준다.
    if (process.env.NODE_ENV !== "development") return null;
    return (
      <p className="rounded-3xl bg-[#f6ebdd] p-5 text-sm text-zinc-500">
        (개발용 안내) 강의자료를 쓰려면 DB에 materials 테이블과 보관함을 만들어 주세요. (supabase/schema_new.sql)
      </p>
    );
  }

  const titleOf = (id: string | null) => (id ? (units.find((u) => u.id === id)?.title ?? "과목 전체") : "과목 전체");

  return (
    <section
      ref={sectionRef}
      id="material-store"
      className="relative flex scroll-mt-6 flex-col gap-4 overflow-hidden rounded-3xl bg-[#f6ebdd] px-5 pb-5 pt-7"
    >
      <BarkEdge />
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold">자료 곳간</h2>
        <p className="text-sm text-zinc-600">강의자료를 넣어두면 AI 퀴즈가 수업 내용으로 나와요</p>
      </div>

      {materials.length === 0 && <MascotSays>강의자료를 넣어주면 수업 내용으로 문제를 낼게!</MascotSays>}

      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-zinc-500">
        어느 단원 자료야?
        <UnitChip value={unitId} units={units} disabled={pending} onChange={setUnitId} label="넣을 자료의 단원" />
      </div>

      {/* 모바일: 가로로 넘기는 카드 줄(이 안에서만 스크롤) / 데스크톱: 그리드 */}
      <ul className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:thin] lg:mx-0 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] lg:overflow-visible lg:px-0">
        {materials.map((m) => (
          <li
            key={m.id}
            className={`relative flex w-40 shrink-0 snap-start flex-col gap-2 rounded-2xl p-3 transition-colors duration-500 lg:w-auto ${
              flash && m.unit_id === flash ? "bg-brand-light ring-2 ring-brand" : "bg-white/70"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                if (confirm(`"${m.name}" 자료를 곳간에서 뺄까요?`)) startTransition(() => deleteMaterial(m.id));
              }}
              disabled={pending}
              aria-label={`${m.name} 삭제`}
              className="absolute right-1.5 top-1.5 z-10 flex size-7 items-center justify-center rounded-full bg-white/80 text-zinc-400 shadow-sm hover:text-red-600 disabled:opacity-40"
            >
              <X className="size-4" strokeWidth={2.5} />
            </button>
            <MaterialIcon className="h-16 w-full" />
            <div className="flex min-w-0 flex-col">
              <span className="line-clamp-2 break-all text-sm font-semibold leading-snug" title={m.name}>
                {m.name}
              </span>
              <span className="text-xs tabular-nums text-zinc-400">{sizeLabel(m.size)}</span>
            </div>
            <UnitChip
              value={m.unit_id ?? ALL}
              units={units}
              disabled={pending}
              onChange={(v) => startTransition(() => setMaterialUnit(m.id, v || null))}
              label={`${m.name} 단원: ${titleOf(m.unit_id)}`}
            />
          </li>
        ))}

        {/* 빈 나무 구멍: 누르거나 끌어다 놓으면 자료를 넣는다 */}
        <li className="w-40 shrink-0 snap-start lg:w-auto">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              if (!pending) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!pending) onFiles(e.dataTransfer.files);
            }}
            className={`flex h-full min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl p-3 text-center transition-colors ${
              dragging ? "bg-brand-light" : "bg-white/40 hover:bg-white/70"
            } ${pending ? "pointer-events-none" : ""}`}
          >
            {pending ? (
              <>
                <MaterialIcon animate className="h-16 w-full" />
                <span className="line-clamp-3 break-all text-xs font-bold text-zinc-600" role="status">
                  {status}
                </span>
              </>
            ) : (
              <>
                <span
                  className={`flex size-16 items-center justify-center rounded-full border-2 border-dashed ${
                    dragging ? "border-brand text-brand" : "border-[#c08a5e]/70 text-[#9a6a45]"
                  } bg-[#e9d6bf]/60`}
                >
                  <Plus className="size-7" strokeWidth={2.5} aria-hidden />
                </span>
                <span className="text-sm font-bold text-[#7d5536]">자료 넣기</span>
                <span className="text-[11px] text-zinc-400">PDF · 여러 개 가능</span>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="sr-only"
              disabled={pending}
              onChange={(e) => onFiles(e.target.files)}
            />
          </label>
        </li>
      </ul>

      {errors.length > 0 && (
        <MascotSays size="sm" mood="rainy">
          {errors.map((e) => (
            <span key={e} className="block">
              {e}
            </span>
          ))}
        </MascotSays>
      )}

      <p className="text-xs text-zinc-500">파일당 {MAX_PDF_MB}MB까지 · 퀴즈 한 번에 최근 자료 3개까지 읽어요</p>
    </section>
  );
}

// 위쪽 가장자리: 나무껍질 물결 띠
const BARK_PATH =
  "M0 0 H400 V5 " +
  Array.from({ length: 20 }, (_, i) => {
    const x = 400 - i * 20;
    return `Q${x - 10} ${i % 2 ? 11 : 9} ${x - 20} 5`;
  }).join(" ") +
  " Z";
function BarkEdge() {
  return (
    <svg viewBox="0 0 400 12" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-3 w-full" aria-hidden>
      <path d={BARK_PATH} fill="#c08a5e" />
      <path d="M0 3 H400" stroke="#9a6a45" strokeOpacity="0.35" strokeWidth="1" />
    </svg>
  );
}

// 나무 구멍 + 둘둘 말린 종이 두루마리(클레이 음영). animate면 두루마리가 구멍 속으로 쏙 들어가길 반복한다.
// paper면 두루마리 대신 납작한 종이 한 장(강의계획서 올리는 중).
export function MaterialIcon({
  animate = false,
  paper = false,
  className = "",
}: {
  animate?: boolean;
  paper?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 96 72" className={className} aria-hidden>
      <defs>
        <radialGradient id={`bark-${id}`} cx="0.3" cy="0.25" r="0.9">
          <stop offset="0" stopColor="#ecd2ae" />
          <stop offset="0.55" stopColor="#d9b58a" />
          <stop offset="1" stopColor="#c09366" />
        </radialGradient>
        <radialGradient id={`hole-${id}`} cx="0.6" cy="0.7" r="0.8">
          <stop offset="0" stopColor="#3f2717" />
          <stop offset="1" stopColor="#6e4a30" />
        </radialGradient>
        <linearGradient id={`scroll-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="1" stopColor="#ecdcc0" />
        </linearGradient>
        {/* 두루마리는 구멍 위쪽과 구멍 안에서만 보인다 */}
        <clipPath id={`clip-${id}`}>
          <rect x="0" y="0" width="96" height="42" />
          <ellipse cx="48" cy="42" rx="23" ry="15" />
        </clipPath>
        <filter id={`soft-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
      {/* 나무껍질 조각 */}
      <rect x="6" y="6" width="84" height="62" rx="24" fill={`url(#bark-${id})`} />
      <ellipse cx="30" cy="16" rx="14" ry="5" fill="#fff" opacity="0.45" filter={`url(#soft-${id})`} />
      {/* 구멍 */}
      <ellipse cx="48" cy="42" rx="23" ry="15" fill={`url(#hole-${id})`} />
      <g clipPath={`url(#clip-${id})`}>
        <g className={animate ? "slip-in" : ""}>
          {paper ? (
            <g transform="rotate(-8 48 30)">
              <path d="M36 8 H56 L62 14 V46 H36 Z" fill={`url(#scroll-${id})`} stroke="#d8c6a8" strokeWidth="1.2" />
              <path d="M56 8 V14 H62" fill="#e6d4b6" />
              <g stroke="#c9b490" strokeWidth="1.6" strokeLinecap="round">
                <path d="M41 20 H55" />
                <path d="M41 26 H57" />
                <path d="M41 32 H52" />
              </g>
            </g>
          ) : (
            <g transform="rotate(24 50 40)">
              <rect x="42" y="6" width="14" height="44" rx="7" fill={`url(#scroll-${id})`} stroke="#d8c6a8" strokeWidth="1.2" />
              <ellipse cx="49" cy="8" rx="7" ry="3" fill="#f3e6cf" stroke="#d8c6a8" strokeWidth="1.2" />
              <ellipse cx="49" cy="8" rx="2.4" ry="1" fill="#c9b490" />
              <path d="M45 18 V36" stroke="#fff" strokeOpacity="0.8" strokeWidth="2" strokeLinecap="round" />
            </g>
          )}
        </g>
      </g>
      {/* 구멍 아래쪽 밝은 테두리 */}
      <path d="M27 47 Q48 63 69 47" fill="none" stroke="#f3d8b0" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

// 단원 칩: 누르면 단원 목록 팝오버. 기본 select 대신 쓴다.
// 가로 스크롤 줄 안에서도 잘리지 않게 목록은 body에 fixed로 띄운다.
function UnitChip({
  value,
  units,
  disabled,
  onChange,
  label,
}: {
  value: string;
  units: Unit[];
  disabled: boolean;
  onChange: (unitId: string) => void;
  label: string;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const title = value ? (units.find((u) => u.id === value)?.title ?? "과목 전체") : "과목 전체";
  const close = () => {
    setRect(null);
    hintNode(null);
  };

  useEffect(() => {
    if (!rect) return;
    const close = () => {
      setRect(null);
      hintNode(null);
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!listRef.current?.contains(t) && !btnRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onMove = () => close(); // 스크롤·크기 변경 시 위치가 어긋나므로 닫는다
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [rect]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={!!rect}
        aria-label={label}
        onClick={() => (rect ? close() : setRect(btnRef.current!.getBoundingClientRect()))}
        onPointerEnter={() => hintNode(value || null)}
        onPointerLeave={() => !rect && hintNode(null)}
        onFocus={() => hintNode(value || null)}
        onBlur={() => !rect && hintNode(null)}
        className="flex h-8 max-w-full items-center gap-1 self-start rounded-full bg-[#ecdcc6] px-3 text-xs font-bold text-[#6f4b2f] transition-colors hover:bg-[#e4cfb3] disabled:opacity-50"
      >
        <span className="truncate">{title}</span>
        <ChevronDown className="size-3.5 shrink-0" aria-hidden />
      </button>
      {rect &&
        createPortal(
          <div
            ref={listRef}
            role="listbox"
            aria-label="단원 고르기"
            className="fixed z-[65] max-h-64 w-60 overflow-y-auto rounded-2xl bg-white p-1 shadow-xl"
            style={{
              top: Math.min(rect.bottom + 6, window.innerHeight - 270),
              left: Math.min(Math.max(8, rect.left), window.innerWidth - 248),
            }}
          >
            {[{ id: ALL, title: "과목 전체" }, ...units].map((u) => (
              <button
                key={u.id || "all"}
                type="button"
                role="option"
                aria-selected={u.id === value}
                onPointerEnter={() => hintNode(u.id || null)}
                onClick={() => {
                  if (u.id !== value) onChange(u.id);
                  close();
                }}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${
                  u.id === value ? "bg-brand-light font-bold text-brand" : "hover:bg-field"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{u.title}</span>
                {u.id === value && <Check className="size-4 shrink-0" aria-hidden />}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
