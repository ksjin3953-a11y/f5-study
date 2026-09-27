"use client";

import { useActionState, useEffect, useRef } from "react";
import { createRecord, type RecordFormState } from "@/app/record-actions_new";
import { MascotSays } from "@/components/mascot_new";
import { Button } from "@/components/ui-button_new";

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
        aria-label="메모"
        placeholder="메모 (선택): 오늘 공부한 내용, 헷갈린 부분"
        className="field text-base"
      />
      <div className="flex items-center gap-2 text-sm">
        <span className="text-zinc-600">퀴즈</span>
        <input
          name="score"
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="맞은 수"
          aria-label="맞은 수"
          className="field h-11 w-24 px-3 text-base"
        />
        <span>/</span>
        <input
          name="total"
          type="number"
          min={1}
          inputMode="numeric"
          placeholder="전체"
          aria-label="전체 문제 수"
          className="field h-11 w-24 px-3 text-base"
        />
        <span className="text-xs text-zinc-400">(선택)</span>
      </div>
      {state.error && (
        <MascotSays size="sm" mood="rainy">
          {state.error}
        </MascotSays>
      )}
      <Button disabled={pending} variant="success" size="sm" className="w-full">
        {pending ? "저장 중…" : "기록 저장"}
      </Button>
    </form>
  );
}
