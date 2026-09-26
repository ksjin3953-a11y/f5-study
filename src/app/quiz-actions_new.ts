"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server_new";
import { GeminiError, generateJson, type GeminiFile } from "@/lib/gemini_new";
import { geminiFileFor, type MaterialRow } from "@/lib/materials_new";
import { QUIZ_PASS_RATIO } from "@/lib/weather_new";
import { halfLifeDays } from "@/lib/memory_new";

export type QuizQuestion = {
  question: string;
  choices: string[];
  answer: number; // choices의 정답 위치
  explanation: string;
};

const QUESTION_COUNT = 5;
const CHOICE_COUNT = 4;
const MAX_MATERIALS = 3; // 한 번에 읽힐 강의자료 수(최근 것부터)
const MAX_MEMOS = 5; // 프롬프트에 넣을 학습 메모 수(최근 것부터)

// 출제자 말투·규칙(팀에서 준비한 프롬프트). 받은 보기는 서버가 한 번 더 섞는다.
const SYSTEM = `너는 대학 강의 퀴즈 출제자인데 텐션은 듀오링고야.
단원 제목(및 학습 메모)을 바탕으로 4지선다 객관식 ${QUESTION_COUNT}문제를 출제해.
근거 자료가 부족하면 해당 분야 통용 개념 위주로 출제해.
문제/보기는 장난치지 말고 학술적으로 정확하게 써.
explanation(해설)에서만 캐주얼하고 재치있는 말투 써도 돼 —
정답 여부와 이유는 한 줄로 명확하게 먼저 말하고, 그다음에 재치 한마디.
해설에서 정답을 보기 번호(1번, 2번…)로 가리키지 말고 정답 보기 내용을 그대로 말해.
반드시 JSON으로만 답해.

출력 예시
{ "questions": [
  {
    "question": "스택(Stack)의 자료 처리 방식으로 옳은 것은?",
    "choices": ["FIFO", "LIFO", "랜덤", "우선순위"],
    "answerIndex": 1,
    "explanation": "정답은 LIFO. 마지막에 넣은 접시부터 빼 먹는 거랑 똑같음 🍽️ 이거 놓치면 다음 문제도 도미노로 틀려요."
  }
]}`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          choices: { type: "ARRAY", items: { type: "STRING" } },
          answerIndex: { type: "INTEGER" },
          explanation: { type: "STRING" },
        },
        required: ["question", "choices", "answerIndex", "explanation"],
      },
    },
  },
  required: ["questions"],
};

type Raw = { question: string; choices: string[]; answerIndex: number; explanation: string };

// 보기 4개(서로 다름), 정답 위치 0~3인지 확인한다.
function isRaw(q: unknown): q is Raw {
  const r = q as Raw;
  return (
    typeof r?.question === "string" &&
    typeof r.explanation === "string" &&
    Array.isArray(r.choices) &&
    r.choices.length === CHOICE_COUNT &&
    r.choices.every((c) => typeof c === "string" && c.trim()) &&
    new Set(r.choices.map((c) => c.trim())).size === CHOICE_COUNT &&
    Number.isInteger(r.answerIndex) &&
    r.answerIndex >= 0 &&
    r.answerIndex < CHOICE_COUNT
  );
}

// 보기를 섞고 정답 위치도 같이 옮긴다. 모델이 정답을 한 자리에 몰아 두는 것을 막는다.
// 해설이 "2번"처럼 보기 번호를 말하면 섞었을 때 틀리므로 그 문제는 섞지 않는다.
function toQuestion(r: Raw): QuizQuestion {
  const order = [...r.choices.keys()];
  const mentionsNumber = /[1-4]\s*번/.test(r.explanation);
  for (let i = order.length - 1; i > 0 && !mentionsNumber; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    question: r.question,
    choices: order.map((k) => r.choices[k].trim()),
    answer: order.indexOf(r.answerIndex),
    explanation: r.explanation,
  };
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
    .select("title, subject_id, study_logs(memo, studied_at)")
    .eq("id", unitId)
    .maybeSingle();
  if (!unit) return { error: "단원을 찾을 수 없어요." };
  const memos = [...unit.study_logs]
    .filter((l) => l.memo?.trim())
    .sort((a, b) => b.studied_at.localeCompare(a.studied_at))
    .slice(0, MAX_MEMOS)
    .map((l) => l.memo!.trim());
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
    `과목: ${subject?.name ?? ""}`,
    `단원: ${unit.title}`,
    memos.length > 0
      ? `학습 메모(학생이 공부하며 남긴 메모야. 헷갈려 한 부분을 확인하는 문제를 섞어 줘):\n${memos
          .map((m) => `- ${m}`)
          .join("\n")}`
      : "학습 메모: 없음",
    "",
    ...(files.length > 0
      ? [
          "첨부한 PDF는 이 과목의 실제 강의자료야. 문제는 반드시 강의자료 내용을 근거로 내 줘.",
          `강의자료에 여러 단원이 섞여 있으면 "${unit.title}"에 해당하는 부분에서만 내 줘.`,
          "강의자료의 정의·기호·예제가 일반 교재와 다르면 강의자료를 따라 줘.",
          "explanation 끝에 근거가 된 슬라이드 제목이나 쪽을 (근거: …) 형식으로 붙여 줘.",
        ]
      : ["강의자료는 없어. 단원명이 모호하면 이 과목에서 가장 일반적인 의미로 해석해 줘."]),
    "용어 암기보다 개념 이해와 적용을 묻는 문제를 섞고, 난이도는 학부 중간고사 수준으로 해 줘.",
  ].join("\n");

  try {
    const data = (await generateJson(prompt, SCHEMA, files, SYSTEM)) as { questions?: unknown[] };
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
): Promise<{ error: string | null; passed: boolean; wasDone?: boolean; nextReviewDays?: number }> {
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
    .select("id, status, quiz_results(passed, created_at)")
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
  // 통과하면 반감기가 두 배가 된다(망각 곡선). 다음 복습은 새 반감기 뒤.
  const nextReviewDays = passed
    ? halfLifeDays({ ...unit, completed_at: null, quiz_results: [...unit.quiz_results, { passed, created_at: "" }] })
    : undefined;
  return { error: null, passed, wasDone: unit.status === "done", nextReviewDays };
}
