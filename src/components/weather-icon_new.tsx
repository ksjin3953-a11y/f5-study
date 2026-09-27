"use client";

import Image from "next/image";
import { useState } from "react";
import type { Weather } from "@/lib/weather_new";

// 날씨 아이콘. public/weather-{tone}_new.png를 보여 주고, 파일이 없으면 기존 이모지로 바꿔 보여 준다.
// (next/image는 hydration 전에 난 로드 에러도 다시 시도해서 onError를 불러 준다.)
export function WeatherIcon({
  tone,
  emoji,
  size = 32,
  label,
  className = "",
}: {
  tone: Weather["tone"];
  emoji: string; // weather.icon. 이미지가 없을 때 보여 준다.
  size?: number;
  label?: string; // 화면 읽기 프로그램용. 없으면 장식으로 취급한다.
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };

  return (
    <span
      {...a11y}
      className={`inline-flex shrink-0 items-center justify-center leading-none ${className}`}
      style={{ width: size, height: size }}
    >
      {failed ? (
        <span style={{ fontSize: Math.round(size * 0.85) }}>{emoji}</span>
      ) : (
        <Image
          src={`/weather-${tone}_new.png`}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
