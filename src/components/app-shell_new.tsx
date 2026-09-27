import Image from "next/image";
import Link from "next/link";
import { CalendarCheck, CalendarDays, House, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server_new";
import { loadGameState } from "@/lib/game-state_new";
import { petNameOf, stageForLevel } from "@/lib/game_new";
import { daysUntil, isDone } from "@/lib/weather_new";
import { LogoutButton } from "@/components/auth-buttons_new";
import { BossMini } from "@/components/boss-panel_new";
import { DDayBadge } from "@/components/dday-badge_new";

// 로그인 후 화면의 뼈대.
// 데스크톱(lg~): 왼쪽 메뉴 | 가운데 본문(최대 600px) | 오른쪽 상태 패널
// 모바일: 위 상태 바(sticky) + 본문 + 아래 탭바(fixed)

type Tab = "home" | "calendar";

const NAV = [
  { key: "home", href: "/", label: "홈", tabLabel: "홈", Icon: House },
  { key: "calendar", href: "/calendar", label: "공격 계획표", tabLabel: "계획표", Icon: CalendarDays },
  // 과목 추가는 앱 셸 없는 집중 화면이라 여기서 현재 페이지로 표시될 일은 없다.
  { key: "new", href: "/subjects/new", label: "과목 추가", tabLabel: "과목 추가", Icon: Plus },
] as const;

// 셸에 보여 줄 상태: 딱따구리 레벨·출석, 가장 가까운 시험(보스)
async function loadShell() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name, exam_date, units(status, completed_at, quiz_results(passed, created_at), study_logs(id))");
  const list = subjects ?? [];
  const game = await loadGameState(supabase, list);

  const nextExam =
    list
      .filter((s) => s.exam_date && daysUntil(s.exam_date) >= 0)
      .map((s) => ({
        id: s.id,
        name: s.name,
        daysLeft: daysUntil(s.exam_date!),
        total: s.units.length,
        remaining: s.units.filter((u) => !isDone(u)).length,
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft)[0] ?? null;

  return { email: user?.email ?? "", petName: petNameOf(user), game, nextExam };
}

type Shell = Awaited<ReturnType<typeof loadShell>>;

export async function AppShell({ active, children }: { active: Tab | null; children: React.ReactNode }) {
  const shell = await loadShell();

  return (
    <div className="flex-1 lg:grid lg:grid-cols-[240px_minmax(0,1fr)_340px]">
      {/* 왼쪽 사이드바 */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-zinc-200/80 px-4 py-6 lg:flex">
        <Logo />
        <nav className="flex flex-col gap-1">
          {NAV.map(({ key, href, label, Icon }) => (
            <Link
              key={key}
              href={href}
              aria-current={active === key ? "page" : undefined}
              className={`flex h-12 items-center gap-3 rounded-2xl px-4 font-bold transition-colors ${
                active === key ? "bg-brand-light text-brand" : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <Icon className="size-6" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 px-1">
          <span className="truncate text-xs text-zinc-500">{shell.email}</span>
          <LogoutButton />
        </div>
        {/* 무대 풍경에서 잘라 온 잔디와 작은 나무: 앱 전체가 같은 세계라는 표시 */}
        <div className="-mx-4 -mb-6 h-20 bg-[url(/stage-tree_new.svg)] bg-bottom bg-no-repeat" aria-hidden />
      </aside>

      <div className="min-w-0">
        <TopBar shell={shell} />
        <main className="mx-auto w-full max-w-[600px] px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 lg:px-6 lg:pb-16 lg:pt-10">
          {children}
          {/* 모바일에는 사이드바가 없어서 계정 정보는 맨 아래에 둔다 */}
          <div className="mt-12 flex items-center justify-between gap-3 text-sm text-zinc-500 lg:hidden">
            <span className="truncate">{shell.email}</span>
            <LogoutButton />
          </div>
        </main>
      </div>

      {/* 오른쪽 상태 패널 */}
      <aside className="hidden lg:block">
        <div className="sticky top-0 flex max-h-dvh flex-col gap-6 overflow-y-auto px-6 py-10">
          <SidePanel shell={shell} />
        </div>
      </aside>

      <TabBar active={active} />
    </div>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 px-2">
      <Image src="/mascot_new.png" alt="" width={30} height={45} />
      <span className="font-display text-2xl text-brand">F5 Study</span>
    </Link>
  );
}

// 딱따구리 현재 모습 (세로 height px에 맞춰 가로를 계산)
function StageImage({ level, height }: { level: number; height: number }) {
  const stage = stageForLevel(level);
  return (
    <Image
      src={stage.image}
      alt={stage.name}
      width={Math.round((height * stage.width) / stage.height)}
      height={height}
    />
  );
}

// 모바일 상단 상태 바: 레벨 · 출석 · 가장 가까운 시험 D-day
function TopBar({ shell }: { shell: Shell }) {
  const { game, nextExam } = shell;
  return (
    <header className="sticky top-0 z-30 bg-paper/90 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
      <div className="flex h-14 items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-1.5" aria-label="F5 Study 홈">
          <Image src="/mascot_new.png" alt="" width={20} height={30} />
          <span className="font-display text-xl text-brand">F5</span>
        </Link>
        <div className="flex min-w-0 items-center gap-3 text-sm font-bold">
          <span className="flex items-center gap-1 text-amber-700">
            <StageImage level={game.level} height={22} />
            <span className="font-display tabular-nums">Lv.{game.level}</span>
          </span>
          {game.attendance && (
            <span className="flex items-center gap-1 text-brand">
              <CalendarCheck className="size-4" aria-hidden />
              <span className="tabular-nums">{game.attendance.days}일</span>
              <span className="sr-only">출석</span>
            </span>
          )}
          {nextExam && (
            <Link href={`/subjects/${nextExam.id}`} className="flex min-w-0 items-center" aria-label={`${nextExam.name} 시험`}>
              <DDayBadge days={nextExam.daysLeft} />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

// 데스크톱 오른쪽 패널: 딱따구리 레벨 · 출석 · 가장 가까운 시험의 보스
function SidePanel({ shell }: { shell: Shell }) {
  const { game, nextExam, petName } = shell;
  const percent = Math.round((game.current / game.need) * 100);
  return (
    <>
      <section className="flex items-center gap-4 rounded-3xl bg-amber-50 p-5">
        <div className="flex h-16 w-12 shrink-0 items-end justify-center">
          <StageImage level={game.level} height={60} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-bold">{petName}</span>
            <span className="shrink-0 font-display text-xl tabular-nums text-amber-700">Lv.{game.level}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-forest-light">
            <div className="h-full rounded-full bg-forest" style={{ width: `${percent}%` }} />
          </div>
          <span className="text-xs text-zinc-500">다음 레벨까지 {game.need - game.current} XP</span>
        </div>
      </section>

      {game.attendance && (
        <section className="flex items-center gap-4 rounded-3xl bg-white p-5 shadow-sm">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-light">
            <CalendarCheck className="size-6 text-brand" aria-hidden />
          </span>
          <div className="flex flex-col">
            <span className="font-bold">
              출석 <span className="tabular-nums">{game.attendance.days}</span>일째
            </span>
            <span className="text-xs text-zinc-500">오늘 나무 조각 {game.attendance.todayWood}개를 받았어요</span>
          </div>
        </section>
      )}

      {nextExam && (
        <section className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold">가장 가까운 시험</h2>
            <DDayBadge days={nextExam.daysLeft} />
          </div>
          <Link href={`/subjects/${nextExam.id}`} className="flex items-center justify-between gap-3 hover:underline">
            <span className="min-w-0 truncate font-medium">{nextExam.name}</span>
            <BossMini remaining={nextExam.remaining} total={nextExam.total} />
          </Link>
        </section>
      )}
    </>
  );
}

// 모바일 하단 탭바. 아이폰 홈 인디케이터만큼 아래 여백을 더 준다.
function TabBar({ active }: { active: Tab | null }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200/80 bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="mx-auto grid h-16 max-w-[600px] grid-cols-3">
        {NAV.map(({ key, href, tabLabel, Icon }) => (
          <Link
            key={key}
            href={href}
            aria-current={active === key ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 text-xs font-bold ${
              active === key ? "text-brand" : "text-zinc-400"
            }`}
          >
            <Icon className="size-6" aria-hidden />
            {tabLabel}
          </Link>
        ))}
      </div>
    </nav>
  );
}
