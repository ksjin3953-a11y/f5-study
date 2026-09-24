import Image from "next/image";
import { BOSS_BONUS_INSECTS } from "@/lib/game_new";

// 과목 보스(매). HP = 아직 끝내지 않은 단원 수, 시험일 = 보스가 오는 날.
export function BossPanel({
  remaining,
  total,
  daysLeft,
}: {
  remaining: number;
  total: number;
  daysLeft: number | null; // 시험일이 없으면 null
}) {
  if (total === 0) return null;

  const defeated = remaining === 0;
  const passed = daysLeft !== null && daysLeft < 0;
  const hpPercent = Math.round((remaining / total) * 100);
  // 시험이 가깝고 HP가 많이 남았으면 보스가 흥분한다.
  const angry = !defeated && !passed && daysLeft !== null && daysLeft <= 7 && hpPercent >= 50;

  const status = defeated
    ? `격파! 곤충 ${BOSS_BONUS_INSECTS}개를 얻었어요 🎉`
    : passed
      ? "보스가 지나갔어요."
      : daysLeft === null
        ? "시험일을 정하면 보스가 언제 오는지 알려드려요."
        : daysLeft === 0
          ? "오늘 보스가 왔어요!"
          : `보스 도착까지 D-${daysLeft}`;

  return (
    <section
      className={`flex items-center gap-4 rounded-2xl px-4 py-4 ${
        defeated ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-stone-900 text-white"
      }`}
    >
      <div className="relative shrink-0">
        <Image
          src="/hawk_new.png"
          alt="보스 매"
          width={70}
          height={108}
          className={
            defeated
              ? "boss-defeated"
              : angry
                ? "boss-angry"
                : "boss-hover"
          }
        />
        {defeated && (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-md border-2 border-emerald-600 bg-white/80 px-1.5 text-sm font-black text-emerald-700">
            격파
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">보스 · 매</span>
          <span className={`text-sm font-bold ${defeated ? "text-emerald-700" : "text-red-400"}`}>
            HP {remaining}/{total}
          </span>
        </div>
        <div className={`h-3 overflow-hidden rounded-full ${defeated ? "bg-emerald-100" : "bg-stone-700"}`}>
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-400 transition-[width] duration-700"
            style={{ width: `${hpPercent}%` }}
          />
        </div>
        <span className={`text-xs ${defeated ? "text-emerald-700" : "text-stone-300"}`}>{status}</span>
        {!defeated && !passed && (
          <span className="text-xs text-stone-400">단원을 하나 끝낼 때마다 HP가 1씩 깎여요.</span>
        )}
      </div>
    </section>
  );
}
