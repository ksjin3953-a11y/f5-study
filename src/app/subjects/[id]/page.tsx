import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server_new";
import { UnitForm } from "@/components/unit-form_new";
import { RecordForm } from "@/components/record-form_new";
import { MascotSays } from "@/components/mascot_new";
import { BossMini, BossPanel } from "@/components/boss-panel_new";
import { daysUntil, isDone, needsReview, studyWeather } from "@/lib/weather_new";
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

  const total = units?.length ?? 0;
  const done = units?.filter(isDone).length ?? 0;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const weather = studyWeather({ ...subject, units: units ?? [] });
  const daysLeft = subject.exam_date ? daysUntil(subject.exam_date) : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
              ← 내 과목
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">{subject.name}</h1>
            <p className="text-sm text-zinc-500">
              {[subject.professor, subject.exam_date && `시험 ${subject.exam_date}`]
                .filter(Boolean)
                .join(" · ") || "시험일 미정"}
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
            {units.map((u) => {
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
            })}
          </ul>
        ) : (
          <MascotSays>아직 단원이 없어요. 강의계획서를 보고 단원을 추가해 보세요!</MascotSays>
        )}
      </section>

      <UnitForm subjectId={subject.id} />
    </main>
  );
}
