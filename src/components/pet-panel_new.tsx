"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { feed } from "@/app/feed-actions_new";
import { ATTENDANCE_BONUS_EVERY, FOODS, type Food } from "@/lib/game_new";

type Props = {
  ready: boolean;
  bag: Record<Food, number>;
  foods: Food[];
  xp: number;
  level: number;
  current: number;
  need: number;
  attendance: { days: number; todayWood: number } | null;
};

// 먹는 연출 한 번. key가 바뀌면 애니메이션이 다시 시작된다.
type Bite = { key: number; food: Food; xp: number };

export function PetPanel({ ready, bag, foods, xp, level, current, need, attendance }: Props) {
  const [pending, startTransition] = useTransition();
  const [bite, setBite] = useState<Bite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [levelUp, setLevelUp] = useState(false);
  const prevLevel = useRef(level);

  // 먹이를 먹고 레벨이 오르면 축하 표시
  useEffect(() => {
    if (level > prevLevel.current) {
      setLevelUp(true);
      const t = setTimeout(() => setLevelUp(false), 2200);
      prevLevel.current = level;
      return () => clearTimeout(t);
    }
    prevLevel.current = level;
  }, [level]);

  function onFeed(food: Food) {
    setError(null);
    startTransition(async () => {
      const result = await feed(food);
      if (result.ok) {
        const key = Date.now();
        setBite({ key, food, xp: result.xp });
        // 연출이 끝나면 다시 통통 튀는 기본 상태로
        setTimeout(() => setBite((b) => (b?.key === key ? null : b)), 1400);
      } else setError(result.error);
    });
  }

  const percent = Math.round((current / need) * 100);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
      <div className="flex items-center gap-4">
        <div className="relative h-[104px] w-[70px] shrink-0">
          <Image
            key={bite?.key ?? "idle"}
            src="/mascot_new.png"
            alt="내 딱따구리"
            width={70}
            height={104}
            className={`absolute bottom-0 left-0 ${bite ? "pet-munch" : "mascot-hop"}`}
          />
          {bite && (
            <>
              <Image
                key={`food-${bite.key}`}
                src={FOODS[bite.food].image}
                alt=""
                width={34}
                height={34}
                className="pet-food-drop pointer-events-none absolute left-[18px] top-0"
              />
              <span
                key={`xp-${bite.key}`}
                className="pet-xp-float pointer-events-none absolute -right-6 top-2 text-sm font-bold text-amber-600"
              >
                +{bite.xp} XP
              </span>
            </>
          )}
          {levelUp && (
            <span className="pet-level-up pointer-events-none absolute -top-5 left-1/2 whitespace-nowrap rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
              레벨 업!
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">내 딱따구리</span>
            <span className="text-lg font-bold text-amber-700">Lv.{level}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-amber-100">
            <div
              className="h-full rounded-full bg-amber-500 transition-[width] duration-700"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500">
            다음 레벨까지 {need - current} XP · 누적 {xp} XP
          </span>
        </div>
      </div>

      {attendance && (
        <p className="rounded-xl bg-white px-3 py-2 text-xs text-zinc-600 ring-1 ring-amber-100">
          📅 출석 <b className="text-amber-700">{attendance.days}일째</b> · 오늘 나무 조각{" "}
          <b className="text-amber-700">{attendance.todayWood}개</b>를 받았어요
          {attendance.days % ATTENDANCE_BONUS_EVERY !== 0 &&
            ` (${ATTENDANCE_BONUS_EVERY - (attendance.days % ATTENDANCE_BONUS_EVERY)}일 뒤 2개 보너스)`}
        </p>
      )}

      <ul className="grid grid-cols-3 gap-2">
        {foods.map((f) => (
          <li key={f} className="flex flex-col items-center gap-1 rounded-xl bg-white px-2 py-2 ring-1 ring-amber-100">
            <Image src={FOODS[f].image} alt="" width={40} height={40} className="h-10 w-10 object-contain" />
            <span className="text-xs font-medium">
              {FOODS[f].name} ×{bag[f]}
            </span>
            <span className="text-[10px] text-zinc-400">
              {FOODS[f].how} · +{FOODS[f].xp}XP
            </span>
            <button
              onClick={() => onFeed(f)}
              disabled={!ready || pending || bag[f] <= 0}
              className="mt-1 h-7 w-full rounded-full bg-amber-500 text-xs font-semibold text-white transition-colors hover:bg-amber-600 disabled:bg-zinc-200 disabled:text-zinc-400"
            >
              먹이 주기
            </button>
          </li>
        ))}
      </ul>

      {!ready && (
        <p className="text-xs text-zinc-500">먹이 주기를 쓰려면 DB에 feedings 테이블을 만들어 주세요.</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
