"use client";

import { useState, useTransition } from "react";
import { makeQuiz, submitQuiz, type QuizQuestion } from "@/app/quiz-actions_new";
import { MascotSays } from "@/components/mascot_new";

type Phase =
  | { step: "idle" }
  | { step: "solving"; questions: QuizQuestion[]; picks: (number | null)[] }
  | {
      step: "graded";
      questions: QuizQuestion[];
      picks: number[];
      score: number;
      passed: boolean;
      saveError: string | null;
    };

// 단원 AI 퀴즈: 5문제 생성 → 풀기 → 채점. 3개 이상 맞히면 단원이 완료된다.
export function Quiz({ unitId }: { unitId: string }) {
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const start = () =>
    startTransition(async () => {
      setError(null);
      const res = await makeQuiz(unitId);
      if ("error" in res) setError(res.error);
      else setPhase({ step: "solving", questions: res.questions, picks: res.questions.map(() => null) });
    });

  const grade = (questions: QuizQuestion[], picks: number[]) =>
    startTransition(async () => {
      const score = questions.filter((q, i) => q.answer === picks[i]).length;
      const res = await submitQuiz(unitId, score);
      setPhase({ step: "graded", questions, picks, score, passed: res.passed && !res.error, saveError: res.error });
    });

  if (phase.step === "idle") {
    return (
      <div className="flex flex-col gap-2">
        {pending ? (
          <MascotSays size="sm">문제 만드는 중이에요… 콕콕콕 🪵</MascotSays>
        ) : (
          <button
            onClick={start}
            className="h-9 rounded-full bg-violet-600 text-sm font-medium text-white transition-colors hover:bg-violet-500"
          >
            {error ? "다시 시도" : "AI 퀴즈 풀기 (5문제)"}
          </button>
        )}
        {error && !pending && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  const { questions } = phase;
  const graded = phase.step === "graded";
  const picks = phase.picks;
  const allPicked = picks.every((p) => p !== null);

  return (
    <div className="flex flex-col gap-4">
      {questions.map((q, i) => (
        <fieldset key={i} className="flex flex-col gap-1.5">
          <legend className="mb-1.5 font-medium text-zinc-900">
            {i + 1}. {q.question}
          </legend>
          {q.choices.map((c, j) => {
            const picked = picks[i] === j;
            const tone = !graded
              ? picked
                ? "border-violet-500 bg-violet-50"
                : "border-zinc-200 hover:bg-zinc-50"
              : j === q.answer
                ? "border-emerald-500 bg-emerald-50"
                : picked
                  ? "border-red-400 bg-red-50"
                  : "border-zinc-200 text-zinc-400";
            return (
              <label
                key={j}
                className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 ${tone} ${
                  graded ? "cursor-default" : ""
                }`}
              >
                <input
                  type="radio"
                  name={`${unitId}-q${i}`}
                  checked={picked}
                  disabled={graded || pending}
                  onChange={() =>
                    phase.step === "solving" &&
                    setPhase({ ...phase, picks: picks.map((p, k) => (k === i ? j : p)) })
                  }
                  className="mt-1 accent-violet-600"
                />
                <span>{c}</span>
              </label>
            );
          })}
          {graded && (
            <p className="text-zinc-600">
              {picks[i] === q.answer ? "⭕" : "❌"} {q.explanation}
            </p>
          )}
        </fieldset>
      ))}

      {phase.step === "solving" ? (
        <button
          onClick={() => grade(questions, picks as number[])}
          disabled={!allPicked || pending}
          className="h-9 rounded-full bg-zinc-900 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40"
        >
          {pending ? "채점 중…" : allPicked ? "채점하기" : "모든 문제를 골라 주세요"}
        </button>
      ) : (
        <>
          <MascotSays size="sm" mood={phase.passed ? "sunny" : "rainy"}>
            <span className="font-semibold">
              {phase.score}/{questions.length} {phase.passed ? "통과! 🎉" : "아쉬워요"}
            </span>
            <br />
            {phase.passed
              ? "단원을 완료했어요. 솔방울 하나 받았어요!"
              : "3개 이상 맞히면 통과예요. 틀린 문제 해설을 보고 다시 도전해요."}
          </MascotSays>
          {phase.saveError && <p className="text-sm text-red-600">{phase.saveError}</p>}
          <button
            onClick={start}
            disabled={pending}
            className="h-9 rounded-full border border-zinc-300 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50"
          >
            {pending ? "문제 만드는 중…" : "새 문제로 다시 풀기"}
          </button>
          {error && !pending && <p className="text-sm text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}
