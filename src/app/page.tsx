import Link from "next/link";
import { createClient } from "@/lib/supabase/server_new";
import { LoginButton, LogoutButton } from "@/components/auth-buttons_new";
import { SubjectForm } from "@/components/subject-form_new";
import { deleteSubject } from "@/app/subject-actions_new";

// 오늘(한국 시간)부터 시험일까지 남은 날 수
function daysUntil(examDate: string) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  return Math.round((Date.parse(examDate) - Date.parse(today)) / 86_400_000);
}

function dDayLabel(days: number) {
  if (days > 0) return `D-${days}`;
  if (days === 0) return "D-Day";
  return "시험 끝";
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: subjects } = user
    ? await supabase
        .from("subjects")
        .select("id, name, professor, exam_date, units(status)")
        .order("exam_date", { ascending: true, nullsFirst: false })
    : { data: null };

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
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold">내 과목</h2>
            {subjects && subjects.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {subjects.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 px-4 py-3"
                  >
                    <Link href={`/subjects/${s.id}`} className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium hover:underline">{s.name}</span>
                      <span className="text-sm text-zinc-500">
                        {[
                          s.professor,
                          s.exam_date,
                          s.units.length > 0 &&
                            `진도 ${s.units.filter((u) => u.status === "done").length}/${s.units.length}`,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "시험일 미정"}
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
                  </li>
                ))}
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
