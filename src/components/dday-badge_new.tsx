import { dDayLabel } from "@/lib/weather_new";

// 시험 D-day 배지. 가까울수록 눈에 띄는 색으로 보여 준다.
export function DDayBadge({ days }: { days: number }) {
  const tone =
    days < 0
      ? "bg-zinc-100 text-zinc-500"
      : days <= 3
        ? "bg-red-500 text-white"
        : days <= 7
          ? "bg-orange-100 text-orange-700"
          : "bg-sky-100 text-sky-700";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${tone}`}>
      {dDayLabel(days)}
    </span>
  );
}
