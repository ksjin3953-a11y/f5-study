"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server_new";
import { GeminiError, generateJson } from "@/lib/gemini_new";
import { MATERIALS_BUCKET, geminiFileFor } from "@/lib/materials_new";
import { createUnits } from "@/app/unit-actions_new";
import { setMidterm } from "@/app/subject-actions_new";
import { todayInSeoul } from "@/lib/weather_new";

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
  properties: {
    units: { type: "ARRAY", items: { type: "STRING" } },
    midterm: {
      type: "OBJECT",
      properties: {
        status: { type: "STRING", enum: ["yes", "no", "unknown"] },
        unit_count: { type: "INTEGER" },
        date: { type: "STRING" },
      },
      required: ["status"],
    },
  },
  required: ["units", "midterm"],
};

// 강의계획서에서 찾은 중간고사 정보. status가 unknown이거나 날짜가 없으면 화면에서 사용자에게 물어본다.
export type SyllabusMidterm = {
  status: "yes" | "no" | "unknown";
  unitCount: number | null; // 뽑은 단원 목록 중 앞에서부터 몇 개가 중간고사 범위인지
  date: string | null; // YYYY-MM-DD
};

// 강의계획서 PDF를 읽고 단원 목록을 만든다. 저장은 사용자가 고친 뒤 saveUnitTitles로 한다.
export async function unitsFromSyllabus(
  materialId: string
): Promise<{ units: string[]; midterm: SyllabusMidterm } | { error: string }> {
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
    "",
    "- units에는 중간고사 전후 가리지 말고 학기 전체(기말고사 범위까지)의 단원을 모두 넣어 주세요.",
    "",
    "중간고사 정보도 찾아 주세요(midterm).",
    "- status: 계획서에 중간고사가 있으면 yes, 중간고사가 없다고 확실하면(기말만 있음 등) no, 알 수 없으면 unknown",
    "- unit_count: yes일 때, 위에서 뽑은 units 목록 중 앞에서부터 몇 개가 중간고사 범위인지(중간고사 주차 앞의 단원 수)",
    `- date: 중간고사 날짜가 적혀 있으면 YYYY-MM-DD, 없으면 빈 문자열. 연도가 없으면 오늘(${todayInSeoul()}) 기준 이번 학기 연도로`,
  ].join("\n");

  try {
    const file = await geminiFileFor(supabase, m);
    const data = (await generateJson(prompt, UNITS_SCHEMA, [file])) as {
      units?: unknown[];
      midterm?: { status?: unknown; unit_count?: unknown; date?: unknown };
    };
    const units = (data.units ?? [])
      .filter((u): u is string => typeof u === "string")
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, 40);
    if (units.length === 0) return { error: "강의계획서에서 단원을 찾지 못했어요. 직접 입력해 주세요." };

    // 모델 답은 믿을 수 있는 모양일 때만 쓴다. 애매하면 unknown → 화면에서 사용자에게 물어본다.
    const mt = data.midterm ?? {};
    const count =
      typeof mt.unit_count === "number" && mt.unit_count > 0 && mt.unit_count < units.length
        ? Math.floor(mt.unit_count)
        : null;
    const date = typeof mt.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(mt.date) ? mt.date : null;
    const status = mt.status === "no" ? "no" : mt.status === "yes" && count ? "yes" : "unknown";
    return {
      units,
      midterm: { status, unitCount: status === "yes" ? count : null, date: status === "yes" ? date : null },
    };
  } catch (e) {
    console.error("unitsFromSyllabus failed:", e);
    if (e instanceof GeminiError && e.rateLimited) {
      return { error: "AI 사용량이 잠깐 가득 찼어요. 1분쯤 뒤에 다시 시도해 주세요." };
    }
    return { error: "강의계획서를 읽지 못했어요. 다시 시도해 주세요." };
  }
}

// 미리보기에서 고친 단원 목록을 저장한다(기존 단원 뒤에 이어 붙인다).
// midterm: 중간고사 범위(이번에 저장하는 목록 기준 앞에서부터 units개)와 날짜. units 0 = 중간고사 없음.
export async function saveUnitTitles(
  subjectId: string,
  titles: string[],
  midterm?: { units: number; date: string | null; existingCount: number }
) {
  const formData = new FormData();
  formData.set("subject_id", subjectId);
  formData.set("titles", titles.map((t) => t.replace(/\s+/g, " ").trim()).join("\n"));
  const res = await createUnits({ error: null }, formData);
  if (res.error || !midterm) return res;

  // 기존 단원 뒤에 이어 붙였으므로 범위는 기존 단원 수만큼 뒤로 민다.
  const mid = await setMidterm(subjectId, {
    units: midterm.units > 0 ? midterm.existingCount + midterm.units : 0,
    date: midterm.date,
  });
  return mid.error ? { error: `단원은 저장했지만 중간고사 설정은 못 했어요: ${mid.error}` } : res;
}
