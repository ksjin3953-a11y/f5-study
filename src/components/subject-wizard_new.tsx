"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { FileText, PencilLine, X } from "lucide-react";
import { createSubject, type SubjectFormState } from "@/app/subject-actions_new";
import { addDays } from "@/lib/plan_new";
import { daysUntil, todayInSeoul, type Weather } from "@/lib/weather_new";
import { MascotSays } from "@/components/mascot_new";
import { DDayBadge } from "@/components/dday-badge_new";
import { Button } from "@/components/ui-button_new";

// 과목 추가: 한 화면에 질문 하나씩. ① 과목명 → ② 시험일(제출) → ③ 보스 등장
// 입력칸은 모든 단계에서 DOM에 남겨 두고(숨김) 한 <form>으로 제출한다.

const initialState: SubjectFormState = { error: null };
const QUICK_WEEKS = [1, 2, 4, 8];

// 남은 기간에 따른 딱따구리 반응
function examMood(days: number): { mood: Weather["tone"]; text: string } {
  if (days <= 7) return { mood: "stormy", text: "헉, 얼마 안 남았잖아!" };
  if (days <= 21) return { mood: "rainy", text: "지금부터 달려야 해" };
  return { mood: "sunny", text: "여유 있을 때 시작하자!" };
}

export function SubjectWizard() {
  const [state, formAction, pending] = useActionState(createSubject, initialState);
  const [step, setStep] = useState<0 | 1>(0);
  const [name, setName] = useState("");
  const [professor, setProfessor] = useState("");
  const [examDate, setExamDate] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  const today = todayInSeoul();
  const done = Boolean(state.id);
  const days = examDate ? daysUntil(examDate) : null;
  const nameValid = name.trim().length > 0;
  const dateValid = days !== null && days >= 0;

  // "아직 몰라요": 날짜 칸을 바로 비운 뒤(flushSync) 시험일 없이 제출한다.
  const submitWithoutDate = () => {
    flushSync(() => setExamDate(""));
    formRef.current?.requestSubmit();
  };

  const next = () => {
    if (step === 0 && nameValid) setStep(1);
    else if (step === 1 && dateValid && !pending) formRef.current?.requestSubmit(submitRef.current);
  };

  const progress = done ? 100 : step === 0 ? 33 : 66;

  return (
    <form
      ref={formRef}
      action={formAction}
      // Enter는 항상 직접 처리한다(기본 제출은 "아직 몰라요" 버튼이 먼저 눌릴 수 있어서).
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
          e.preventDefault();
          next();
        }
      }}
      className="flex min-h-dvh flex-1 flex-col"
    >
      {/* 맨 위: 나가기 + 진행 바 */}
      <header className="mx-auto flex w-full max-w-[640px] items-center gap-4 px-4 pb-2 pt-[calc(1rem+env(safe-area-inset-top))]">
        <Link href="/" aria-label="나가기" className="-m-2 rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
          <X className="size-7" strokeWidth={2.5} />
        </Link>
        <div
          className={`h-4 flex-1 overflow-hidden rounded-full bg-zinc-200/80 transition-opacity delay-700 duration-500 motion-reduce:transition-none ${
            done ? "opacity-0" : ""
          }`}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="진행"
        >
          <div
            className="relative h-full rounded-full bg-forest transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          >
            {/* 윗부분 광택 */}
            <span className="absolute inset-x-2 top-1 h-1 rounded-full bg-white/30" />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-8">
        {/* ① 과목명 */}
        <section hidden={done || step !== 0} className="flex flex-col gap-6">
          <MascotSays size="lg" mood="sunny">
            <span className="text-base font-bold">어떤 과목이야?</span>
          </MascotSays>
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="자료구조"
            autoFocus
            autoComplete="off"
            aria-label="과목명"
            className="field"
          />
          <label className="flex flex-col gap-2 text-sm text-zinc-500">
            교수님 성함도 적어둘래? (선택)
            <input
              name="professor"
              value={professor}
              onChange={(e) => setProfessor(e.target.value)}
              placeholder="김교수"
              autoComplete="off"
              className="field h-12 text-base"
            />
          </label>
        </section>

        {/* ② 시험일 */}
        <section hidden={done || step !== 1} className="flex flex-col gap-6">
          <MascotSays size="lg" mood={days !== null && days >= 0 ? examMood(days).mood : "sunny"}>
            <span className="text-base font-bold">시험은 언제야?</span>
            {days !== null && days >= 0 && <span className="mt-0.5 block">{examMood(days).text}</span>}
          </MascotSays>

          <div className="flex flex-wrap gap-2" role="group" aria-label="빠른 선택">
            {QUICK_WEEKS.map((w) => {
              const date = addDays(today, w * 7);
              const selected = examDate === date;
              return (
                <button
                  key={w}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setExamDate(date)}
                  className={`h-10 rounded-full px-4 text-sm font-bold transition-colors ${
                    selected ? "bg-brand-light text-brand" : "bg-field text-zinc-600 hover:bg-zinc-200/70"
                  }`}
                >
                  {w}주 뒤
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <input
              name="exam_date"
              type="date"
              min={today}
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              aria-label="시험일"
              className="field flex-1"
            />
            {days !== null && days >= 0 && <DDayBadge days={days} />}
          </div>

          <button
            type="button"
            onClick={submitWithoutDate}
            disabled={pending}
            className="w-fit text-sm font-bold text-zinc-400 underline-offset-4 hover:text-zinc-600 hover:underline"
          >
            아직 몰라요
          </button>

          {state.error && (
            <MascotSays mood="rainy" size="sm">
              {state.error}
            </MascotSays>
          )}
        </section>

        {/* ③ 보스 등장 */}
        {done && state.id && <BossIntro id={state.id} name={name.trim()} days={days} />}
      </main>

      {/* 맨 아래 고정 "다음" */}
      <footer
        hidden={done}
        className="fixed inset-x-0 bottom-0 border-t border-zinc-200/80 bg-paper px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4"
      >
        <div className="mx-auto max-w-[560px]">
          {/* 제출은 ②에서만. ①의 "다음"은 단계만 넘긴다. */}
          <Button
            ref={submitRef}
            type={step === 1 ? "submit" : "button"}
            onClick={step === 0 ? next : undefined}
            disabled={step === 0 ? !nameValid : pending || !dateValid}
            variant="primary"
            size="md"
            className="w-full"
          >
            {step === 0 ? "다음" : pending ? "만드는 중…" : "과목 만들기"}
          </Button>
        </div>
      </footer>
    </form>
  );
}

function BossIntro({ id, name, days }: { id: string; name: string; days: number | null }) {
  return (
    <section className="flex flex-col items-center gap-6 pt-4 text-center">
      <div className="hawk-swoop">
        <Image
          src="/hawk_new.png"
          alt="보스 매"
          width={140}
          height={217}
          priority
          className="boss-hover"
          style={{ animationDelay: "0.5s" }}
        />
      </div>

      <div className="boss-reveal flex flex-col items-center gap-2">
        <h1 className="font-display text-4xl text-ink">새로운 보스 등장!</h1>
        <p className="flex flex-wrap items-center justify-center gap-2 text-zinc-600">
          {name} 시험 날, 매가 찾아와요
          {days !== null && <DDayBadge days={days} />}
        </p>
        {days === null && (
          <MascotSays size="sm" className="mt-2 text-left">
            시험일을 정하면 매가 언제 오는지 알려줄게
          </MascotSays>
        )}
      </div>

      <div className="boss-reveal flex w-full flex-col gap-3 text-left">
        <SetupChoice
          href={`/subjects/${id}?setup=pdf`}
          icon={<FileText className="size-6 text-brand" aria-hidden />}
          title="강의계획서로 단원 만들기"
          desc="PDF를 올리면 AI가 단원을 뽑아줘요"
          tint="bg-brand-light"
        />
        <SetupChoice
          href={`/subjects/${id}?setup=manual`}
          icon={<PencilLine className="size-6 text-forest" aria-hidden />}
          title="단원 직접 입력하기"
          desc="한 줄에 하나씩 적으면 돼요"
          tint="bg-forest-light"
        />
      </div>

      <Link href="/" className="boss-reveal text-sm font-bold text-zinc-400 underline-offset-4 hover:text-zinc-600 hover:underline">
        나중에 할게요
      </Link>
    </section>
  );
}

function SetupChoice({
  href,
  icon,
  title,
  desc,
  tint,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  tint: string;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-4 rounded-3xl p-5 transition-[filter] hover:brightness-95 ${tint}`}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/80">{icon}</span>
      <span className="flex min-w-0 flex-col">
        <span className="text-lg font-bold">{title}</span>
        <span className="text-sm text-zinc-600">{desc}</span>
      </span>
    </Link>
  );
}
