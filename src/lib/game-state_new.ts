// 서버에서 게임 상태(출석, 가방, 경험치, 레벨)를 계산한다. 화면과 먹이 주기 액션이 같이 쓴다.

import type { createClient } from "@/lib/supabase/server_new";
import {
  FOOD_KEYS,
  attendanceReward,
  earnedFood,
  foodBag,
  isFood,
  levelFromXp,
  totalXp,
  type Food,
} from "@/lib/game_new";
import { todayInSeoul } from "@/lib/weather_new";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// 게임 계산에 필요한 과목·단원 조회 문자열
export const GAME_UNITS_SELECT =
  "units(status, completed_at, quiz_results(passed, created_at), study_logs(id))";

// 오늘(한국 시간) 출석을 기록하고 누적 출석일을 돌려준다. 하루에 한 번만 기록된다.
async function checkIn(supabase: Supabase) {
  const { error: insertError } = await supabase
    .from("check_ins")
    .upsert({ day: todayInSeoul() }, { onConflict: "user_id,day", ignoreDuplicates: true });
  const { count, error } = await supabase
    .from("check_ins")
    .select("id", { count: "exact", head: true });
  // check_ins 테이블이 아직 없으면(SQL 미실행) 출석 보상 없이 진행한다.
  if (insertError || error) {
    console.error("check_ins unavailable:", (insertError ?? error)?.message);
    return 0;
  }
  return count ?? 0;
}

export async function loadGameState(supabase: Supabase, subjects: Parameters<typeof earnedFood>[0]) {
  const attendanceDays = await checkIn(supabase);

  const fed: Record<Food, number> = { insect: 0, pinecone: 0, wood: 0 };
  const { data, error } = await supabase.from("feedings").select("food");
  // feedings 테이블이 아직 없으면(SQL 미실행) 먹이 주기만 막고 나머지는 보여준다.
  const ready = !error;
  if (error) console.error("feedings unavailable:", error.message);
  for (const row of data ?? []) if (isFood(row.food)) fed[row.food]++;

  const earned = earnedFood(subjects, attendanceDays);
  const xp = totalXp(fed);
  return {
    ready,
    bag: foodBag(earned, fed),
    xp,
    ...levelFromXp(xp),
    foods: FOOD_KEYS,
    attendance: attendanceDays > 0
      ? { days: attendanceDays, todayWood: attendanceReward(attendanceDays) }
      : null,
  };
}
