import Image from "next/image";
import { PartyPopper } from "lucide-react";
import { BOSS_BONUS_INSECTS } from "@/lib/game_new";
import { BOSSES, type ExamKind } from "@/lib/exam_new";

// 과목 보스(매). HP = 아직 끝내지 않은 단원 수, 시험일 = 보스가 오는 날.
// 중간고사가 있으면 아기 매(중간 보스) → 부모 매(기말 보스) 순서로 온다(lib/exam_new.ts).
// 게임 보스 HP 바 모양: 가시 달린 원형 초상화 + BOSS 이름판 + 양 끝이 뾰족한 게이지
const HP_PER_UNIT = 1000; // 화면에 보이는 HP 단위(단원 1개 = 1,000)

// 양 끝이 뾰족한 육각형 모양
const BAR_SHAPE = "polygon(12px 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 12px 100%, 0 50%)";
const PLATE_SHAPE = "polygon(10px 0, calc(100% - 14px) 0, 100% 100%, 0 100%)";

// 초상화 테두리의 가시 8개
const SPIKES = Array.from({ length: 8 }, (_, i) => (i * 360) / 8 + 22.5);

function Portrait({ className, defeated, kind }: { className: string; defeated: boolean; kind: ExamKind }) {
  const boss = BOSSES[kind];
  return (
    <div className={`relative h-[76px] w-[76px] shrink-0 ${className}`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        {SPIKES.map((deg) => (
          <path
            key={deg}
            d="M50 -4 L56 12 L44 12 Z"
            className={defeated ? "fill-gray-400" : "fill-boss-accent"}
            transform={`rotate(${deg} 50 50)`}
          />
        ))}
        <circle cx="50" cy="50" r="41" className="fill-boss" />
        <circle
          cx="50"
          cy="50"
          r="41"
          fill="none"
          className={defeated ? "stroke-gray-400" : "stroke-boss-accent"}
          strokeWidth="6"
        />
        <circle cx="50" cy="50" r="36" fill="none" className="stroke-black" strokeOpacity="0.25" strokeWidth="1.5" />
      </svg>
      {/* 매 전체(발까지)가 원 안에 다 보이게 */}
      <div className="absolute inset-[9px] flex items-center justify-center overflow-hidden rounded-full bg-stone-100">
        <Image
          src={boss.image}
          alt={`보스 ${boss.name}`}
          width={kind === "mid" ? 38 : 32}
          height={49}
          className={defeated ? "grayscale" : ""}
        />
      </div>
      {defeated && (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded border-2 border-emerald-600 bg-white/85 px-1 text-xs font-black text-emerald-700">
          격파
        </span>
      )}
    </div>
  );
}

// 화면 오른쪽 위에 두는 작은 보스 카드(매 그림 + HP 바)
export function BossMini({
  remaining,
  total,
  kind = "final",
}: {
  remaining: number;
  total: number;
  kind?: ExamKind;
}) {
  if (total === 0) return null;
  const defeated = remaining === 0;
  const boss = BOSSES[kind];
  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${
        defeated ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-boss text-white"
      }`}
    >
      <Image
        src={boss.image}
        alt={`보스 ${boss.name}`}
        width={kind === "mid" ? 31 : 26}
        height={40}
        className={defeated ? "boss-defeated" : "boss-hover"}
      />
      <div className="flex w-16 flex-col gap-1">
        <span className={`text-[10px] font-semibold ${defeated ? "text-emerald-700" : "text-stone-300"}`}>
          {defeated ? "격파!" : `${kind === "mid" ? "중간" : "보스"} · ${boss.name}`}
        </span>
        <div className={`h-1.5 overflow-hidden rounded-full ${defeated ? "bg-emerald-100" : "bg-stone-700"}`}>
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-400 transition-[width] duration-700"
            style={{ width: `${(remaining / total) * 100}%` }}
          />
        </div>
        <span className={`font-display text-[10px] tabular-nums ${defeated ? "text-emerald-700" : "text-red-400"}`}>
          HP {remaining}/{total}
        </span>
      </div>
    </div>
  );
}

export function BossPanel({
  remaining,
  total,
  daysLeft,
  kind = "final",
  after,
}: {
  remaining: number;
  total: number;
  daysLeft: number | null; // 시험일이 없으면 null
  kind?: ExamKind;
  // 기말 보스일 때 중간 보스가 어떻게 됐는지: 잡았음 / 중간고사가 지나감
  after?: "defeated" | "over";
}) {
  if (total === 0) return null;
  const boss = BOSSES[kind];

  const defeated = remaining === 0;
  const passed = daysLeft !== null && daysLeft < 0;
  const hpPercent = (remaining / total) * 100;
  // 시험이 가깝고 HP가 많이 남았으면 보스가 흥분한다.
  const angry = !defeated && !passed && daysLeft !== null && daysLeft <= 7 && hpPercent >= 50;

  const hit = `단원을 하나 끝낼 때마다 HP ${HP_PER_UNIT.toLocaleString("en-US")}씩 깎여요.`;
  const status =
    kind === "mid"
      ? defeated
        ? "아기 매 격파! 화난 부모 매가 기말고사 날 찾아와요."
        : daysLeft === null
          ? `중간고사 범위를 지키는 아기 매예요. ${hit}`
          : daysLeft === 0
            ? "오늘 중간고사, 아기 매가 왔어요!"
            : `중간고사 날 아기 매가 와요. ${hit}`
      : defeated
        ? `격파! 곤충 ${BOSS_BONUS_INSECTS}개를 얻었어요`
        : passed
          ? "보스가 지나갔어요."
          : daysLeft === null
            ? "시험일을 정하면 보스가 언제 오는지 알려드려요."
            : daysLeft === 0
              ? "오늘 보스가 왔어요!"
              : `${
                  after === "defeated"
                    ? "아기 매를 잡았더니 부모 매가 날아왔어요! 기말고사 날 결판을 내요. "
                    : after === "over"
                      ? "중간고사가 끝나고 부모 매가 날아왔어요. "
                      : "시험 날 보스가 와요. "
                }${hit}`;

  return (
    <section className="flex flex-col gap-2">
      <div className="relative flex items-center">
        <Portrait
          kind={kind}
          defeated={defeated}
          className={defeated ? "" : angry ? "boss-angry" : "boss-hover"}
        />

        <div className="-ml-3 flex min-w-0 flex-1 flex-col gap-1">
          {/* 이름판 */}
          <div
            className="flex w-fit items-center gap-2 bg-boss py-1 pl-5 pr-6 font-display text-white"
            style={{ clipPath: PLATE_SHAPE }}
          >
            <span className="text-[10px] text-boss-accent">✦</span>
            <span className={`text-base tracking-wide ${defeated ? "text-zinc-400" : "text-[#ff8a95]"}`}>
              {kind === "mid" ? "MID BOSS" : "BOSS"}
            </span>
            <span className="text-[10px] text-boss-accent">✦</span>
            <span className="text-sm">{boss.name}</span>
          </div>

          {/* HP 게이지 */}
          <div className="relative">
            <div className="bg-boss-accent p-[2px]" style={{ clipPath: BAR_SHAPE }}>
              <div className="bg-boss p-[3px]" style={{ clipPath: BAR_SHAPE }}>
                <div className="relative h-7 overflow-hidden bg-[#3a3439]" style={{ clipPath: BAR_SHAPE }}>
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-b from-[#ff5a67] to-[#d8303f] transition-[width] duration-700"
                    style={{ width: `${hpPercent}%` }}
                  >
                    {/* 윗부분 광택 */}
                    <div className="absolute inset-x-0 top-0 h-1/2 bg-white/20" />
                  </div>
                  <span className="absolute inset-y-0 right-5 flex items-center font-display text-xs tabular-nums text-white">
                    {(remaining * HP_PER_UNIT).toLocaleString("en-US")}
                    <span className="ml-1 text-zinc-400">
                      / {(total * HP_PER_UNIT).toLocaleString("en-US")}
                    </span>
                  </span>
                </div>
              </div>
            </div>
            <span className="absolute -right-1 top-1/2 -translate-y-1/2 text-sm text-boss-accent" aria-hidden>
              ◆
            </span>
          </div>
        </div>
      </div>

      <p className={`text-xs ${defeated ? "text-emerald-700" : "text-zinc-500"}`}>
        {status}
        {defeated && <PartyPopper className="ml-1 inline size-3.5 align-[-0.15em] text-brand" aria-hidden />}
      </p>
    </section>
  );
}
