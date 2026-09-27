import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server_new";
import { UnitSetup } from "@/components/unit-setup_new";
import { Materials } from "@/components/materials_new";
import { MascotSays } from "@/components/mascot_new";
import { BossPanel } from "@/components/boss-panel_new";
import { daysUntil, isDone, needsReview, studyWeather } from "@/lib/weather_new";
import { DDayBadge } from "@/components/dday-badge_new";
import { HawkTaunt } from "@/components/hawk-taunt_new";
import { DeleteSubject } from "@/components/delete-subject_new";
import { AppShell } from "@/components/app-shell_new";
import { WeatherIcon } from "@/components/weather-icon_new";
import { UnitPath, type PathUnit } from "@/components/unit-path_new";
import { lastStudyAt, petNameOf } from "@/lib/game_new";
import { memoryOf } from "@/lib/memory_new";
import type { UnitStatus } from "@/app/unit-actions_new";

export default async function SubjectPage({ params, searchParams }: PageProps<"/subjects/[id]">) {
  const { id } = await params;
  // 과목 추가 흐름에서 넘어오면 단원 만들기 탭을 골라 연다 (?setup=pdf | manual)
  const { setup: setupParam } = await searchParams;
  const setup = setupParam === "pdf" || setupParam === "manual" ? setupParam : null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: subject } = await supabase
    .from("subjects")
    .select("id, name, professor, exam_date, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!subject) notFound();

  const { data: units } = await supabase
    .from("units")
    .select(
      "id, title, status, completed_at, study_logs(id, studied_at, memo), quiz_results(score, total, passed, created_at)"
    )
    .eq("subject_id", id)
    .order("position");

  // 강의자료. materials 테이블이 아직 없으면(SQL 미실행) 안내만 보여 준다.
  const { data: materials, error: materialsError } = await supabase
    .from("materials")
    .select("id, name, size, unit_id")
    .eq("subject_id", id)
    .eq("kind", "lecture")
    .order("created_at");
  if (materialsError) console.error("materials unavailable:", materialsError.message);

  const total = units?.length ?? 0;
  const done = units?.filter(isDone).length ?? 0;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const weather = studyWeather({ ...subject, units: units ?? [] });
  const daysLeft = subject.exam_date ? daysUntil(subject.exam_date) : null;
  const lastStudy = lastStudyAt(units ?? []);

  // 보스가 흥분하는 조건은 BossPanel과 같다: 시험 7일 이내 + HP 50% 이상 남음
  const remaining = total - done;
  const hawkAngry =
    remaining > 0 && daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && total > 0 && remaining / total >= 0.5;

  // 나무 경로에 넘길 단원 정보. 상태 판단은 기존 lib 함수(isDone·needsReview·memoryOf) 그대로.
  const materialCount = new Map<string, number>();
  for (const m of materials ?? []) {
    if (m.unit_id) materialCount.set(m.unit_id, (materialCount.get(m.unit_id) ?? 0) + 1);
  }
  const pathUnits: PathUnit[] = (units ?? []).map((u) => {
    const memory = memoryOf(u);
    const kind: PathUnit["kind"] = needsReview(u)
      ? "review"
      : memory?.fading
        ? "fading"
        : isDone(u)
          ? "done"
          : u.status === "doing"
            ? "doing"
            : "todo";
    const latest = [...u.quiz_results].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return {
      id: u.id,
      title: u.title,
      status: u.status as UnitStatus,
      kind,
      memory: memory && { percent: memory.percent, reviewAt: memory.reviewAt },
      logCount: u.study_logs.length,
      logs: [...u.study_logs].sort((a, b) => b.studied_at.localeCompare(a.studied_at)).slice(0, 5),
      latestQuiz: latest ? { score: latest.score, total: latest.total, passed: latest.passed } : null,
      materials: materialCount.get(u.id) ?? 0,
    };
  });

  return (
    <AppShell active="home">
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
            ← 내 과목
          </Link>

          {/* 무대 배너: 왼쪽 딱따구리가 날씨를 전하고, 오른쪽에서 매가 기다린다 */}
          <section className="flex min-h-[190px] items-end justify-between gap-2 overflow-hidden rounded-3xl bg-[url(/stage_new.svg)] bg-cover bg-bottom px-4 pb-3 pt-6 lg:min-h-[220px] lg:px-6">
            <MascotSays mood={weather.tone} className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1 font-bold">
                <WeatherIcon tone={weather.tone} emoji={weather.icon} size={20} />
                {weather.label}
              </span>
              <span className="mt-0.5 block">{weather.detail}</span>
            </MascotSays>
            <Image
              src="/hawk_new.png"
              alt="보스 매"
              width={64}
              height={99}
              className={`shrink-0 drop-shadow-[0_6px_6px_rgb(60_40_20/0.25)] ${hawkAngry ? "boss-angry" : "boss-hover"}`}
            />
          </section>

          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-3xl">{subject.name}</h1>
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-zinc-500">
              {subject.professor && <span>{subject.professor} ·</span>}
              {subject.exam_date && daysLeft !== null ? (
                <>
                  <span>시험 {subject.exam_date}</span>
                  <DDayBadge days={daysLeft} />
                </>
              ) : (
                <span>시험일 미정</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <BossPanel remaining={remaining} total={total} daysLeft={daysLeft} />
          {total > 0 && (
            <p className="text-right text-xs tabular-nums text-zinc-500">
              {done}/{total} 단원 · {percent}%
            </p>
          )}
        </div>

        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-bold">단원</h2>
          <UnitPath
            units={pathUnits}
            examDate={subject.exam_date}
            daysLeft={daysLeft}
            autoScroll={!setup}
            boss={{ remaining, total }}
          />
        </section>

        <UnitSetup subjectId={subject.id} existingCount={total} setup={setup} />

        <Materials
          subjectId={subject.id}
          units={(units ?? []).map((u) => ({ id: u.id, title: u.title }))}
          materials={materials ?? []}
          ready={!materialsError}
        />

        {/* 맨 아래 작게 */}
        <section className="flex items-center justify-between gap-3 border-t border-zinc-200/80 pt-5">
          <p className="min-w-0 text-xs text-zinc-400">
            <span className="font-bold text-zinc-500">과목 삭제</span> · 단원, 학습 기록, 퀴즈 결과가 모두 함께 지워져요.
          </p>
          <DeleteSubject subjectId={subject.id} />
        </section>

        <HawkTaunt
          key={lastStudy ?? "never"}
          lastStudyAt={lastStudy}
          petName={petNameOf(user)}
          target={{ subjectId: subject.id, subjectName: subject.name, daysLeft, remaining }}
        />
      </div>
    </AppShell>
  );
}
