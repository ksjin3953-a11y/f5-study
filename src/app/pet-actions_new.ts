"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server_new";
import { PET_NAME_MAX } from "@/lib/game_new";

// 딱따구리 이름 정하기. 테이블 없이 로그인 계정의 user_metadata에 저장한다.
export async function renamePet(name: string): Promise<{ error: string | null }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "이름을 입력해 주세요." };
  if ([...trimmed].length > PET_NAME_MAX) return { error: `이름은 ${PET_NAME_MAX}자까지예요.` };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: { pet_name: trimmed } });
  if (error) {
    console.error("renamePet failed:", error);
    return { error: "이름을 저장하지 못했어요. 다시 시도해 주세요." };
  }

  refresh();
  return { error: null };
}
