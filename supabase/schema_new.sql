-- F5 Study DB 테이블
-- Supabase 대시보드 > SQL Editor에 전체를 붙여 넣고 Run 한다.
-- 모든 테이블은 로그인한 본인 데이터만 읽고 쓸 수 있다(RLS).

-- 과목
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  professor text,
  exam_date date,
  created_at timestamptz not null default now()
);

-- 단원
create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  title text not null,
  position int not null default 0,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 학습 기록
create table if not exists public.study_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  studied_at timestamptz not null default now(),
  memo text
);

-- 퀴즈 결과
create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  score int not null,
  total int not null,
  passed boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists units_subject_id_idx on public.units (subject_id);
create index if not exists study_logs_unit_id_idx on public.study_logs (unit_id);
create index if not exists quiz_results_unit_id_idx on public.quiz_results (unit_id);

-- 로그인한 사용자(authenticated)에게 테이블 사용 권한. 어떤 행을 볼 수 있는지는 아래 RLS가 정한다.
grant select, insert, update, delete
  on public.subjects, public.units, public.study_logs, public.quiz_results
  to authenticated;

-- RLS: 본인 데이터만
alter table public.subjects enable row level security;
alter table public.units enable row level security;
alter table public.study_logs enable row level security;
alter table public.quiz_results enable row level security;

create policy "own subjects" on public.subjects
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own units" on public.units
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own study_logs" on public.study_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own quiz_results" on public.quiz_results
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 먹이 주기 기록 (딱따구리 레벨 계산용). 받은 먹이는 단원·퀴즈·학습 기록에서 계산하고, 여기에는 먹인 것만 남긴다.
create table if not exists public.feedings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  food text not null check (food in ('insect', 'pinecone', 'wood')),
  fed_at timestamptz not null default now()
);

create index if not exists feedings_user_id_idx on public.feedings (user_id);

grant select, insert on public.feedings to authenticated;

alter table public.feedings enable row level security;

create policy "own feedings" on public.feedings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 출석 기록 (하루 한 번). 출석 보상 나무 조각 계산용.
create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  unique (user_id, day)
);

grant select, insert on public.check_ins to authenticated;

alter table public.check_ins enable row level security;

create policy "own check_ins" on public.check_ins
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
