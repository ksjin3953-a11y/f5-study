"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server_new";

export type SubjectFormState = { error: string | null; id?: string };

// 과목 추가. 폼에서 useActionState로 호출한다.
export async function createSubject(
  _prevState: SubjectFormState,
  formData: FormData
): Promise<SubjectFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요해요." };

  const name = String(formData.get("name") ?? "").trim();
  const professor = String(formData.get("professor") ?? "").trim();
  const examDate = String(formData.get("exam_date") ?? "");

  if (!name) return { error: "과목명을 입력해 주세요." };

  const { data, error } = await supabase
    .from("subjects")
    .insert({
      name,
      professor: professor || null,
      exam_date: examDate || null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("createSubject failed:", error);
    return { error: "저장하지 못했어요. 다시 시도해 주세요." };
  }

  refresh();
  // 새 과목 id: 과목 추가 흐름이 바로 단원 만들기로 이어지게 돌려준다.
  return { error: null, id: data.id };
}

// 과목 삭제. 딸린 단원·기록도 함께 지워진다(on delete cascade).
export async function deleteSubject(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("subjects")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  refresh();
}

// 중간고사 설정. units: 0 = 중간고사 없음(보스는 기말 하나), null = 아직 안 정함, N = 앞에서부터 N단원.
export async function setMidterm(
  subjectId: string,
  midterm: { units: number | null; date: string | null }
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요해요." };

  const units = midterm.units === null ? null : Math.max(0, Math.floor(midterm.units));
  const date = units && midterm.date && /^\d{4}-\d{2}-\d{2}$/.test(midterm.date) ? midterm.date : null;
  if (units && !date) return { error: "중간고사 날짜를 입력해 주세요." };

  const { error } = await supabase
    .from("subjects")
    .update({ midterm_units: units, midterm_date: date })
    .eq("id", subjectId)
    .eq("user_id", user.id);
  if (error) {
    console.error("setMidterm failed:", error);
    return { error: "저장하지 못했어요. (DB에 중간고사 칸이 있는지 확인해 주세요)" };
  }

  refresh();
  return { error: null };
}
