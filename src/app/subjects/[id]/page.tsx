import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server_new";
import { UnitForm } from "@/components/unit-form_new";
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
    .select("id, name, professor, exam_date")
    .eq("id", id)
    .maybeSingle();
  if (!subject) notFound();

  const { data: units } = await supabase
    .from("units")
    .select("id, title, status")
    .eq("subject_id", id)
    .order("position");

  const total = units?.length ?? 0;
  const done = units?.filter((u) => u.status === "done").length ?? 0;
  const percent = total ? Math.round((done / total) * 100) : 0;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
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
            {units.map((u) => (
              <li
                key={u.id}
                className="flex flex-col gap-2 rounded-2xl border border-zinc-200 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`font-medium ${
                      u.status === "done" ? "text-zinc-400 line-through" : ""
                    }`}
                  >
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
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">
            아직 단원이 없어요. 강의계획서를 보고 단원을 추가해 보세요.
          </p>
        )}
      </section>

      <UnitForm subjectId={subject.id} />
    </main>
  );
}
