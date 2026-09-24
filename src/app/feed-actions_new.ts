"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server_new";
import { FOODS, isFood } from "@/lib/game_new";
import { GAME_UNITS_SELECT, loadGameState } from "@/lib/game-state_new";

export type FeedResult = { ok: true; xp: number } | { ok: false; error: string };

// 먹이 주기. 가방에 남은 먹이가 있을 때만 먹인다(서버에서 다시 계산해 확인).
export async function feed(food: string): Promise<FeedResult> {
  if (!isFood(food)) return { ok: false, error: "알 수 없는 먹이예요." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요." };

  const { data: subjects } = await supabase.from("subjects").select(GAME_UNITS_SELECT);
  const state = await loadGameState(supabase, subjects ?? []);
  if (!state.ready) return { ok: false, error: "먹이 주기 준비 중이에요. (DB 테이블 필요)" };
  if (state.bag[food] <= 0) return { ok: false, error: `${FOODS[food].name}이 없어요.` };

  const { error } = await supabase.from("feedings").insert({ food });
  if (error) {
    console.error("feed failed:", error);
    return { ok: false, error: "먹이를 주지 못했어요. 다시 시도해 주세요." };
  }

  refresh();
  return { ok: true, xp: FOODS[food].xp };
}
