"use client";

import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { deleteSubject } from "@/app/subject-actions_new";

// 과목 삭제 버튼. 한 번 확인받은 뒤 지우고 메인으로 돌아간다(지운 과목 페이지에 남지 않게).
export function DeleteSubject({ subjectId }: { subjectId: string }) {
  const router = useRouter();

  return (
    <form
      action={async () => {
        await deleteSubject(subjectId);
        router.replace("/");
      }}
      onSubmit={(e) => {
        // 취소하면 preventDefault로 form action이 실행되지 않는다.
        if (!confirm("정말 삭제할까요? 단원과 기록이 모두 사라져요.")) e.preventDefault();
      }}
    >
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="h-9 shrink-0 whitespace-nowrap rounded-2xl border-2 border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? "삭제하는 중…" : "과목 삭제"}
    </button>
  );
}
