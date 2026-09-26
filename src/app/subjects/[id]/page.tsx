import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server_new";
import { UnitForm } from "@/components/unit-form_new";
import { SyllabusImport } from "@/components/syllabus-import_new";
import { Materials } from "@/components/materials_new";
import { RecordForm } from "@/components/record-form_new";
import { Quiz } from "@/components/quiz_new";
import { MascotSays } from "@/components/mascot_new";
import { BossMini, BossPanel } from "@/components/boss-panel_new";
import { daysUntil, isDone, needsReview, studyWeather } from "@/lib/weather_new";
import { DDayBadge } from "@/components/dday-badge_new";
import { HawkTaunt } from "@/components/hawk-taunt_new";
import { lastStudyAt, petNameOf } from "@/lib/game_new";
import { deleteUnit, setUnitStatus, type UnitStatus } from "@/app/unit-actions_new";

const STATUSES: { value: UnitStatus; label: string }[] = [
  { value: "todo", label: "할 일" },
  { value: "doing", label: "하는 중" },
  { value: "done", label: "완료" },
];

export default async function SubjectPage({ params }: PageProps<"/subjects/[id]">) {
  const { id } = await params;
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

  // 단원 카드 하나. 할 단원 목록과 접어 둔 완료 목록이 같이 쓴다.
  const renderUnit = (u: NonNullable<typeof units>[number]) => {
    const logs = [...u.study_logs].sort((a, b) =>
      b.studied_at.localeCompare(a.studied_at)
    );
    const quizzes = [...u.quiz_results].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
    const latestQuiz = quizzes[0];
    const review = needsReview(u);
    return (
      <li
        key={u.id}
        className={`flex flex-col gap-2 rounded-2xl border px-4 py-3 ${
          review ? "border-violet-300 bg-violet-50" : "border-zinc-200"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <span
            className={`font-medium ${isDone(u) ? "text-zinc-400 line-through" : ""}`}
          >
            {review && <span className="mr-1 text-xs text-violet-600">복습 필요</span>}
            {u.title}
          </span>
          <form action={deleteUnit.bind(null, u.id)}>
            <button
              className="shrink-0 text-sm text-zinc-400 transition-colors hover:text-red-600"
              aria-label={`${u.title} 삭제`}
            >
              삭제
            </button>
          </form>
        </div>
        <div className="flex gap-1">
          {STATUSES.map((s) => (
            <form key={s.value} action={setUnitStatus.bind(null, u.id, s.value)}>
              <button
                disabled={u.status === s.value}
                className={`h-8 rounded-full px-3 text-sm transition-colors ${
                  u.status === s.value
                    ? "bg-zinc-900 text-white"
                    : "border border-zinc-300 text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {s.label}
              </button>
            </form>
          ))}
        </div>
        {(logs.length > 0 || latestQuiz) && (
          <p className="text-sm text-zinc-500">
            {[
              logs.length > 0 && `공부 ${logs.length}회`,
              latestQuiz &&
                `최근 퀴즈 ${latestQuiz.score}/${latestQuiz.total} ${
                  latestQuiz.passed ? "통과" : "미통과"
                }`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-violet-700 hover:text-violet-900">
            AI 퀴즈{isDone(u) ? " · 복습하기" : " · 3/5 맞히면 완료"}
          </summary>
          <div className="mt-2">
            <Quiz unitId={u.id} />
          </div>
        </details>
        <details className="text-sm">
          <summary className="cursor-pointer text-zinc-600 hover:text-zinc-900">
            기록 남기기{logs.length > 0 && " · 지난 기록 보기"}
          </summary>
          <div className="mt-2 flex flex-col gap-3">
            <RecordForm unitId={u.id} />
            {logs.length > 0 && (
              <ul className="flex flex-col gap-1 border-t border-zinc-200 pt-2">
                {logs.slice(0, 5).map((log) => (
                  <li key={log.id} className="text-zinc-600">
                    <span className="text-zinc-400">
                      {new Date(log.studied_at).toLocaleDateString("ko-KR", {
                        timeZone: "Asia/Seoul",
                        month: "numeric",
                        day: "numeric",
                      })}
                    </span>{" "}
                    {log.memo ?? "공부함"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      </li>
    );
  };
  const activeUnits = units?.filter((u) => !isDone(u)) ?? [];
  const lastStudy = lastStudyAt(units ?? []);
  const doneUnits = units?.filter(isDone) ?? [];

  return (
    <main className="page-card flex flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
              ← 내 과목
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">{subject.name}</h1>
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
          <BossMini remaining={total - done} total={total} />
        </div>
        <MascotSays className="mt-2" mood={weather.tone}>
          <span className="font-semibold">
            {weather.icon} {weather.label}
          </span>
          <br />
          {weather.detail}
        </MascotSays>
      </div>

      <BossPanel remaining={total - done} total={total} daysLeft={daysLeft} />

      <section className="flex flex-col gap-2">
        <div className="flex justify-between text-sm">
          <span className="font-semibold">진도</span>
          <span className="text-zinc-500">
            {done}/{total} 단원 · {percent}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
          <div className="h-full rounded-full bg-zinc-900" style={{ width: `${percent}%` }} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">단원</h2>
        {units && units.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {activeUnits.length > 0 ? (
              activeUnits.map(renderUnit)
            ) : (
              <li className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                모든 단원을 끝냈어요! 🎉
              </li>
            )}
          </ul>
        ) : (
          <MascotSays>아직 단원이 없어요. 강의계획서를 보고 단원을 추가해 보세요!</MascotSays>
        )}
        {doneUnits.length > 0 && (
          <details className="group rounded-2xl border border-zinc-200 bg-zinc-50/80">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-zinc-600 hover:text-zinc-900">
              <span>✅ 완료한 단원 {doneUnits.length}개</span>
              <span className="text-xs text-zinc-400 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <ul className="flex flex-col gap-2 px-2 pb-2">{doneUnits.map(renderUnit)}</ul>
          </details>
        )}
      </section>

      <SyllabusImport subjectId={subject.id} existingCount={total} />

      <UnitForm subjectId={subject.id} />

      <Materials
        subjectId={subject.id}
        units={(units ?? []).map((u) => ({ id: u.id, title: u.title }))}
        materials={materials ?? []}
        ready={!materialsError}
      />

      <HawkTaunt
        key={lastStudy ?? "never"}
        lastStudyAt={lastStudy}
        petName={petNameOf(user)}
        target={{ subjectId: subject.id, subjectName: subject.name, daysLeft, remaining: total - done }}
      />
    </main>
  );
}
