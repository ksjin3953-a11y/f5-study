"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, CircleX, NotebookPen, X } from "lucide-react";
import { makeQuiz, submitQuiz, type QuizQuestion } from "@/app/quiz-actions_new";
import { MascotSays } from "@/components/mascot_new";
import { Button } from "@/components/ui-button_new";
import { FOODS } from "@/lib/game_new";

// 단원 AI 퀴즈를 듀오링고식 레슨으로: 한 화면에 한 문제 → 확인 → 결과 바 → 마지막에 채점.
// 문제 생성(makeQuiz)·채점(맞힌 개수 → submitQuiz, 3/5 통과)은 예전과 같다.

type Phase =
  | { step: "loading" }
  | { step: "error"; message: string }
  | { step: "solving"; questions: QuizQuestion[]; sources: string[]; picks: (number | null)[]; index: number; checked: boolean }
  | { step: "grading"; questions: QuizQuestion[]; sources: string[] }
  | {
      step: "result";
      questions: QuizQuestion[];
      sources: string[];
      score: number;
      passed: boolean;
      wasDone: boolean;
      nextReviewDays?: number;
      saveError: string | null;
    };

const HP_PER_UNIT = 1000;

export function QuizLesson({
  unitId,
  review,
  boss,
  onClose,
}: {
  unitId: string;
  review: boolean; // 끝낸 단원의 복습 퀴즈인지 (머리말만 다르다)
  boss: { remaining: number; total: number };
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ step: "loading" });
  // 결과 화면의 HP 연출은 퀴즈를 연 순간의 보스 HP에서 시작한다(채점 뒤 새로고침된 값이 아니라).
  const [bossAtStart] = useState(boss);
  const started = useRef(false);

  const load = useCallback(() => {
    makeQuiz(unitId).then((res) =>
      setPhase(
        "error" in res
          ? { step: "error", message: res.error }
          : { step: "solving", questions: res.questions, sources: res.sources, picks: res.questions.map(() => null), index: 0, checked: false }
      )
    );
  }, [unitId]);

  useEffect(() => {
    if (started.current) return; // 개발 모드에서 두 번 부르지 않게
    started.current = true;
    load();
  }, [load]);

  // 레슨 중에는 페이지 스크롤을 막고, 매 도발이 뜨지 않게 표시해 둔다(hawk-taunt가 이 표시를 본다).
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    root.dataset.lesson = "open";
    return () => {
      root.style.overflow = prev;
      delete root.dataset.lesson;
    };
  }, []);

  const restart = () => {
    setPhase({ step: "loading" });
    load();
  };

  const grade = (questions: QuizQuestion[], sources: string[], picks: number[]) => {
    setPhase({ step: "grading", questions, sources });
    const score = questions.filter((q, i) => q.answer === picks[i]).length;
    submitQuiz(unitId, score).then((res) =>
      setPhase({
        step: "result",
        questions,
        sources,
        score,
        passed: res.passed && !res.error,
        wasDone: !!res.wasDone,
        nextReviewDays: res.nextReviewDays,
        saveError: res.error,
      })
    );
  };

  const total = "questions" in phase ? phase.questions.length : 5;
  const progress =
    phase.step === "solving"
      ? ((phase.index + (phase.checked ? 1 : 0)) / total) * 100
      : phase.step === "grading" || phase.step === "result"
        ? 100
        : 0;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-paper" role="dialog" aria-modal="true" aria-label={review ? "복습 퀴즈" : "AI 퀴즈"}>
      <header className="mx-auto flex w-full max-w-[640px] shrink-0 items-center gap-4 px-4 pb-2 pt-[calc(1rem+env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} aria-label="닫기" className="-m-2 rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
          <X className="size-7" strokeWidth={2.5} />
        </button>
        <div
          className="h-4 flex-1 overflow-hidden rounded-full bg-zinc-200/80"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="진행"
        >
          <div
            className="relative h-full rounded-full bg-forest transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          >
            <span className="absolute inset-x-2 top-1 h-1 rounded-full bg-white/30" />
          </div>
        </div>
      </header>

      {phase.step === "loading" && <Pecking />}
      {phase.step === "grading" && <Pecking text="채점하는 중…" />}

      {phase.step === "error" && (
        <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center gap-6 px-4 pb-10">
          <MascotSays size="lg" mood="rainy">
            {phase.message}
          </MascotSays>
          <div className="flex gap-2">
            <Button type="button" onClick={onClose} variant="neutral" size="md" className="flex-1">
              닫기
            </Button>
            <Button type="button" onClick={restart} variant="primary" size="md" className="flex-[2]">
              다시 시도
            </Button>
          </div>
        </main>
      )}

      {phase.step === "solving" && (
        <Question
          phase={phase}
          onPick={(j) => setPhase({ ...phase, picks: phase.picks.map((p, k) => (k === phase.index ? j : p)) })}
          onCheck={() => setPhase({ ...phase, checked: true })}
          onContinue={() =>
            phase.index < phase.questions.length - 1
              ? setPhase({ ...phase, index: phase.index + 1, checked: false })
              : grade(phase.questions, phase.sources, phase.picks as number[])
          }
        />
      )}

      {phase.step === "result" && <Result phase={phase} boss={bossAtStart} onRetry={restart} onClose={onClose} />}
    </div>,
    document.body
  );
}

// 문제 만드는 중: 딱따구리가 나무를 콕콕
function Pecking({ text = "문제 만드는 중이에요… 콕콕콕" }: { text?: string }) {
  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col items-center justify-center gap-6 px-4 pb-16 text-center">
      <div className="relative flex items-end">
        <Image src="/mascot_new.png" alt="" width={110} height={163} priority className="mascot-peck relative z-10" />
        <span className="peck-pop absolute -right-2 top-4 z-20 font-display text-2xl text-brand">콕!</span>
        <div
          className="-ml-3 h-44 w-9 rounded-full"
          style={{ background: "linear-gradient(90deg, #c08a5e 0%, #b07b50 55%, #9a6a45 100%)" }}
          aria-hidden
        />
      </div>
      <div className="flex flex-col gap-1" role="status">
        <p className="text-lg font-bold">{text}</p>
        {text.startsWith("문제") && <p className="text-sm text-zinc-500">강의자료를 읽으면 30초쯤 걸려요</p>}
      </div>
    </main>
  );
}

type Solving = Extract<Phase, { step: "solving" }>;

function Question({
  phase,
  onPick,
  onCheck,
  onContinue,
}: {
  phase: Solving;
  onPick: (j: number) => void;
  onCheck: () => void;
  onContinue: () => void;
}) {
  const q = phase.questions[phase.index];
  const pick = phase.picks[phase.index];
  const correct = pick === q.answer;
  const last = phase.index === phase.questions.length - 1;

  // Enter: 고른 뒤엔 확인, 확인한 뒤엔 계속하기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || pick === null) return;
      e.preventDefault();
      if (phase.checked) onContinue();
      else onCheck();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pick, phase.checked, onCheck, onContinue]);

  return (
    <>
      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-6 px-4 pb-72 pt-6">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold text-zinc-400">
            문제 {phase.index + 1}/{phase.questions.length}
          </span>
          <h2 className="break-keep text-xl font-bold leading-snug">{q.question}</h2>
        </div>
        <div role="radiogroup" aria-label="보기" className="flex flex-col gap-3">
          {q.choices.map((c, j) => {
            const picked = pick === j;
            const tone = !phase.checked
              ? picked
                ? "border-sky bg-sky/15 text-ink"
                : "border-[#e2d8ca] bg-field text-ink hover:bg-[#ede6dc]"
              : j === q.answer
                ? "border-forest bg-forest-light text-forest-dark"
                : picked
                  ? "border-brand bg-brand-light text-brand-dark"
                  : "border-[#e2d8ca] bg-field text-zinc-400";
            return (
              <button
                key={j}
                type="button"
                role="radio"
                aria-checked={picked}
                disabled={phase.checked}
                onClick={() => onPick(j)}
                className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border-b-4 px-4 py-3 text-left text-base font-semibold transition-colors ${tone}`}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/70 text-sm font-bold tabular-nums">
                  {j + 1}
                </span>
                <span className="break-keep">{c}</span>
              </button>
            );
          })}
        </div>
      </main>

      {/* 하단: 확인 → 결과 바 */}
      {!phase.checked ? (
        <footer className="fixed inset-x-0 bottom-0 border-t border-zinc-200/80 bg-paper px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
          <div className="mx-auto max-w-[560px]">
            <Button type="button" onClick={onCheck} disabled={pick === null} variant="primary" size="md" className="w-full">
              확인
            </Button>
          </div>
        </footer>
      ) : (
        <footer
          className={`sheet-up fixed inset-x-0 bottom-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-5 ${
            correct ? "bg-forest-light" : "bg-brand-light"
          }`}
          role="status"
        >
          <div className="mx-auto flex max-w-[560px] flex-col gap-4">
            <div className="flex items-start gap-3">
              {correct ? (
                <Image src="/mascot_new.png" alt="" width={40} height={59} className="mascot-hop shrink-0" />
              ) : (
                <CircleX className="size-9 shrink-0 text-brand" aria-hidden />
              )}
              <div className="flex min-w-0 flex-col gap-1">
                <p className={`text-xl font-black ${correct ? "text-forest-dark" : "text-brand-dark"}`}>
                  {correct ? "잘했어!" : `정답: ${q.choices[q.answer]}`}
                </p>
                {!correct && q.explanation && (
                  <p className="break-keep text-sm leading-relaxed text-brand-dark/90">{q.explanation}</p>
                )}
              </div>
            </div>
            <Button type="button" onClick={onContinue} variant={correct ? "success" : "primary"} size="md" className="w-full">
              {last ? "결과 보기" : "계속하기"}
            </Button>
          </div>
        </footer>
      )}
    </>
  );
}

type ResultPhase = Extract<Phase, { step: "result" }>;

function Result({
  phase,
  boss,
  onRetry,
  onClose,
}: {
  phase: ResultPhase;
  boss: { remaining: number; total: number };
  onRetry: () => void;
  onClose: () => void;
}) {
  // 새로 끝낸 단원이면 보스 HP가 1단원만큼 줄어드는 연출
  const hits = phase.passed && !phase.wasDone && boss.remaining > 0;
  const [drained, setDrained] = useState(false);
  useEffect(() => {
    if (!hits) return;
    const t = setTimeout(() => setDrained(true), 500);
    return () => clearTimeout(t);
  }, [hits]);
  const hp = hits && drained ? boss.remaining - 1 : boss.remaining;
  // 통과하면 솔방울(퀴즈 통과), 새로 끝낸 단원이면 곤충(단원 완료)도 받는다.
  const foods = phase.passed ? (phase.wasDone ? (["pinecone"] as const) : (["insect", "pinecone"] as const)) : [];

  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col items-center gap-6 px-4 pb-12 pt-4 text-center">
      {phase.passed ? (
        <>
          <Image src="/mascot_new.png" alt="신난 딱따구리" width={140} height={208} priority className="mascot-hop" />
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-4xl">통과!</h2>
            <p className="text-zinc-600">
              {phase.questions.length}문제 중 {phase.score}개 맞혔어요
            </p>
          </div>

          {phase.wasDone ? (
            phase.nextReviewDays ? (
              <p className="rounded-2xl bg-forest-light px-4 py-3 font-bold text-forest-dark">
                기억이 {phase.nextReviewDays}일 더 오래가요
              </p>
            ) : null
          ) : hits ? (
            <div className="flex w-full flex-col items-center gap-2">
              <p className="hp-float font-display text-3xl text-brand-dark">매 HP -{HP_PER_UNIT.toLocaleString("en-US")}!</p>
              <div className="flex w-full max-w-sm items-center gap-3 rounded-2xl bg-boss px-4 py-3">
                <Image src="/hawk_new.png" alt="" width={28} height={43} />
                <div className="flex flex-1 flex-col gap-1 text-left">
                  <div className="h-3 overflow-hidden rounded-full bg-[#3a3439]">
                    <div
                      className="h-full rounded-full bg-gradient-to-b from-[#ff5a67] to-[#d8303f] transition-[width] duration-1000 ease-out motion-reduce:transition-none"
                      style={{ width: `${boss.total ? (hp / boss.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="font-display text-xs tabular-nums text-white">
                    HP {(hp * HP_PER_UNIT).toLocaleString("en-US")} / {(boss.total * HP_PER_UNIT).toLocaleString("en-US")}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {foods.length > 0 && (
            <ul className="flex gap-3" aria-label="받은 먹이">
              {foods.map((f) => (
                <li key={f} className="flex items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-sm font-bold">
                  <Image src={FOODS[f].image} alt="" width={28} height={28} className="size-7 object-contain" />
                  {FOODS[f].name} +1
                </li>
              ))}
            </ul>
          )}

          <Button type="button" onClick={onClose} variant="success" size="md" className="w-full">
            계속하기
          </Button>
        </>
      ) : (
        <>
          <div className="self-stretch text-left">
            <MascotSays size="lg" mood="rainy">
              <span className="font-bold">3개 이상 맞혀야 해. 다시 해볼까?</span>
              <span className="mt-0.5 block text-zinc-500">
                {phase.questions.length}문제 중 {phase.score}개 맞혔어요
              </span>
            </MascotSays>
          </div>
          <div className="flex w-full gap-2">
            <Button type="button" onClick={onClose} variant="neutral" size="md" className="flex-1">
              나중에
            </Button>
            <Button type="button" onClick={onRetry} variant="primary" size="md" className="flex-[2]">
              다시 풀기
            </Button>
          </div>
        </>
      )}

      {phase.saveError && (
        <div className="self-stretch text-left">
          <MascotSays size="sm" mood="rainy">
            {phase.saveError}
          </MascotSays>
        </div>
      )}

      <p className="flex items-start gap-1.5 text-left text-xs text-zinc-400">
        {phase.sources.length ? (
          <>
            <BookOpen className="mt-px size-3.5 shrink-0" aria-hidden />
            강의자료 기반: {phase.sources.join(", ")}
          </>
        ) : (
          <>
            <NotebookPen className="mt-px size-3.5 shrink-0" aria-hidden />
            단원명 기반 문제예요. 강의자료를 올리면 수업 내용으로 출제해요.
          </>
        )}
      </p>
    </main>
  );
}
