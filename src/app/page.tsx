import Link from "next/link";
import { createClient } from "@/lib/supabase/server_new";
import { LoginButton, LogoutButton } from "@/components/auth-buttons_new";
import { SubjectForm } from "@/components/subject-form_new";
import { deleteSubject } from "@/app/subject-actions_new";
import { setUnitStatus } from "@/app/unit-actions_new";
import { dDayLabel, daysUntil, isDone, studyWeather, type Weather } from "@/lib/weather_new";
import { recommendToday } from "@/lib/recommend_new";
import { futureMeMessage } from "@/lib/future-me_new";

const TONE_CLASS: Record<Weather["tone"], string> = {
  sunny: "border-amber-200 bg-amber-50",
  cloudy: "border-sky-200 bg-sky-50",
  rainy: "border-blue-300 bg-blue-50",
  stormy: "border-violet-300 bg-violet-50",
  none: "border-zinc-200",
};

export default async function Home({ searchParams }: PageProps<"/">) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: subjects } = user
    ? await supabase
        .from("subjects")
        .select(
          "id, name, professor, exam_date, created_at, units(id, title, status, position, completed_at, quiz_results(passed, created_at))"
        )
        .order("exam_date", { ascending: true, nullsFirst: false })
    : { data: null };
  const recommendations = recommendToday(subjects ?? []);
  // 위험한 과목부터. 위험도가 같으면 시험일 순서(조회 순서)를 유지한다.
  const cards = (subjects ?? [])
    .map((s) => ({ ...s, weather: studyWeather(s) }))
    .sort((a, b) => b.weather.risk - a.weather.risk);

  // "시험 날의 나": 예보가 있는 과목 중 가장 위험한 과목에 대해 말한다.
  const focus = cards.find((c) => c.weather.forecast);
  const futureMe = focus
    ? futureMeMessage({
        subjectName: focus.name,
        weather: focus.weather,
        nextUnitTitle:
          recommendations.find((r) => r.subjectId === focus.id)?.units[0]?.title ??
          focus.units
            .filter((u) => !isDone(u))
            .sort((a, b) => a.position - b.position)[0]?.title ??
          null,
      })
    : null;

  return (
    <main
      className={`mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-16 ${
        user ? "" : "justify-center"
      }`}
    >
      <div className="flex flex-col gap-3">
        <p className="text-4xl">⛈️ → ☀️</p>
        <h1 className="text-3xl font-bold tracking-tight">F5 Study</h1>
        <p className="text-zinc-600">
          지금 속도로 공부하면 시험 날 어디까지 끝낼 수 있을까요?
          <br />
          과목별 학습 날씨로 확인하고, 오늘 할 공부를 추천받으세요.
        </p>
      </div>

      {user ? (
        <>
          {futureMe && (
            <section className="flex items-start gap-3 rounded-2xl bg-zinc-900 px-4 py-4 text-white">
              <span className="text-3xl" aria-hidden>
                {futureMe.weather}
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold tracking-wide text-zinc-400">
                  📡 시험 날의 나에게서 온 예보
                </span>
                <p className="text-sm leading-relaxed">{futureMe.message}</p>
              </div>
            </section>
          )}

          {recommendations.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="font-semibold">오늘의 추천 공부</h2>
              <ul className="flex flex-col gap-3">
                {recommendations.map((r) => (
                  <li
                    key={r.subjectId}
                    className="flex flex-col gap-2 rounded-2xl border border-zinc-200 px-4 py-4"
                  >
                    <Link href={`/subjects/${r.subjectId}`} className="flex flex-col hover:underline">
                      <span className="font-medium">
                        {r.weatherIcon} {r.subjectName}
                      </span>
                      <span className="text-sm text-zinc-500">{r.reason}</span>
                    </Link>
                    <ul className="flex flex-col gap-1">
                      {r.units.map((u) => (
                        <li key={u.id} className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate text-sm">
                            {u.status === "doing" && (
                              <span className="mr-1 text-xs text-sky-600">하는 중</span>
                            )}
                            {u.review && <span className="mr-1 text-xs text-violet-600">복습</span>}
                            {u.title}
                          </span>
                          {u.review ? (
                            <Link
                              href={`/subjects/${r.subjectId}`}
                              className="flex h-7 shrink-0 items-center rounded-full border border-zinc-300 px-3 text-xs transition-colors hover:bg-zinc-900 hover:text-white"
                            >
                              퀴즈 다시 보기
                            </Link>
                          ) : (
                            <form action={setUnitStatus.bind(null, u.id, "done")}>
                              <button className="h-7 shrink-0 rounded-full border border-zinc-300 px-3 text-xs transition-colors hover:bg-zinc-900 hover:text-white">
                                완료
                              </button>
                            </form>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="font-semibold">오늘의 학습 날씨</h2>
            {subjects && subjects.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {cards.map((s) => {
                  const { weather } = s;
                  const done = s.units.filter(isDone).length;
                  return (
                    <li
                      key={s.id}
                      className={`flex flex-col gap-2 rounded-2xl border px-4 py-4 ${TONE_CLASS[weather.tone]}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <Link href={`/subjects/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="text-3xl" aria-hidden>
                            {weather.icon}
                          </span>
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate font-medium hover:underline">{s.name}</span>
                            <span className="text-sm text-zinc-500">
                              {weather.label}
                              {s.units.length > 0 && ` · 진도 ${done}/${s.units.length}`}
                              {s.professor && ` · ${s.professor}`}
                            </span>
                          </span>
                        </Link>
                        <div className="flex shrink-0 items-center gap-3">
                          {s.exam_date && (
                            <span className="text-sm font-semibold">
                              {dDayLabel(daysUntil(s.exam_date))}
                            </span>
                          )}
                          <form action={deleteSubject.bind(null, s.id)}>
                            <button
                              className="text-sm text-zinc-400 transition-colors hover:text-red-600"
                              aria-label={`${s.name} 삭제`}
                            >
                              삭제
                            </button>
                          </form>
                        </div>
                      </div>
                      <p className="text-sm text-zinc-700">{weather.detail}</p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">
                아직 과목이 없어요. 아래에서 첫 과목을 추가해 보세요.
              </p>
            )}
          </section>

          <SubjectForm />

          <div className="flex items-center justify-between gap-3 text-sm text-zinc-500">
            <span className="truncate">{user.email}</span>
            <LogoutButton />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <LoginButton />
          {error === "login" && (
            <p className="text-sm text-red-600">
              로그인에 실패했어요. 다시 시도해 주세요.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
