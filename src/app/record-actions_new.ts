"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server_new";

export type RecordFormState = { error: string | null; savedAt: number | null };

const PASS_RATIO = 0.7; // 퀴즈 통과 기준

// 학습 기록 남기기. 퀴즈 점수를 함께 적으면 퀴즈 결과도 저장한다.
export async function createRecord(
  _prevState: RecordFormState,
  formData: FormData
): Promise<RecordFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요해요.", savedAt: null };

  // 본인 단원인지 확인한다(RLS라 남의 단원은 조회되지 않는다).
  const unitId = String(formData.get("unit_id") ?? "");
  const { data: unit } = await supabase
    .from("units")
    .select("id, status")
    .eq("id", unitId)
    .maybeSingle();
  if (!unit) return { error: "단원을 찾을 수 없어요.", savedAt: null };

  const memo = String(formData.get("memo") ?? "").trim();
  const scoreRaw = String(formData.get("score") ?? "");
  const totalRaw = String(formData.get("total") ?? "");

  let quiz: { score: number; total: number } | null = null;
  if (scoreRaw || totalRaw) {
    const score = Number(scoreRaw);
    const total = Number(totalRaw);
    if (
      !Number.isInteger(score) ||
      !Number.isInteger(total) ||
      total <= 0 ||
      score < 0 ||
      score > total
    ) {
      return { error: "퀴즈 점수를 확인해 주세요. (예: 8 / 10)", savedAt: null };
    }
    quiz = { score, total };
  }

  const { error: logError } = await supabase
    .from("study_logs")
    .insert({ unit_id: unitId, memo: memo || null });
  if (logError) {
    console.error("createRecord study_logs failed:", logError);
    return { error: "저장하지 못했어요. 다시 시도해 주세요.", savedAt: null };
  }

  if (quiz) {
    const { error: quizError } = await supabase.from("quiz_results").insert({
      unit_id: unitId,
      score: quiz.score,
      total: quiz.total,
      passed: quiz.score / quiz.total >= PASS_RATIO,
    });
    if (quizError) {
      console.error("createRecord quiz_results failed:", quizError);
      return { error: "퀴즈 결과를 저장하지 못했어요.", savedAt: null };
    }
  }

  // 공부를 시작한 단원은 '하는 중'으로 바꾼다.
  if (unit.status === "todo") {
    await supabase.from("units").update({ status: "doing" }).eq("id", unitId);
  }

  refresh();
  return { error: null, savedAt: Date.now() };
}
