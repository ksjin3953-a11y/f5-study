"use client";

import { useActionState, useEffect, useRef } from "react";
import { createRecord, type RecordFormState } from "@/app/record-actions_new";

const initialState: RecordFormState = { error: null, savedAt: null };

export function RecordForm({ unitId }: { unitId: string }) {
  const [state, formAction, pending] = useActionState(createRecord, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // 저장에 성공하면 입력칸을 비운다.
  useEffect(() => {
    if (state.savedAt) formRef.current?.reset();
  }, [state.savedAt]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="unit_id" value={unitId} />
      <textarea
        name="memo"
        rows={2}
        placeholder="메모 (선택): 오늘 공부한 내용, 헷갈린 부분"
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
      />
      <div className="flex items-center gap-2 text-sm">
        <span className="text-zinc-600">퀴즈</span>
        <input
          name="score"
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="맞은 수"
          className="h-9 w-20 rounded-lg border border-zinc-300 px-2"
        />
        <span>/</span>
        <input
          name="total"
          type="number"
          min={1}
          inputMode="numeric"
          placeholder="전체"
          className="h-9 w-20 rounded-lg border border-zinc-300 px-2"
        />
        <span className="text-xs text-zinc-400">(선택)</span>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        disabled={pending}
        className="h-9 rounded-full bg-zinc-900 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "저장 중…" : "기록 남기기"}
      </button>
    </form>
  );
}
