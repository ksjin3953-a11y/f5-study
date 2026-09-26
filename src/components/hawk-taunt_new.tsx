"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

// 매 도발: 사이트를 켜 둔 채 한동안 공부 기록이 없으면 매가 날아와 약을 올린다.
// 다른 탭에 가 있으면(딴짓) 브라우저 알림으로도 보낸다. 주소에 ?idle=분 을 붙이면 기다리는 시간을 바꾼다(시연용).
const DEFAULT_IDLE_MIN = 25;
const SNOOZE_MIN = 5;

type Target = { subjectId: string; subjectName: string; daysLeft: number | null; remaining: number };

function taunts(idleMin: number, petName: string, target: Target | null) {
  const lines = [
    "딴짓중이야? 😏",
    `${idleMin}분째 조용하네? 공부하는 척만 하는 거 다 보여.`,
    `${petName} 배고프대. 공부해서 먹이 좀 벌어 와!`,
  ];
  if (target) {
    if (target.daysLeft !== null && target.daysLeft > 0) {
      lines.push(`${target.subjectName} 시험 D-${target.daysLeft}인데 벌써 지쳤어?`);
    }
    if (target.remaining > 0) {
      lines.push(
        `${target.subjectName} HP ${(target.remaining * 1000).toLocaleString("en-US")} 그대로네~ 이러다 시험 날 내가 이긴다!`
      );
    }
  }
  return lines;
}

function idleMinutes() {
  const v = Number(new URLSearchParams(window.location.search).get("idle"));
  return v > 0 ? v : DEFAULT_IDLE_MIN;
}

export function HawkTaunt({
  lastStudyAt,
  petName,
  target,
  studyHref,
}: {
  lastStudyAt: string | null;
  petName: string;
  target: Target | null;
  studyHref?: string; // 있으면 "공부하러 가기" 링크를 보여 준다
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [snoozeUntil, setSnoozeUntil] = useState<number | null>(null);
  const [asked, setAsked] = useState(false);
  const openedAt = useRef<number | null>(null);

  const fire = useCallback(() => {
    const lines = taunts(idleMinutes(), petName, target);
    const text = lines[Math.floor(Math.random() * lines.length)];
    setMessage(text);
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      new Notification("🦅 보스 매", { body: text, icon: "/hawk_new.png" });
    }
  }, [petName, target]);

  // 기준 시각: 페이지를 연 때와 마지막 공부 중 늦은 쪽. 공부하면 부모가 key를 바꿔 처음부터 다시 잰다.
  useEffect(() => {
    openedAt.current ??= Date.now();
    const last = lastStudyAt ? Date.parse(lastStudyAt) : 0;
    const wakeAt = snoozeUntil ?? Math.max(openedAt.current, last) + idleMinutes() * 60_000;
    const t = setTimeout(fire, Math.max(0, wakeAt - Date.now()));
    return () => clearTimeout(t);
  }, [lastStudyAt, snoozeUntil, fire]);

  const dismiss = (minutes: number) => {
    setMessage(null);
    setSnoozeUntil(Date.now() + minutes * 60_000);
  };

  if (!message) return null;
  // 메시지는 브라우저에서 타이머가 울린 뒤에만 보이므로 여기서 window를 봐도 된다.
  const canNotify = !asked && "Notification" in window && Notification.permission === "default";

  return (
    <div className="hawk-swoop fixed inset-x-3 bottom-4 z-50 mx-auto flex max-w-md items-end gap-3 rounded-2xl bg-stone-900 px-4 py-3 text-white shadow-2xl ring-2 ring-[#e5404f]">
      <Image src="/hawk_new.png" alt="보스 매" width={44} height={67} className="boss-angry shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-sm font-semibold leading-snug">{message}</p>
        <div className="flex flex-wrap gap-2">
          {studyHref ? (
            <Link
              href={studyHref}
              onClick={() => dismiss(idleMinutes())}
              className="flex h-8 items-center rounded-full bg-[#e5404f] px-3 text-xs font-bold hover:bg-[#ff5a67]"
            >
              공부하러 가기
            </Link>
          ) : (
            <button
              onClick={() => dismiss(idleMinutes())}
              className="h-8 rounded-full bg-[#e5404f] px-3 text-xs font-bold hover:bg-[#ff5a67]"
            >
              지금 할게!
            </button>
          )}
          <button
            onClick={() => dismiss(SNOOZE_MIN)}
            className="h-8 rounded-full border border-stone-600 px-3 text-xs text-stone-300 hover:bg-stone-800"
          >
            {SNOOZE_MIN}분만 쉴게
          </button>
          {canNotify && (
            <button
              onClick={() =>
                Notification.requestPermission().finally(() => setAsked(true))
              }
              className="h-8 rounded-full px-2 text-xs text-stone-400 underline hover:text-white"
            >
              다른 탭에서도 알림 받기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
