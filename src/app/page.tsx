import { createClient } from "@/lib/supabase/server_new";
import { LoginButton, LogoutButton } from "@/components/auth-buttons_new";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-3">
        <p className="text-4xl">⛈️ → ☀️</p>
        <h1 className="text-3xl font-bold tracking-tight">F5 Study</h1>
        <p className="text-zinc-600">
          지금 속도로 공부하면 시험 날 어디까지 끝낼 수 있을까요?
          <br />
          과목별 학습 날씨로 확인하고, 오늘 할 공부를 추천받으세요.
        </p>
      </div>

      {user ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-5">
          <p>
            <span className="font-semibold">{user.email}</span> 님, 로그인되었어요.
          </p>
          <LogoutButton />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <LoginButton />
          {error === "login" && (
            <p className="text-sm text-red-600">
              로그인에 실패했어요. 다시 시도해 주세요.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
