"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server_new";
import { GeminiError, generateJson } from "@/lib/gemini_new";
import { QUIZ_PASS_RATIO } from "@/lib/weather_new";

export type QuizQuestion = {
  question: string;
  choices: string[];
  answer: number; // choices의 정답 위치
  explanation: string;
};

const QUESTION_COUNT = 5;
const CHOICE_COUNT = 4;

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

// 단원 퀴즈 만들기. 모델에는 과목명과 단원명만 보낸다.
export async function makeQuiz(
  unitId: string
): Promise<{ questions: QuizQuestion[] } | { error: string }> {
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

  const prompt = [
    `대학교 "${subject?.name ?? ""}" 과목의 "${unit.title}" 단원을 공부한 학생의 이해도를 확인하는 객관식 퀴즈 ${QUESTION_COUNT}문제를 한국어로 만들어 주세요.`,
    "- 용어 암기보다 개념 이해와 적용을 묻는 문제를 섞고, 난이도는 학부 중간고사 수준으로 해 주세요.",
    `- 각 문제는 정답 1개(correct)와 그럴듯한 오답 ${CHOICE_COUNT - 1}개(wrong)를 주세요. 보기에 번호나 기호는 붙이지 마세요.`,
    "- explanation에는 왜 그게 정답인지 1~2문장으로 설명해 주세요.",
    "- 단원명이 모호하면 해당 과목에서 가장 일반적인 의미로 해석해 주세요.",
  ].join("\n");

  try {
    const data = (await generateJson(prompt, SCHEMA)) as { questions?: unknown[] };
    const questions = (data.questions ?? []).filter(isRaw).slice(0, QUESTION_COUNT);
    if (questions.length < QUESTION_COUNT) {
      console.error("makeQuiz bad shape:", JSON.stringify(data).slice(0, 500));
      return { error: "문제를 제대로 만들지 못했어요. 다시 시도해 주세요." };
    }
    return { questions: questions.map(toQuestion) };
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
