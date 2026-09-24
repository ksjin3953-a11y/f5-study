"use client";

import { useActionState, useEffect, useRef } from "react";
import { createUnits, type UnitFormState } from "@/app/unit-actions_new";

const initialState: UnitFormState = { error: null };

export function UnitForm({ subjectId }: { subjectId: string }) {
  const [state, formAction, pending] = useActionState(createUnits, initialState);
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
      <h2 className="font-semibold">단원 추가</h2>
      <input type="hidden" name="subject_id" value={subjectId} />
      <textarea
        name="titles"
        required
        rows={4}
        placeholder={"한 줄에 하나씩 적으면 여러 개를 한 번에 추가해요.\n1장 클래스와 객체\n2장 상속"}
        className="rounded-lg border border-zinc-300 px-3 py-2"
      />
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
