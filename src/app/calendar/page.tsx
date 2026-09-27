import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server_new";
import { buildPlan, SUBJECT_COLORS } from "@/lib/plan_new";
import { StudyCalendar } from "@/components/study-calendar_new";
import { CalendarDays, Leaf } from "lucide-react";
import { AppShell } from "@/components/app-shell_new";

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: subjects } = await supabase
    .from("subjects")
    .select(
      "id, name, exam_date, midterm_date, midterm_units, units(id, title, status, position, completed_at, quiz_results(passed, created_at), study_logs(studied_at))"
    )
    .order("exam_date", { ascending: true, nullsFirst: false });
  const list = subjects ?? [];
  const plan = buildPlan(list);
  const undated = list.filter((s) => !s.exam_date);

  return (
    <AppShell active="calendar">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
            ← 내 과목
          </Link>
          <h1 className="flex items-center gap-2 font-display text-3xl">
            <CalendarDays className="size-6 text-brand" aria-hidden />
            공격 계획표
          </h1>
          <p className="text-sm text-zinc-600">
            시험 전날까지 남은 단원을 하루씩 나눠 봤어요. 주말(
            <Leaf className="inline size-3.5 align-[-0.15em] text-forest" aria-label="잎 표시" />
            )은 가볍게, 시험 전 일주일은 주말도 달려요.
            날짜를 누르면 그날 할 공부가 보여요.
          </p>
        </div>

        {list.length > 0 && (
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-600">
            {list.map((s, i) => (
              <li key={s.id} className="flex items-center gap-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: SUBJECT_COLORS[i % SUBJECT_COLORS.length] }}
                />
                {s.name}
              </li>
            ))}
          </ul>
        )}

        <StudyCalendar plan={plan} />

        {undated.length > 0 && (
          <p className="text-xs text-zinc-500">
            시험일이 없는 과목({undated.map((s) => s.name).join(", ")})은 공격 계획표에 나오지 않아요. 과목에 시험일을
            넣어 주세요.
          </p>
        )}
      </div>
    </AppShell>
  );
}
