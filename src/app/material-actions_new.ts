"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server_new";
import { GeminiError, generateJson } from "@/lib/gemini_new";
import { MATERIALS_BUCKET, geminiFileFor } from "@/lib/materials_new";
import { createUnits } from "@/app/unit-actions_new";

export type MaterialKind = "syllabus" | "lecture";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// 브라우저가 Storage에 PDF를 올린 뒤 부른다. 파일 정보를 materials 테이블에 남긴다.
export async function registerMaterial(input: {
  subjectId: string;
  unitId: string | null;
  kind: MaterialKind;
  name: string;
  path: string;
  size: number;
}): Promise<{ id: string } | { error: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요해요." };
  // Storage 정책과 같은 규칙: 경로 첫 폴더가 본인 ID여야 한다.
  if (!input.path.startsWith(`${user.id}/`)) return { error: "잘못된 파일 경로예요." };
  if (input.kind !== "syllabus" && input.kind !== "lecture") return { error: "잘못된 자료 종류예요." };

  const { data, error } = await supabase
    .from("materials")
    .insert({
      subject_id: input.subjectId,
      unit_id: input.unitId,
      kind: input.kind,
      name: input.name.slice(0, 200),
      path: input.path,
      size: input.size,
    })
    .select("id")
    .single();
  if (error) {
    console.error("registerMaterial failed:", error);
    // 저장하지 못한 파일은 보관함에서도 지운다.
    await supabase.storage.from(MATERIALS_BUCKET).remove([input.path]);
    return { error: "자료를 저장하지 못했어요. (DB에 materials 테이블이 있는지 확인해 주세요)" };
  }

  if (input.kind === "lecture") refresh();
  return { id: data.id };
}

export async function deleteMaterial(id: string) {
  const { supabase, user } = await requireUser();
  if (!user) throw new Error("Unauthorized");

  const { data: m } = await supabase.from("materials").select("path").eq("id", id).maybeSingle();
  if (!m) return;
  await supabase.storage.from(MATERIALS_BUCKET).remove([m.path]);
  const { error } = await supabase.from("materials").delete().eq("id", id);
  if (error) throw new Error(error.message);

  refresh();
}

// 강의자료를 다른 단원에 붙이거나 과목 전체 자료로 바꾼다.
export async function setMaterialUnit(id: string, unitId: string | null) {
  const { supabase, user } = await requireUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase.from("materials").update({ unit_id: unitId }).eq("id", id);
  if (error) throw new Error(error.message);

  refresh();
}

const UNITS_SCHEMA = {
  type: "OBJECT",
  properties: { units: { type: "ARRAY", items: { type: "STRING" } } },
  required: ["units"],
};

// 강의계획서 PDF를 읽고 단원 목록을 만든다. 저장은 사용자가 고친 뒤 saveUnitTitles로 한다.
export async function unitsFromSyllabus(
  materialId: string
): Promise<{ units: string[] } | { error: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요해요." };

  const { data: m } = await supabase
    .from("materials")
    .select("id, name, path, gemini_uri, gemini_expires_at")
    .eq("id", materialId)
    .maybeSingle();
  if (!m) return { error: "강의계획서를 찾을 수 없어요." };

  const prompt = [
    "첨부한 PDF는 대학 강의계획서예요. 시험 범위가 될 학습 단원 목록을 수업 순서대로 뽑아 주세요.",
    "- 오리엔테이션, 복습, 중간·기말고사, 휴강, 발표, 보강 같은 주차는 빼 주세요.",
    "- 주차별 강의 내용을 그대로 옮기되, 단원명은 30자 이내로 짧게 해 주세요.",
    "- 같은 주제가 여러 주에 걸치면 하나로 묶어 주세요.",
    "- 강의계획서가 아니거나 단원을 찾을 수 없으면 빈 목록을 주세요.",
  ].join("\n");

  try {
    const file = await geminiFileFor(supabase, m);
    const data = (await generateJson(prompt, UNITS_SCHEMA, [file])) as { units?: unknown[] };
    const units = (data.units ?? [])
      .filter((u): u is string => typeof u === "string")
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, 40);
    if (units.length === 0) return { error: "강의계획서에서 단원을 찾지 못했어요. 직접 입력해 주세요." };
    return { units };
  } catch (e) {
    console.error("unitsFromSyllabus failed:", e);
    if (e instanceof GeminiError && e.rateLimited) {
      return { error: "AI 사용량이 잠깐 가득 찼어요. 1분쯤 뒤에 다시 시도해 주세요." };
    }
    return { error: "강의계획서를 읽지 못했어요. 다시 시도해 주세요." };
  }
}

// 미리보기에서 고친 단원 목록을 저장한다(기존 단원 뒤에 이어 붙인다).
export async function saveUnitTitles(subjectId: string, titles: string[]) {
  const formData = new FormData();
  formData.set("subject_id", subjectId);
  formData.set("titles", titles.map((t) => t.replace(/\s+/g, " ").trim()).join("\n"));
  return createUnits({ error: null }, formData);
}
