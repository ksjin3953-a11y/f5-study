import Image from "next/image";
import { LoginButton } from "@/components/auth-buttons_new";
import { WeatherIcon } from "@/components/weather-icon_new";

// 비로그인 첫 화면. 딱따구리와 보스 매가 마주보는 히어로 + 기능 소개 + 로그인.

const FEATURES = [
  {
    title: "딱따구리 컨디션",
    desc: "지금 속도면 시험 날 몇 %까지 끝낼지, 딱따구리가 맑음·비·폭풍으로 알려줘요.",
    tint: "bg-sky-100/70",
    images: [{ src: "/mascot_new.png", w: 30, h: 44 }],
    weather: true, // 오른쪽 위에 날씨 아이콘을 겹쳐 둔다
  },
  {
    title: "딱따구리 키우기",
    desc: "공부하면 먹이를 받아요. 먹일수록 알에서 아기, 어른으로 자라요.",
    tint: "bg-amber-100/70",
    images: [
      { src: "/mascot-egg_new.png", w: 22, h: 28 },
      { src: "/mascot-baby_new.png", w: 28, h: 40 },
    ],
  },
  {
    title: "보스 매 격파",
    desc: "시험 날 매가 와요. 단원을 끝낼 때마다 매의 HP가 깎여요.",
    tint: "bg-boss",
    images: [{ src: "/hawk_new.png", w: 28, h: 44 }],
  },
];

// 앱 셸 없이 화면 전체를 쓴다. 모바일은 한 줄, 데스크톱은 왼쪽 히어로 · 오른쪽 소개 2단.
export function Landing({ loginError }: { loginError: boolean }) {
  return (
    <main className="flex flex-1 items-center px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(2.5rem+env(safe-area-inset-top))] lg:px-10">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-8 break-keep lg:grid-cols-2 lg:gap-16">
        {/* 히어로: 왼쪽 아래 딱따구리, 오른쪽 위 매 */}
        {/* 배경은 무대 풍경. 딱따구리는 앞쪽 잔디 위에, 매는 하늘에 떠 있다. */}
        <div className="relative h-64 overflow-hidden rounded-3xl bg-[url(/stage_new.svg)] bg-cover bg-[position:14%_bottom] sm:h-80 lg:h-[460px]">
          <div className="absolute bottom-2 left-5 rotate-6 drop-shadow-[0_8px_8px_rgb(60_110_70/0.25)] sm:bottom-3 lg:bottom-5 lg:left-8">
            <Image
              src="/mascot_new.png"
              alt="딱따구리"
              width={200}
              height={297}
              priority
              className="mascot-hop h-auto w-[120px] sm:w-[150px] lg:w-[200px]"
            />
          </div>

          <div className="absolute right-4 top-4 -rotate-6 lg:right-8 lg:top-8">
            <Image
              src="/hawk_new.png"
              alt="보스 매"
              width={150}
              height={232}
              priority
              className="boss-angry h-auto w-[90px] sm:w-[110px] lg:w-[150px]"
            />
          </div>

          {/* 매의 말풍선. 꼬리가 매 쪽(오른쪽)을 향한다 */}
          <p className="absolute right-[116px] top-9 whitespace-nowrap rounded-2xl rounded-tr-sm bg-boss px-3 py-2 text-sm font-semibold text-white shadow-lg sm:right-[138px] lg:right-[190px] lg:top-14 lg:text-base">
            시험 날, 내가 간다 😏
            <span className="absolute -right-1.5 top-2 h-3 w-3 rotate-45 bg-boss" aria-hidden />
          </p>
        </div>

        <div className="flex flex-col gap-7">
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-5xl leading-none text-ink lg:text-6xl">F5 Study</h1>
            <p className="text-xl font-bold leading-snug lg:text-2xl">
              시험 날 <span className="text-boss-accent">매</span>가 온다.
              <br />
              그 전에 <span className="text-forest">딱따구리</span>를 키워라.
            </p>
            <p className="text-sm leading-relaxed text-zinc-600 lg:text-base">
              과목별 진도로 시험 날 결과를 미리 예보해요.
              <br />
              공부할수록 딱따구리가 자라고, 보스 매의 HP가 깎여요.
            </p>
          </div>

          <ul className="flex flex-col divide-y divide-zinc-200/80">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-center gap-3 py-3">
                <span
                  className={`relative flex h-14 w-14 shrink-0 items-end justify-center gap-0.5 rounded-2xl pb-1.5 ${f.tint}`}
                >
                  {f.images.map((img) => (
                    <Image key={img.src} src={img.src} alt="" width={img.w} height={img.h} />
                  ))}
                  {f.weather && (
                    <WeatherIcon tone="sunny" emoji="☀️" size={20} className="absolute -right-1.5 -top-1.5" />
                  )}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-semibold">{f.title}</span>
                  <span className="text-xs leading-relaxed text-zinc-500">{f.desc}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3">
            <LoginButton />
            {loginError && <p className="text-sm text-red-600">로그인에 실패했어요. 다시 시도해 주세요.</p>}
          </div>
        </div>
      </div>
    </main>
  );
}
