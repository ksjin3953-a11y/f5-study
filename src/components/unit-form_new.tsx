"use client";

import { useActionState, useEffect, useRef } from "react";
import { createUnits, type UnitFormState } from "@/app/unit-actions_new";
import { MascotSays } from "@/components/mascot_new";
import { Button } from "@/components/ui-button_new";

const initialState: UnitFormState = { error: null };

export function UnitForm({ subjectId }: { subjectId: string }) {
  const [state, formAction, pending] = useActionState(createUnits, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // 저장에 성공하면 입력칸을 비운다. 새 마디가 그려지면 경로(unit-path_new)가 그쪽으로 스크롤한다.
  useEffect(() => {
    if (!pending && state.error === null) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="subject_id" value={subjectId} />
      <MascotSays>한 줄에 하나씩 적어줘. 예) 1장 클래스와 객체</MascotSays>
      <textarea
        name="titles"
        required
        rows={5}
        aria-label="단원 목록 (한 줄에 하나)"
        placeholder={"1장 클래스와 객체\n2장 상속"}
        className="field min-h-40"
      />
      {state.error && (
        <MascotSays size="sm" mood="rainy">
          {state.error}
        </MascotSays>
      )}
      <Button disabled={pending} variant="success" size="md" className="w-full">
        {pending ? "길 내는 중…" : "길 내기"}
      </Button>
    </form>
  );
}
