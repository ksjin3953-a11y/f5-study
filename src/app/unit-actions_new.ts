"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server_new";

export type UnitFormState = { error: string | null };
export type UnitStatus = "todo" | "doing" | "done";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// 단원 추가. 한 줄에 하나씩 적으면 여러 단원을 한 번에 추가한다.
export async function createUnits(
  _prevState: UnitFormState,
  formData: FormData
): Promise<UnitFormState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요해요." };

  // 본인 과목인지 확인한다(RLS라 남의 과목은 조회되지 않는다).
  const subjectId = String(formData.get("subject_id") ?? "");
  const { data: subject } = await supabase
    .from("subjects")
    .select("id")
    .eq("id", subjectId)
    .maybeSingle();
  if (!subject) return { error: "과목을 찾을 수 없어요." };

  const titles = String(formData.get("titles") ?? "")
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
  if (titles.length === 0) return { error: "단원명을 입력해 주세요." };

  // 기존 단원 뒤에 이어 붙인다.
  const { data: last } = await supabase
    .from("units")
    .select("position")
    .eq("subject_id", subjectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const start = (last?.position ?? -1) + 1;

  const { error } = await supabase.from("units").insert(
    titles.map((title, i) => ({
      subject_id: subjectId,
      title,
      position: start + i,
    }))
  );
  if (error) {
    console.error("createUnits failed:", error);
    return { error: "저장하지 못했어요. 다시 시도해 주세요." };
  }

  refresh();
  return { error: null };
}

// 단원 상태 변경. 완료로 바꾸면 완료 시각을 기록한다.
export async function setUnitStatus(id: string, status: UnitStatus) {
  const { supabase, user } = await requireUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("units")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  refresh();
}

export async function deleteUnit(id: string) {
  const { supabase, user } = await requireUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("units")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  refresh();
}
