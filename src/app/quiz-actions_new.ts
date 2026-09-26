"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server_new";
import { GeminiError, generateJson, type GeminiFile } from "@/lib/gemini_new";
import { geminiFileFor, type MaterialRow } from "@/lib/materials_new";
import { QUIZ_PASS_RATIO } from "@/lib/weather_new";

export type QuizQuestion = {
  question: string;
  choices: string[];
  answer: number; // choices의 정답 위치
  explanation: string;
};

const QUESTION_COUNT = 5;
const CHOICE_COUNT = 4;
const MAX_MATERIALS = 3; // 한 번에 읽힐 강의자료 수(최근 것부터)

const SCHEMA = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          correct: { type: "STRING" },
          wrong: { type: "ARRAY", items: { type: "STRING" } },
          explanation: { type: "STRING" },
        },
        required: ["question", "correct", "wrong", "explanation"],
      },
    },
  },
  required: ["questions"],
};

type Raw = { question: string; correct: string; wrong: string[]; explanation: string };

function isRaw(q: unknown): q is Raw {
  const r = q as Raw;
  return (
    typeof r?.question === "string" &&
    typeof r.correct === "string" &&
    typeof r.explanation === "string" &&
    Array.isArray(r.wrong) &&
    r.wrong.length === CHOICE_COUNT - 1 &&
    r.wrong.every((w) => typeof w === "string")
  );
}

// 정답을 보기 중 아무 자리에나 넣는다. 모델이 정답을 한 자리에 몰아 두는 것을 막는다.
function toQuestion(r: Raw): QuizQuestion {
  const answer = Math.floor(Math.random() * CHOICE_COUNT);
  const choices = [...r.wrong];
  choices.splice(answer, 0, r.correct);
  return { question: r.question, choices, answer, explanation: r.explanation };
}

// 퀴즈에 쓸 강의자료: 이 단원에 붙인 자료, 없으면 과목 전체 자료. materials 테이블이 없으면 빈 목록.
async function quizMaterials(
  supabase: Awaited<ReturnType<typeof createClient>>,
  unitId: string,
  subjectId: string
): Promise<MaterialRow[]> {
  const cols = "id, name, path, gemini_uri, gemini_expires_at";
  const { data: forUnit } = await supabase
    .from("materials")
    .select(cols)
    .eq("kind", "lecture")
    .eq("unit_id", unitId)
    .order("created_at", { ascending: false })
    .limit(MAX_MATERIALS);
  if (forUnit?.length) return forUnit;
  const { data: forSubject } = await supabase
    .from("materials")
    .select(cols)
    .eq("kind", "lecture")
    .eq("subject_id", subjectId)
    .is("unit_id", null)
    .order("created_at", { ascending: false })
    .limit(MAX_MATERIALS);
  return forSubject ?? [];
}

// 단원 퀴즈 만들기. 강의자료가 있으면 그 내용으로, 없으면 과목명·단원명으로 출제한다.
// sources: 출제에 쓴 강의자료 이름(비어 있으면 단원명 기반).
export async function makeQuiz(
  unitId: string
): Promise<{ questions: QuizQuestion[]; sources: string[] } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요해요." };

  // RLS라 남의 단원은 조회되지 않는다.
  const { data: unit } = await supabase
    .from("units")
    .select("title, subject_id")
    .eq("id", unitId)
    .maybeSingle();
  if (!unit) return { error: "단원을 찾을 수 없어요." };
  const { data: subject } = await supabase
    .from("subjects")
    .select("name")
    .eq("id", unit.subject_id)
    .maybeSingle();

  // 강의자료를 Gemini에 올린다. 실패한 자료는 빼고, 모두 실패하면 단원명으로 출제한다.
  const files: GeminiFile[] = [];
  const sources: string[] = [];
  for (const m of await quizMaterials(supabase, unitId, unit.subject_id)) {
    try {
      files.push(await geminiFileFor(supabase, m));
      sources.push(m.name);
    } catch (e) {
      console.error("quiz material skipped:", m.name, e);
    }
  }

  const prompt = [
    `대학교 "${subject?.name ?? ""}" 과목의 "${unit.title}" 단원을 공부한 학생의 이해도를 확인하는 객관식 퀴즈 ${QUESTION_COUNT}문제를 한국어로 만들어 주세요.`,
    ...(files.length > 0
      ? [
          "- 첨부한 PDF는 이 과목의 실제 강의자료예요. 문제는 반드시 강의자료 내용을 근거로 내 주세요.",
          `- 강의자료에 여러 단원이 섞여 있으면 "${unit.title}"에 해당하는 부분에서만 내 주세요.`,
          "- 강의자료의 정의·기호·예제가 일반 교재와 다르면 강의자료를 따라 주세요.",
          "- explanation 끝에 근거가 된 슬라이드 제목이나 쪽을 (근거: …) 형식으로 붙여 주세요.",
        ]
      : []),
    "- 용어 암기보다 개념 이해와 적용을 묻는 문제를 섞고, 난이도는 학부 중간고사 수준으로 해 주세요.",
    `- 각 문제는 정답 1개(correct)와 그럴듯한 오답 ${CHOICE_COUNT - 1}개(wrong)를 주세요. 보기에 번호나 기호는 붙이지 마세요.`,
    "- explanation에는 왜 그게 정답인지 1~2문장으로 설명해 주세요.",
    "- 단원명이 모호하면 해당 과목에서 가장 일반적인 의미로 해석해 주세요.",
  ].join("\n");

  try {
    const data = (await generateJson(prompt, SCHEMA, files)) as { questions?: unknown[] };
    const questions = (data.questions ?? []).filter(isRaw).slice(0, QUESTION_COUNT);
    if (questions.length < QUESTION_COUNT) {
      console.error("makeQuiz bad shape:", JSON.stringify(data).slice(0, 500));
      return { error: "문제를 제대로 만들지 못했어요. 다시 시도해 주세요." };
    }
    return { questions: questions.map(toQuestion), sources };
  } catch (e) {
    console.error("makeQuiz failed:", e);
    if (e instanceof GeminiError && e.rateLimited) {
      return { error: "AI 사용량이 잠깐 가득 찼어요. 1분쯤 뒤에 다시 시도해 주세요." };
    }
    return { error: "문제를 만들지 못했어요. 다시 시도해 주세요." };
  }
}

// 퀴즈 결과 저장. 통과하면 단원을 완료로, 처음 푼 단원이 통과하지 못하면 '하는 중'으로 바꾼다.
export async function submitQuiz(
  unitId: string,
  score: number
): Promise<{ error: string | null; passed: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요해요.", passed: false };

  if (!Number.isInteger(score) || score < 0 || score > QUESTION_COUNT) {
    return { error: "점수가 올바르지 않아요.", passed: false };
  }

  const { data: unit } = await supabase
    .from("units")
    .select("id, status")
    .eq("id", unitId)
    .maybeSingle();
  if (!unit) return { error: "단원을 찾을 수 없어요.", passed: false };

  const passed = score / QUESTION_COUNT >= QUIZ_PASS_RATIO;
  const { error } = await supabase
    .from("quiz_results")
    .insert({ unit_id: unitId, score, total: QUESTION_COUNT, passed });
  if (error) {
    console.error("submitQuiz failed:", error);
    return { error: "결과를 저장하지 못했어요. 다시 시도해 주세요.", passed };
  }

  // 이미 완료한 단원이 통과하지 못하면 상태는 그대로 두고 '복습 필요'로 표시된다(needsReview).
  if (passed && unit.status !== "done") {
    await supabase
      .from("units")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", unitId);
  } else if (!passed && unit.status === "todo") {
    await supabase.from("units").update({ status: "doing" }).eq("id", unitId);
  }

  refresh();
  return { error: null, passed };
}
