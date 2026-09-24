"use client";

import { useActionState, useEffect, useRef } from "react";
import { createSubject, type SubjectFormState } from "@/app/subject-actions_new";

const initialState: SubjectFormState = { error: null };

export function SubjectForm() {
  const [state, formAction, pending] = useActionState(createSubject, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // 저장에 성공하면 입력칸을 비운다.
  useEffect(() => {
    if (!pending && state.error === null) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border border-zinc-200 p-5"
    >
      <h2 className="font-semibold">과목 추가</h2>
      <input
        name="name"
        required
        placeholder="과목명 (예: 자료구조)"
        className="h-10 rounded-lg border border-zinc-300 px-3"
      />
      <input
        name="professor"
        placeholder="교수명 (선택)"
        className="h-10 rounded-lg border border-zinc-300 px-3"
      />
      <label className="flex flex-col gap-1 text-sm text-zinc-600">
        시험일
        <input
          name="exam_date"
          type="date"
          className="h-10 rounded-lg border border-zinc-300 px-3 text-base text-zinc-900"
        />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        disabled={pending}
        className="h-10 rounded-full bg-zinc-900 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "저장 중…" : "추가하기"}
      </button>
    </form>
  );
}
