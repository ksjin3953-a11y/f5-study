"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server_new";

export type SubjectFormState = { error: string | null };

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

  const { error } = await supabase.from("subjects").insert({
    name,
    professor: professor || null,
    exam_date: examDate || null,
  });
  if (error) {
    console.error("createSubject failed:", error);
    return { error: "저장하지 못했어요. 다시 시도해 주세요." };
  }

  refresh();
  return { error: null };
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
