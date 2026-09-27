-- F5 Study 데모 데이터 (녹화용)
-- Supabase 대시보드 > SQL Editor에 전체를 붙여 넣고 Run 한다.
-- ⚠️ 아래 이메일 계정의 과목·단원·학습 기록·퀴즈·먹이·출석 기록을 모두 지우고 데모 데이터로 바꾼다.
-- 날짜는 실행하는 순간 기준으로 계산하므로, 녹화 직전에 실행하면 된다.
-- 먼저 이 계정으로 사이트에 한 번 로그인해 두어야 한다(계정이 있어야 함).
--
-- 녹화 장면
-- - 자료구조 ⛈️ 폭풍(D-6, 8단원 중 2개): 예보 메시지, 보스 HP, 매 도발, 오늘의 추천
-- - 확률과 통계 ⛅ 구름(D-9), 자연어처리 ☀️ 맑음(D-14)
-- - 망각 곡선: 자료구조 '배열' 기억 31% → 🧠 복습할 때
-- - 학습 메모: 자료구조 '스택' 단원 "괄호 처리 헷갈림" → AI 퀴즈가 이 부분을 물어봄
-- - 딱따구리: 120 XP(Lv.2, 부화까지 10 XP) → 곤충 하나 먹이면 "부화했어요!"
-- - 출석 4일 → 녹화하는 날 접속하면 5일째 보너스
-- - 마지막 공부는 어제 → '시험 날의 나' 예보가 보임

do $$
declare
  demo_email constant text := 'ksjin3953@gmail.com';
  uid uuid;
  today date := (now() at time zone 'Asia/Seoul')::date;
  s_ds uuid; -- 자료구조
  s_pr uuid; -- 확률과 통계
  s_nlp uuid; -- 자연어처리
  u uuid;
begin
  select id into uid from auth.users where email = demo_email;
  if uid is null then
    raise exception '계정(%)이 없어요. 먼저 사이트에 이 계정으로 로그인해 주세요.', demo_email;
  end if;

  -- 기존 데이터 지우기 (단원·학습 기록·퀴즈·강의자료 정보는 과목을 지우면 함께 지워진다)
  delete from public.subjects where user_id = uid;
  delete from public.feedings where user_id = uid;
  delete from public.check_ins where user_id = uid;

  -- ── 자료구조: ⛈️ 폭풍 (D-6, 8단원 중 2개 완료, 진도 느림) ──
  insert into public.subjects (user_id, name, professor, exam_date, created_at)
  values (uid, '자료구조', '김교수', today + 6, now() - interval '14 days')
  returning id into s_ds;

  -- 배열: 9일 전 완료, 5일 전 마지막 공부, 퀴즈 없음 → 기억 31% (복습할 때)
  insert into public.units (user_id, subject_id, title, position, status, completed_at)
  values (uid, s_ds, '배열과 구조체', 0, 'done', now() - interval '9 days') returning id into u;
  insert into public.study_logs (user_id, unit_id, studied_at, memo)
  values (uid, u, now() - interval '5 days', '희소 행렬 표현 다시 봄');

  -- 연결 리스트: 4일 전 퀴즈 통과로 완료 → 기억 63%
  insert into public.units (user_id, subject_id, title, position, status, completed_at)
  values (uid, s_ds, '연결 리스트', 1, 'done', now() - interval '4 days') returning id into u;
  insert into public.quiz_results (user_id, unit_id, score, total, passed, created_at)
  values (uid, u, 4, 5, true, now() - interval '4 days');
  insert into public.study_logs (user_id, unit_id, studied_at, memo)
  values (uid, u, now() - interval '4 days 1 hour', '이중 연결 리스트 삽입·삭제');

  -- 스택: 하는 중, 어제 공부(메모), 퀴즈 2/5 미통과
  insert into public.units (user_id, subject_id, title, position, status)
  values (uid, s_ds, '스택과 수식 계산', 2, 'doing') returning id into u;
  insert into public.study_logs (user_id, unit_id, studied_at, memo) values
    (uid, u, now() - interval '2 days', '스택 push/pop 구현'),
    (uid, u, now() - interval '1 day', '중위 → 후위 표기 변환할 때 괄호 처리가 헷갈림');
  insert into public.quiz_results (user_id, unit_id, score, total, passed, created_at)
  values (uid, u, 2, 5, false, now() - interval '1 day');

  insert into public.units (user_id, subject_id, title, position) values
    (uid, s_ds, '큐와 원형 큐', 3),
    (uid, s_ds, '재귀', 4),
    (uid, s_ds, '트리와 이진 트리 순회', 5),
    (uid, s_ds, '이진 탐색 트리', 6),
    (uid, s_ds, '우선순위 큐와 힙', 7);

  -- ── 확률과 통계: ⛅ 구름 (D-9, 6단원 중 3개 완료) ──
  insert into public.subjects (user_id, name, professor, exam_date, created_at)
  values (uid, '확률과 통계', '이교수', today + 9, now() - interval '14 days')
  returning id into s_pr;

  -- 12일 전 완료, 퀴즈 두 번 통과(12일 전, 5일 전) → 반감기 12일, 기억 75%
  insert into public.units (user_id, subject_id, title, position, status, completed_at)
  values (uid, s_pr, '확률의 기초', 0, 'done', now() - interval '12 days') returning id into u;
  insert into public.quiz_results (user_id, unit_id, score, total, passed, created_at) values
    (uid, u, 3, 5, true, now() - interval '12 days'),
    (uid, u, 5, 5, true, now() - interval '5 days');

  -- 7일 전 퀴즈 통과로 완료, 2일 전 공부 → 기억 79%
  insert into public.units (user_id, subject_id, title, position, status, completed_at)
  values (uid, s_pr, '조건부 확률과 베이즈 정리', 1, 'done', now() - interval '7 days') returning id into u;
  insert into public.quiz_results (user_id, unit_id, score, total, passed, created_at)
  values (uid, u, 4, 5, true, now() - interval '7 days');
  insert into public.study_logs (user_id, unit_id, studied_at, memo)
  values (uid, u, now() - interval '2 days', '베이즈 정리 예제 다시 풀기');

  -- 3일 전 퀴즈 통과로 완료 → 기억 71%
  insert into public.units (user_id, subject_id, title, position, status, completed_at)
  values (uid, s_pr, '이산 확률분포', 2, 'done', now() - interval '3 days') returning id into u;
  insert into public.quiz_results (user_id, unit_id, score, total, passed, created_at)
  values (uid, u, 4, 5, true, now() - interval '3 days');

  insert into public.units (user_id, subject_id, title, position) values
    (uid, s_pr, '연속 확률분포', 3),
    (uid, s_pr, '표본분포', 4),
    (uid, s_pr, '추정과 가설검정', 5);

  -- ── 자연어처리: ☀️ 맑음 (D-14, 5단원 중 4개 완료) ──
  insert into public.subjects (user_id, name, professor, exam_date, created_at)
  values (uid, '자연어처리', '박교수', today + 14, now() - interval '14 days')
  returning id into s_nlp;

  insert into public.units (user_id, subject_id, title, position, status, completed_at)
  values (uid, s_nlp, '텍스트 전처리와 토큰화', 0, 'done', now() - interval '13 days') returning id into u;
  insert into public.quiz_results (user_id, unit_id, score, total, passed, created_at) values
    (uid, u, 4, 5, true, now() - interval '13 days'),
    (uid, u, 5, 5, true, now() - interval '6 days');

  insert into public.units (user_id, subject_id, title, position, status, completed_at)
  values (uid, s_nlp, '단어 임베딩 (Word2Vec)', 1, 'done', now() - interval '10 days') returning id into u;
  insert into public.quiz_results (user_id, unit_id, score, total, passed, created_at) values
    (uid, u, 3, 5, true, now() - interval '10 days'),
    (uid, u, 4, 5, true, now() - interval '4 days');

  insert into public.units (user_id, subject_id, title, position, status, completed_at)
  values (uid, s_nlp, '순환 신경망 (RNN, LSTM)', 2, 'done', now() - interval '5 days') returning id into u;
  insert into public.quiz_results (user_id, unit_id, score, total, passed, created_at)
  values (uid, u, 5, 5, true, now() - interval '5 days');

  insert into public.units (user_id, subject_id, title, position, status, completed_at)
  values (uid, s_nlp, '어텐션과 트랜스포머', 3, 'done', now() - interval '2 days') returning id into u;
  insert into public.quiz_results (user_id, unit_id, score, total, passed, created_at)
  values (uid, u, 4, 5, true, now() - interval '2 days');
  insert into public.study_logs (user_id, unit_id, studied_at, memo)
  values (uid, u, now() - interval '2 days 2 hours', 'Self-attention 계산 과정 정리');

  insert into public.units (user_id, subject_id, title, position)
  values (uid, s_nlp, '사전학습 언어모델 (BERT, GPT)', 4);

  -- ── 딱따구리: 곤충 3 + 솔방울 3 + 나무 조각 3 = 120 XP (Lv.2, 부화까지 10 XP) ──
  insert into public.feedings (user_id, food, fed_at) values
    (uid, 'insect', now() - interval '9 days'),
    (uid, 'wood', now() - interval '8 days'),
    (uid, 'pinecone', now() - interval '7 days'),
    (uid, 'insect', now() - interval '5 days'),
    (uid, 'wood', now() - interval '4 days'),
    (uid, 'pinecone', now() - interval '4 days'),
    (uid, 'insect', now() - interval '3 days'),
    (uid, 'pinecone', now() - interval '2 days'),
    (uid, 'wood', now() - interval '1 day');

  -- ── 출석 4일 (어제까지). 녹화하는 날 접속하면 5일째 → 나무 조각 2개 보너스 ──
  insert into public.check_ins (user_id, day) values
    (uid, today - 4), (uid, today - 3), (uid, today - 2), (uid, today - 1);

  raise notice '데모 데이터를 넣었어요: %', demo_email;
end $$;
