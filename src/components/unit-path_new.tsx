"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Pencil } from "lucide-react";
import type { UnitStatus } from "@/app/unit-actions_new";
import { DDayBadge } from "@/components/dday-badge_new";
import { buttonClass } from "@/components/ui-button_new";
import { BottomSheet, SheetPopover, UnitSheetBody } from "@/components/unit-sheet_new";
import { QuizLesson } from "@/components/quiz_new";

// 단원 = 딱따구리가 오르는 나무 줄기의 마디. 위→아래로 position 순서.
// 상태 계산(isDone·needsReview·memoryOf)은 서버에서 기존 lib 함수로 해서 kind로 넘겨받는다.

export type NodeKind = "todo" | "doing" | "done" | "fading" | "review";

export type PathUnit = {
  id: string;
  title: string;
  status: UnitStatus;
  kind: NodeKind;
  memory: { percent: number; reviewAt: string } | null;
  logCount: number;
  logs: { id: string; studied_at: string; memo: string | null }[]; // 최근 5개
  latestQuiz: { score: number; total: number; passed: boolean } | null;
  materials: number; // 이 단원에 붙인 강의자료 수
};

export const KIND_LABEL: Record<NodeKind, string> = {
  todo: "할 일",
  doing: "하는 중",
  done: "완료",
  fading: "복습할 때",
  review: "복습 필요",
};

const ZIGZAG = 56; // 좌우 흔들림 폭(px)
const offsetOf = (i: number) => Math.round(Math.sin(i * 0.9) * ZIGZAG);

// 기억도에 따른 잎 색: 100% 초록 → 50% 노랑 → 0% 갈색
const LEAF_STOPS: [number, [number, number, number]][] = [
  [0, [0xb9, 0x8a, 0x4e]],
  [50, [0xe6, 0xc3, 0x5a]],
  [100, [0x6b, 0xb0, 0x6e]],
];
export function leafColor(percent: number) {
  const p = Math.max(0, Math.min(100, percent));
  const i = p <= 50 ? 0 : 1;
  const [p0, c0] = LEAF_STOPS[i];
  const [p1, c1] = LEAF_STOPS[i + 1];
  const t = (p - p0) / (p1 - p0);
  const [r, g, b] = c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
  return `rgb(${r} ${g} ${b})`;
}

// 데스크톱(lg~)이면 노드 옆 팝오버, 아니면 바텀시트
function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 64rem)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 64rem)").matches,
    () => false
  );
}

export function UnitPath({
  units,
  examDate,
  daysLeft,
  autoScroll,
  boss,
}: {
  units: PathUnit[];
  examDate: string | null;
  daysLeft: number | null;
  autoScroll: boolean; // ?setup으로 단원 만들기에 들어온 경우엔 경로로 스크롤하지 않는다
  boss: { remaining: number; total: number };
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [quizId, setQuizId] = useState<string | null>(null);
  // 처음 본 단원들. 나중에 생긴(길 내기로 추가된) 마디만 톡톡 떨어지며 나타나고, 애니메이션이 끝나면 여기에 더한다.
  const [known, setKnown] = useState(() => new Set(units.map((u) => u.id)));
  const freshIds = units.filter((u) => !known.has(u.id)).map((u) => u.id);
  const [width, setWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLLIElement>(null);
  const isDesktop = useIsDesktop();

  // 딱따구리 자리: 첫 "하는 중" 단원, 없으면 첫 미완료 단원. 다 끝냈으면 보스 둥지 옆.
  const currentIndex = (() => {
    const doing = units.findIndex((u) => u.kind === "doing");
    return doing >= 0 ? doing : units.findIndex((u) => u.kind === "todo" || u.kind === "review");
  })();
  const allDone = units.length > 0 && currentIndex === -1;

  const openUnit = units.find((u) => u.id === openId) ?? null;
  const quizUnit = units.find((u) => u.id === quizId) ?? null;

  // 팝오버를 경로 폭 안에 가두려고 폭을 잰다.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 길 내기로 새 마디 묶음이 생기면(그려진 뒤에) 그 첫 마디로 부드럽게 스크롤한다.
  // 기준은 묶음의 마지막 id: 앞 마디들의 등장이 끝나 freshIds가 줄어도 바뀌지 않아서 다시 스크롤하지 않는다.
  const lastFresh = freshIds.at(-1) ?? null;
  useEffect(() => {
    if (!lastFresh) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .querySelector("#unit-path li > .drop-in button[data-unit-node]")
      ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  }, [lastFresh]);

  // 들어오면 딱따구리가 있는 마디로 스크롤
  useEffect(() => {
    if (!autoScroll) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    currentRef.current?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [autoScroll]);

  if (units.length === 0) return <EmptyPath />;

  const body = openUnit && (
    <UnitSheetBody
      key={openUnit.id}
      unit={openUnit}
      onQuiz={() => setQuizId(openUnit.id)}
    />
  );

  return (
    <div ref={containerRef} id="unit-path" className="relative w-full scroll-mt-6">
      <Trunk />
      <ol className="relative flex flex-col items-center gap-12 pb-2 pt-12">
        {units.map((u, i) => {
          const offset = offsetOf(i);
          const current = i === currentIndex;
          const open = openId === u.id;
          const fresh = freshIds.indexOf(u.id);
          return (
            <li
              key={u.id}
              ref={current ? currentRef : undefined}
              className={`relative flex w-40 flex-col items-center ${open ? "z-30" : ""}`}
              style={{ transform: `translateX(${offset}px)` }}
            >
              {current && <Woodpecker side={offset >= 0 ? -1 : 1} />}
              {current && <NodeTag tone="here">지금 여기!</NodeTag>}
              {u.kind === "fading" && <NodeTag tone="review">복습!</NodeTag>}
              <div
                className={`flex flex-col items-center ${fresh >= 0 ? "drop-in" : ""}`}
                style={fresh >= 0 ? { animationDelay: `${fresh * 120}ms` } : undefined}
                onAnimationEnd={(e) => {
                  if (fresh >= 0 && e.target === e.currentTarget) setKnown((k) => new Set(k).add(u.id));
                }}
              >
                <div className={`relative ${u.kind === "fading" ? "pet-egg-wobble" : ""}`}>
                  <UnitNode unit={u} expanded={open} onClick={() => setOpenId(open ? null : u.id)} />
                  {u.materials > 0 && <AcornBadge unit={u} />}
                </div>
                {/* 줄기 위에 겹쳐도 읽히게 크림색 바탕을 깐다 */}
                <span
                  className={`mt-2 line-clamp-2 max-w-[150px] break-keep rounded-lg bg-paper/90 px-1.5 text-center text-sm font-semibold ${
                    u.kind === "done" ? "text-zinc-500" : "text-ink"
                  }`}
                >
                  {u.title}
                </span>
              </div>

              {open && isDesktop && (
                <SheetPopover
                  onClose={() => setOpenId(null)}
                  // 경로 폭(width) 안에 들어오도록 팝오버 가운데를 옮긴다.
                  shift={popoverShift(width, offset)}
                >
                  {body}
                </SheetPopover>
              )}
            </li>
          );
        })}

        <BossNest examDate={examDate} daysLeft={daysLeft} defeated={allDone}>
          {allDone && <Woodpecker side={-1} />}
        </BossNest>
      </ol>

      {openUnit && !isDesktop && (
        <BottomSheet onClose={() => setOpenId(null)} label={openUnit.title}>
          {body}
        </BottomSheet>
      )}

      {quizUnit && (
        <QuizLesson
          unitId={quizUnit.id}
          review={quizUnit.kind === "done" || quizUnit.kind === "fading"}
          boss={boss}
          onClose={() => setQuizId(null)}
        />
      )}
    </div>
  );
}

// 팝오버(360px)가 경로 밖으로 나가지 않게 가운데를 얼마나 옮길지
const POPOVER = 360;
function popoverShift(width: number, offset: number) {
  if (!width || width <= POPOVER) return -offset;
  const center = width / 2 + offset;
  const clamped = Math.min(Math.max(center, POPOVER / 2), width - POPOVER / 2);
  return clamped - center;
}

// 가운데 나무 줄기: 가로 그라데이션 + 옅은 나뭇결 + 왼쪽 광택
export function Trunk({ className ="absolute bottom-28 left-1/2 top-4 -translate-x-1/2" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`w-7 overflow-hidden rounded-full ${className}`}
      style={{ background: "linear-gradient(90deg, #c08a5e 0%, #b07b50 55%, #9a6a45 100%)" }}
    >
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 28 100" preserveAspectRatio="none">
        <g fill="none" stroke="#7d5536" strokeOpacity="0.35" strokeWidth="1.5" vectorEffect="non-scaling-stroke">
          <path d="M9 0 C6 18 12 32 8 50 S11 82 9 100" vectorEffect="non-scaling-stroke" />
          <path d="M17 0 C20 22 14 40 18 58 S15 86 18 100" vectorEffect="non-scaling-stroke" />
          <path d="M22 0 C24 30 21 60 23 100" vectorEffect="non-scaling-stroke" />
        </g>
      </svg>
      <div className="absolute inset-y-2 left-1.5 w-1.5 rounded-full bg-white/25 blur-[1px]" />
    </div>
  );
}

// 마디 모양. 채움은 CSS radial-gradient로 왼쪽 위가 밝은 클레이 음영을 낸다.
const WOOD = {
  background: "radial-gradient(circle at 35% 28%, #f4e0c2 0%, #e4c49a 55%, #d2ab7c 100%)",
  borderColor: "#b7895b",
};
const RED = {
  background: "radial-gradient(circle at 35% 28%, #f5746d 0%, #e0312b 55%, #c42620 100%)",
  borderColor: "#a61f1b",
};

function UnitNode({ unit, expanded, onClick }: { unit: PathUnit; expanded: boolean; onClick: () => void }) {
  const { kind } = unit;
  const pecked = kind === "done" || kind === "fading";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-label={`${unit.title} · ${KIND_LABEL[kind]}`}
      data-unit-node={unit.id}
      className={`relative block size-[72px] rounded-full border-b-[6px] transition-[translate,scale] duration-200 active:translate-y-1 active:border-b-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand ${
        kind === "doing" ? "node-pulse" : ""
      }`}
      style={kind === "doing" ? RED : WOOD}
    >
      <svg viewBox="0 0 72 66" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <radialGradient id={`hole-${unit.id}`} cx="0.6" cy="0.65" r="0.75">
            <stop offset="0" stopColor="#4a2f1c" />
            <stop offset="1" stopColor="#7b5236" />
          </radialGradient>
          <filter id={`soft-${unit.id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        {kind !== "doing" && (
          // 나이테
          <g fill="none" stroke="#96683f" strokeOpacity={pecked ? 0.2 : 0.32} strokeWidth="1.6">
            <circle cx="36" cy="33" r="23" />
            <circle cx="36" cy="33" r="15" />
            {!pecked && <circle cx="36" cy="33" r="7.5" />}
          </g>
        )}
        {!pecked && kind !== "doing" && <circle cx="36" cy="33" r="2.4" fill="#96683f" fillOpacity="0.4" />}
        {pecked && (
          // 딱따구리가 쪼아서 난 구멍 + 아래쪽 밝은 테두리
          <g>
            <ellipse cx="36" cy="34" rx="13" ry="16" fill={`url(#hole-${unit.id})`} />
            <path d="M24.5 40 Q36 55 47.5 40" fill="none" stroke="#f3d8b0" strokeWidth="2.6" strokeLinecap="round" />
          </g>
        )}
        {/* 윗부분 광택 */}
        <ellipse cx="26" cy="17" rx="12" ry="6" fill="#fff" opacity="0.55" filter={`url(#soft-${unit.id})`} />
      </svg>

      {kind === "doing" && (
        <Pencil className="absolute left-1/2 top-[45%] size-8 -translate-x-1/2 -translate-y-1/2 text-white" strokeWidth={2.5} />
      )}

      {pecked && <LeafBadge color={leafColor(unit.memory?.percent ?? 100)} />}

      {kind === "review" && (
        <span className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full border-2 border-paper bg-brand text-sm font-black text-white shadow-sm">
          !
        </span>
      )}
    </button>
  );
}

// 할 일 마디의 축소판(나이테가 있는 나무 옹이). 길 내기 미리보기·대기 연출에서 쓴다.
export function MiniKnot({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`relative block shrink-0 rounded-full ${className}`}
      style={{ ...WOOD, width: size, height: size, borderBottomWidth: Math.max(2, Math.round(size / 12)), borderStyle: "solid" }}
    >
      <svg viewBox="0 0 28 26" className="absolute inset-0 h-full w-full">
        <g fill="none" stroke="#96683f" strokeOpacity="0.35" strokeWidth="1.2">
          <circle cx="14" cy="13" r="8.5" />
          <circle cx="14" cy="13" r="4.5" />
        </g>
        <ellipse cx="9.5" cy="6.5" rx="4.5" ry="2.2" fill="#fff" opacity="0.55" />
      </svg>
    </span>
  );
}

// 왼쪽 아래 도토리 뱃지: 누르면 자료 곳간으로 가서 이 단원 자료만 잠깐 강조한다(materials_new가 이벤트를 받는다).
function AcornBadge({ unit }: { unit: PathUnit }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("f5:show-materials", { detail: unit.id }))}
      aria-label={`${unit.title} 강의자료 ${unit.materials}개 보기`}
      className="absolute -bottom-2 -left-3 z-10 flex items-center gap-0.5 rounded-full bg-white py-0.5 pl-1 pr-1.5 text-[11px] font-bold tabular-nums text-amber-800 shadow-sm hover:bg-amber-50"
    >
      <AcornIcon />
      {unit.materials}
    </button>
  );
}

// 오른쪽 위 잎 뱃지 (체크)
function LeafBadge({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 32 32" className="absolute -right-2.5 -top-2.5 size-9 drop-shadow-sm" aria-hidden>
      <path d="M6 27 C3 15 10 5 27 4 C28 20 20 29 6 27 Z" fill={color} stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
      <path d="M7 26 C12 20 17 15 22 10" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11.5 16.5 l3.5 3.5 l6.5 -7.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AcornIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
      <ellipse cx="8" cy="10" rx="4.6" ry="5" fill="#c9884d" />
      <ellipse cx="6.6" cy="9" rx="1.4" ry="2" fill="#fff" opacity="0.35" />
      <path d="M2.6 7.2 C3 3.6 13 3.6 13.4 7.2 C11 8.4 5 8.4 2.6 7.2 Z" fill="#8a5a35" />
      <path d="M8 3.8 V1.6" stroke="#8a5a35" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// 노드 위 작은 말풍선
function NodeTag({ tone, children }: { tone: "here" | "review"; children: React.ReactNode }) {
  return (
    <span
      className={`absolute -top-10 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-xl px-2.5 py-1 text-xs font-black shadow-sm ${
        tone === "here" ? "bg-white text-brand" : "bg-amber-400 text-amber-950"
      }`}
    >
      {children}
      <span
        className={`absolute -bottom-1 left-1/2 size-2.5 -translate-x-1/2 rotate-45 ${tone === "here" ? "bg-white" : "bg-amber-400"}`}
        aria-hidden
      />
    </span>
  );
}

// 줄기에 매달린 딱따구리. side: 노드의 어느 쪽에 붙는지(-1 왼쪽, 1 오른쪽)
function Woodpecker({ side }: { side: -1 | 1 }) {
  return (
    <Image
      src="/mascot_new.png"
      alt="지금 여기 있는 딱따구리"
      width={56}
      height={83}
      className="mascot-hop pointer-events-none absolute top-[-6px] z-10 drop-shadow-[0_4px_4px_rgb(60_40_20/0.25)]"
      style={{ left: `calc(50% + ${side * 72}px - 28px)` }}
    />
  );
}

// 경로 끝: 보스 매가 기다리는 둥지
function BossNest({
  examDate,
  daysLeft,
  defeated,
  children,
}: {
  examDate: string | null;
  daysLeft: number | null;
  defeated: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li id="unit-path-end" className="relative flex w-40 flex-col items-center pt-2">
      {children}
      <div
        className="relative size-24 rounded-full border-b-[6px] border-[#6f4b2f]"
        style={{ background: "radial-gradient(circle at 38% 30%, #d9b287 0%, #b98a5e 58%, #8f6443 100%)" }}
      >
        <svg viewBox="0 0 96 90" className="absolute inset-0 h-full w-full" aria-hidden>
          {/* 둥지 안쪽 그늘 */}
          <ellipse cx="48" cy="44" rx="31" ry="27" fill="#5d3d25" />
          {/* 엮은 나뭇가지 */}
          <g fill="none" strokeLinecap="round">
            <path d="M12 40 Q48 20 84 40" stroke="#e8c79c" strokeWidth="2.5" opacity="0.8" />
            <path d="M10 52 Q48 30 86 52" stroke="#7a5236" strokeWidth="2" opacity="0.6" />
          </g>
        </svg>
        <Image
          src="/hawk_new.png"
          alt="보스 매"
          width={46}
          height={71}
          className={`absolute bottom-5 left-1/2 -ml-[23px] ${defeated ? "boss-defeated" : "boss-hover"}`}
        />
        {/* 둥지 앞 테두리가 매 발을 덮는다 */}
        <svg viewBox="0 0 96 90" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          <path d="M14 58 Q48 86 82 58 Q84 74 70 80 Q48 90 26 80 Q12 74 14 58 Z" fill="#a8784f" />
          <g fill="none" stroke="#e8c79c" strokeWidth="2" strokeLinecap="round" opacity="0.8">
            <path d="M20 66 Q48 84 76 66" />
            <path d="M28 76 Q48 86 68 76" stroke="#7a5236" opacity="0.55" />
          </g>
          <ellipse cx="30" cy="22" rx="12" ry="5" fill="#fff" opacity="0.35" />
        </svg>
        {defeated && (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded border-2 border-emerald-600 bg-white/85 px-1.5 text-sm font-black text-emerald-700">
            격파!
          </span>
        )}
      </div>
      <span className="mt-2 flex flex-wrap items-center justify-center gap-1.5 rounded-lg bg-paper/90 px-1.5 text-sm font-semibold text-ink">
        {examDate ? `시험 ${examDate.slice(5).replace("-", "/")}` : "시험일 미정"}
        {daysLeft !== null && <DDayBadge days={daysLeft} />}
      </span>
    </li>
  );
}

// 단원이 없을 때: 짧은 줄기 위의 알
function EmptyPath() {
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <div className="relative flex flex-col items-center">
        <Image src="/mascot-egg_new.png" alt="" width={70} height={90} className="pet-egg-wobble relative z-10" />
        <Trunk className="relative -mt-3 h-20" />
      </div>
      <p className="max-w-xs break-keep text-zinc-600">
        아직 길이 없어요. 아래에서 단원을 만들면 딱따구리가 길을 내줄게요
      </p>
      <Link href="#unit-setup" className={buttonClass({ variant: "primary", size: "md" })}>
        길 내러 가기
      </Link>
    </div>
  );
}
