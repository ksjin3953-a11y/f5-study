import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server_new";
import { Landing } from "@/components/landing_new";
import { AppShell } from "@/components/app-shell_new";
import { setUnitStatus } from "@/app/unit-actions_new";
import {
  dateInSeoul,
  daysUntil,
  isDone,
  overallWeather,
  studyWeather,
  todayInSeoul,
  type Weather,
} from "@/lib/weather_new";
import { DDayBadge } from "@/components/dday-badge_new";
import { recommendToday } from "@/lib/recommend_new";
import { Suspense } from "react";
import { FutureMeBubble, FutureMeLoading } from "@/components/future-me-bubble_new";
import { SpeechBubble, moodMotion } from "@/components/mascot_new";
import { PetPanel } from "@/components/pet-panel_new";
import { loadGameState } from "@/lib/game-state_new";
import { lastStudyAt, petNameOf, stageForLevel } from "@/lib/game_new";
import { HawkTaunt } from "@/components/hawk-taunt_new";
import { Button, buttonClass } from "@/components/ui-button_new";
import { WeatherIcon } from "@/components/weather-icon_new";
import { CalendarDays, Check, Leaf, PartyPopper, Plus } from "lucide-react";

const TONE_CLASS: Record<Weather["tone"], string> = {
  sunny: "bg-amber-100",
  cloudy: "bg-sky-100",
  rainy: "bg-blue-100",
  stormy: "bg-violet-100",
  none: "bg-zinc-100",
};

// 무대 배너 말풍선: lib가 만든 문장·요약의 날씨 이모지를 아래 과목 목록과 같은 날씨 이미지로 바꿔 보여 준다.
const SUMMARY_TONES = ["stormy", "rainy", "cloudy", "sunny"] as const;
const TONE_EMOJI: Record<Weather["tone"], string> = { stormy: "⛈️", rainy: "🌧️", cloudy: "⛅", sunny: "☀️", none: "🌫️" };
const TONE_LABEL: Record<Weather["tone"], string> = { stormy: "폭풍", rainy: "비", cloudy: "구름", sunny: "맑음", none: "예보 전" };
const LEADING_EMOJI = /^(\p{Extended_Pictographic}️?)\s*/u;
const leadingEmoji = (text: string) => text.match(LEADING_EMOJI)?.[1] ?? null;
const withoutLeadingEmoji = (text: string) => text.replace(LEADING_EMOJI, "");

// 무대 배너 하늘 덧칠. 맑음·관측 중은 풍경 그대로.
const SKY_TINT: Record<Weather["tone"], string> = {
  sunny: "bg-transparent",
  cloudy: "bg-stage-cloudy/70",
  rainy: "bg-stage-rainy/75",
  stormy: "bg-stage-stormy/80",
  none: "bg-transparent",
};

export default async function Home({ searchParams }: PageProps<"/">) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: subjects } = user
    ? await supabase
        .from("subjects")
        .select(
          "id, name, professor, exam_date, created_at, units(id, title, status, position, completed_at, quiz_results(passed, created_at), study_logs(id, studied_at))"
        )
        .order("exam_date", { ascending: true, nullsFirst: false })
    : { data: null };
  const { recommendations, status: todayStatus, light: todayLight } = recommendToday(subjects ?? []);
  const petName = petNameOf(user);
  const game = user ? await loadGameState(supabase, subjects ?? []) : null;
  // 위험한 과목부터. 위험도가 같으면 시험일 순서(조회 순서)를 유지한다.
  const cards = (subjects ?? [])
    .map((s) => ({ ...s, weather: studyWeather(s) }))
    .sort((a, b) => b.weather.risk - a.weather.risk);

  const overall = overallWeather(cards);

  // "시험 날의 나": 예보가 있는 과목 중 가장 위험한 과목에 대해 말한다.
  const focus = cards.find((c) => c.weather.forecast);
  // 매 도발: 가장 위험한 과목을 들먹인다.
  const tauntTarget = focus ?? cards[0] ?? null;
  const lastStudy = lastStudyAt((subjects ?? []).flatMap((s) => s.units));
  // 마지막으로 공부한 날부터 오늘까지 지난 날 수(한국 날짜 기준). 기록이 없으면 null.
  const daysSinceStudy = lastStudy
    ? Math.round((Date.parse(todayInSeoul()) - Date.parse(dateInSeoul(lastStudy))) / 86_400_000)
    : null;
  // 예보는 오늘 아직 공부하지 않았을 때(마지막 학습 후 1일 이상, 또는 기록 없음)만 보여 준다.
  const futureMe =
    focus && (daysSinceStudy === null || daysSinceStudy >= 1) ? (
      <Suspense fallback={<FutureMeLoading petName={petName} />}>
        <FutureMeBubble
          petName={petName}
          subjectName={focus.name}
          weather={focus.weather}
          nextUnitTitle={
            recommendations.find((r) => r.subjectId === focus.id)?.units[0]?.title ??
            focus.units
              .filter((u) => !isDone(u))
              .sort((a, b) => a.position - b.position)[0]?.title ??
            null
          }
          daysSinceStudy={daysSinceStudy}
        />
      </Suspense>
    ) : null;

  if (!user) return <Landing loginError={error === "login"} />;

  const stage = stageForLevel(game?.level ?? 1);

  return (
    <AppShell active="home">
      <div className="flex flex-col gap-10">
        {/* 소개 헤더는 랜딩에만 둔다. 화면 읽기 프로그램용 제목만 남긴다. */}
        <h1 className="sr-only">F5 Study</h1>

        {/* 무대 배너: 클레이 풍경 위에서 지금 모습의 딱따구리가 오늘의 전체 날씨를 전한다.
            풍경의 오른쪽 아래는 비워 둔 자리라 딱따구리를 오른쪽에 세우고, 말풍선은 그 왼쪽에 둔다. */}
        <section className="relative h-[180px] overflow-hidden rounded-3xl bg-[url(/stage_new.svg)] bg-cover bg-right-bottom lg:h-[220px]">
          {/* 날씨에 따라 하늘만 덧칠한다. 아래쪽(언덕·잔디)으로 갈수록 투명해진다. */}
          <div
            className={`absolute inset-0 transition-colors duration-700 ${SKY_TINT[overall?.tone ?? "none"]}`}
            style={{ maskImage: "linear-gradient(to bottom, #000 35%, transparent 70%)" }}
            aria-hidden
          />
          <div className="relative flex h-full items-end justify-end gap-3 px-4 pb-2.5 lg:gap-4 lg:px-8 lg:pb-3">
            <SpeechBubble tail="right" className="mb-auto mt-4 lg:mt-6 lg:text-base">
              {overall ? (
                <>
                  {/* 문장 앞 이모지 대신 아래 과목 목록과 같은 날씨 이미지 */}
                  <span className="flex items-start gap-1.5">
                    <WeatherIcon
                      tone={overall.tone}
                      emoji={leadingEmoji(overall.message) ?? TONE_EMOJI[overall.tone]}
                      size={22}
                      className="mt-px"
                    />
                    <span>{withoutLeadingEmoji(overall.message)}</span>
                  </span>
                  {/* 요약도 이모지 대신 날씨 이미지 + 개수. 날씨가 아직 없는 과목은 "예보 전"으로 묶는다. */}
                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {SUMMARY_TONES.map((tone) => {
                      const n = cards.filter((c) => c.weather.tone === tone).length;
                      return n ? (
                        <span
                          key={tone}
                          className="inline-flex items-center gap-0.5 rounded-full bg-field py-0.5 pl-1 pr-2 text-xs font-bold tabular-nums text-zinc-600"
                        >
                          <WeatherIcon tone={tone} emoji={TONE_EMOJI[tone]} size={18} label={TONE_LABEL[tone]} />
                          {n}
                        </span>
                      ) : null;
                    })}
                    {cards.some((c) => c.weather.tone === "none") && (
                      <span className="rounded-full bg-field px-2 py-0.5 text-xs font-bold tabular-nums text-zinc-500">
                        예보 전 {cards.filter((c) => c.weather.tone === "none").length}
                      </span>
                    )}
                  </span>
                </>
              ) : (
                "아직 과목이 없어요. 첫 과목을 추가해 보세요!"
              )}
            </SpeechBubble>
            <Image
              src={stage.image}
              alt={`${petName} (${stage.name})`}
              width={Math.round((150 * stage.width) / stage.height)}
              height={150}
              priority
              className={`h-[112px] w-auto shrink-0 drop-shadow-[0_6px_6px_rgb(60_110_70/0.25)] lg:h-[150px] ${
                stage.name === "알" ? "pet-egg-wobble" : moodMotion(overall?.tone ?? "none") || "mascot-hop"
              }`}
            />
          </div>
        </section>

        {game && <PetPanel petName={petName} forecast={futureMe} {...game} />}

        {/* 주말 쉬는 날이나 오늘 몫을 다 끝낸 날에는 매가 도발하지 않는다 */}
        {todayStatus !== "rest" && todayStatus !== "done" && (
          <HawkTaunt
            key={lastStudy ?? "never"}
            lastStudyAt={lastStudy}
            petName={petName}
            target={
              tauntTarget && {
                subjectId: tauntTarget.id,
                subjectName: tauntTarget.name,
                daysLeft: tauntTarget.exam_date ? daysUntil(tauntTarget.exam_date) : null,
                remaining: tauntTarget.units.filter((u) => !isDone(u)).length,
              }
            }
            studyHref={tauntTarget ? `/subjects/${tauntTarget.id}` : undefined}
          />
        )}

        {(todayStatus === "rest" || todayStatus === "done") && (
          <section className="flex flex-col gap-2 rounded-3xl bg-forest-light p-5">
            <h2 className="text-xl font-bold">오늘의 공격</h2>
            <p className="flex items-start gap-1.5 text-sm text-emerald-800">
              {todayStatus === "rest" ? (
                <>
                  <Leaf className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden />
                  주말이라 오늘은 쉬는 날이에요. 푹 쉬고 월요일에 다시 달려요!
                </>
              ) : (
                <>
                  <PartyPopper className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                  오늘 몫을 다 끝냈어요! 남은 건 공격 계획표에 나눠 뒀으니 편하게 쉬어요.
                </>
              )}
            </p>
            <Link
              href="/calendar"
              className="flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline"
            >
              <CalendarDays className="size-4 text-forest" aria-hidden />
              이번 주 공격 계획표 보기 →
            </Link>
          </section>
        )}

        {recommendations.length > 0 && (
          <section className="flex flex-col gap-4 rounded-3xl bg-brand-light p-5">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-xl font-bold">
                오늘의 공격
                {todayLight && (
                  <span className="ml-1.5 inline-flex items-center gap-1 text-sm font-normal text-emerald-700">
                    <Leaf className="size-3.5 text-forest" aria-hidden />
                    주말이라 가볍게
                  </span>
                )}
              </h2>
              <p className="text-sm text-brand-dark/80">끝내면 매 HP가 깎여요</p>
            </div>
            <ul className="flex flex-col divide-y divide-brand/15">
              {recommendations.map((r) => {
                // 추천에는 이모지만 있어서, 같은 과목의 날씨(tone)는 과목 카드 목록에서 찾는다.
                const weather = cards.find((c) => c.id === r.subjectId)?.weather;
                return (
                  <li key={r.subjectId} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
                    <Link href={`/subjects/${r.subjectId}`} className="flex flex-col hover:underline">
                      <span className="flex items-center gap-1.5 font-medium">
                        <WeatherIcon
                          tone={weather?.tone ?? "none"}
                          emoji={r.weatherIcon}
                          size={22}
                          label={weather?.label}
                        />
                        {r.subjectName}
                      </span>
                      <span className="text-sm text-zinc-500">{r.reason}</span>
                    </Link>
                    <ul className="flex flex-col gap-1">
                      {r.units.map((u) => (
                        <li key={u.id} className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate text-sm">
                            {u.status === "doing" && (
                              <span className="mr-1 text-xs text-sky-600">하는 중</span>
                            )}
                            {u.review && <span className="mr-1 text-xs text-violet-600">복습</span>}
                            {u.title}
                          </span>
                          {u.review ? (
                            <Link
                              href={`/subjects/${r.subjectId}`}
                              className={buttonClass({ variant: "neutral", size: "sm" })}
                            >
                              퀴즈 다시 보기
                            </Link>
                          ) : (
                            <form action={setUnitStatus.bind(null, u.id, "done")}>
                              <Button variant="success" size="sm">
                                <Check className="size-4" strokeWidth={3} aria-hidden />
                                완료
                              </Button>
                            </form>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">딱따구리 컨디션</h2>
            {subjects && subjects.length > 0 && (
              <Link href="/subjects/new" className={buttonClass({ variant: "neutral", size: "sm" })}>
                <Plus className="size-4" strokeWidth={3} aria-hidden />
                과목 추가
              </Link>
            )}
          </div>
          {subjects && subjects.length > 0 ? (
            <ul className="flex flex-col divide-y divide-zinc-200/80">
              {cards.map((s) => {
                const { weather } = s;
                const done = s.units.filter(isDone).length;
                const percent = s.units.length ? Math.round((done / s.units.length) * 100) : 0;
                return (
                  <li key={s.id}>
                    <Link href={`/subjects/${s.id}`} className="group flex items-start gap-4 py-5">
                      {/* 날씨 색 칸: 카드 배경 대신 아이콘 자리에 날씨 의미를 남긴다 */}
                      <span
                        className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${TONE_CLASS[weather.tone]}`}
                      >
                        <WeatherIcon tone={weather.tone} emoji={weather.icon} size={44} label={weather.label} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate font-bold group-hover:underline">{s.name}</span>
                          {s.exam_date && <DDayBadge days={daysUntil(s.exam_date)} />}
                        </span>
                        {s.units.length > 0 ? (
                          <span className="flex items-center gap-2">
                            <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200/70">
                              <span
                                className="block h-full rounded-full bg-forest"
                                style={{ width: `${percent}%` }}
                              />
                            </span>
                            <span className="shrink-0 text-xs font-semibold tabular-nums text-zinc-600">
                              진도 {percent}%
                              <span className="ml-1.5 font-medium text-brand-dark">매 HP {100 - percent}%</span>
                            </span>
                          </span>
                        ) : (
                          <span className="text-sm text-zinc-500">단원을 추가해 주세요</span>
                        )}
                        <span className="text-sm leading-relaxed text-zinc-600">{weather.detail}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            // 빈 상태: 알 하나와 첫 과목 추가
            <div className="flex flex-col items-center gap-5 py-8 text-center">
              <Image src="/mascot-egg_new.png" alt="" width={84} height={108} className="pet-egg-wobble" />
              <p className="break-keep text-zinc-600">첫 과목을 추가하면 알이 깨어날 준비를 해요</p>
              <Link href="/subjects/new" className={buttonClass({ variant: "primary", size: "md", className: "w-full max-w-xs" })}>
                <Plus className="size-5" strokeWidth={3} aria-hidden />
                첫 과목 추가하기
              </Link>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
