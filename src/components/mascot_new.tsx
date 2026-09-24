import Image from "next/image";
import type { Weather } from "@/lib/weather_new";

// 마스코트(딱따구리)가 말풍선으로 말하는 컴포넌트. 날씨에 따라 연출이 달라진다.
// 비: 우산을 쓰고 빗방울 / 폭풍: 우산이 크게 흔들리고 번개 / 맑음: 통통 / 구름: 살랑
const WIDTHS = { sm: 36, md: 56, lg: 76 } as const;
const RATIO = 257 / 173; // public/mascot_new.png 세로/가로
const UMBRELLA_SPACE = 0.45; // 우산이 들어갈 머리 위 여백(마스코트 너비 대비)

// SVG 좌표계: 가로 100 = 마스코트 너비, 세로는 우산 여백 + 마스코트 키
const VIEW_H = (UMBRELLA_SPACE + RATIO) * 100;
// 들어 올린 날개 끝에서 손잡이를 잡는 지점. 우산은 이 점을 축으로 흔들린다(globals.css와 같은 값).
const GRIP = { x: 106, y: 99 };

type Mood = Weather["tone"];

// 빗방울 위치(가로 %), 시작 높이, 떨어지는 거리, 속도, 지연
const DROPS = [
  // 양옆: 끝까지 떨어진다
  { left: -16, top: -5, fall: "850%", dur: 0.9, delay: 0 },
  { left: -7, top: -5, fall: "850%", dur: 1.05, delay: 0.45 },
  { left: 106, top: -5, fall: "850%", dur: 0.95, delay: 0.2 },
  { left: 115, top: -5, fall: "850%", dur: 0.85, delay: 0.65 },
  // 우산 위: 우산에 닿으면 사라진다
  { left: 12, top: -30, fall: "230%", dur: 0.6, delay: 0.1 },
  { left: 44, top: -34, fall: "230%", dur: 0.55, delay: 0.5 },
  { left: 76, top: -30, fall: "230%", dur: 0.65, delay: 0.3 },
];

function Umbrella({ layer, storm }: { layer: "handle" | "canopy"; storm: boolean }) {
  return (
    <svg
      viewBox={`0 0 100 ${VIEW_H}`}
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      style={{ zIndex: layer === "handle" ? 0 : 3 }}
      aria-hidden
    >
      <g className={storm ? "mascot-umbrella-storm" : "mascot-umbrella-rain"}>
        {layer === "handle" ? (
          // 손잡이: 캐노피 가운데에서 머리 뒤를 지나 들어 올린 날개 끝으로
          <g fill="none" stroke="#3f3f46" strokeLinecap="round">
            <line x1="48" y1="36" x2={GRIP.x + 2} y2={GRIP.y + 6} strokeWidth="2.6" />
            <path d={`M${GRIP.x + 2} ${GRIP.y + 6} q2 6 -3 7`} strokeWidth="2.6" />
          </g>
        ) : (
          <g>
            <path
              d="M-2 38 Q48 -18 98 38 Q85.5 30 73 38 Q60.5 30 48 38 Q35.5 30 23 38 Q10.5 30 -2 38 Z"
              fill="#e0312b"
            />
            <path d="M-2 38 Q48 -18 98 38" fill="none" stroke="#ff6b61" strokeWidth="1.2" opacity="0.7" />
            <g stroke="#a61f1b" strokeWidth="1.1" strokeLinecap="round">
              <line x1="48" y1="10" x2="23" y2="38" />
              <line x1="48" y1="10" x2="48" y2="38" />
              <line x1="48" y1="10" x2="73" y2="38" />
            </g>
            <line x1="48" y1="10" x2="48" y2="3" stroke="#3f3f46" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}
      </g>
    </svg>
  );
}

// 우산을 잡으려고 들어 올린 오른쪽 날개. 우산 연출 때는 원래 날개를 지운 이미지(mascot-hold_new.png)와 함께 쓴다.
function RaisedWing({ className }: { className: string }) {
  return (
    <svg
      viewBox={`0 0 100 ${VIEW_H}`}
      className={`pointer-events-none absolute inset-0 h-full w-full overflow-visible ${className}`}
      style={{ zIndex: 2 }}
      aria-hidden
    >
      <defs>
        <linearGradient id="mascot-wing-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a4345" />
          <stop offset="0.55" stopColor="#2b2527" />
          <stop offset="1" stopColor="#1c1718" />
        </linearGradient>
      </defs>
      <path
        d="M77 144 C82 131 94 116 102 99 C104 93 112 93 111 100 C110 116 102 134 93 148 C88 154 78 152 77 144 Z"
        fill="url(#mascot-wing-grad)"
      />
      <g fill="none" stroke="#f3ece6" strokeLinecap="round">
        <path d="M83 141 q3 -2.5 5.5 0.5" strokeWidth="1.8" />
        <path d="M89 130 q3 -2.5 5.5 0.5" strokeWidth="1.8" />
        <path d="M95 119 q2.5 -2 4.5 0.5" strokeWidth="1.6" />
      </g>
    </svg>
  );
}

function MascotFigure({ width, mood }: { width: number; mood: Mood }) {
  const height = Math.round(width * RATIO);
  const umbrella = mood === "rainy" || mood === "stormy";
  const storm = mood === "stormy";
  const bodyClass =
    mood === "sunny" ? "mascot-hop" : mood === "cloudy" ? "mascot-sway" : storm ? "mascot-shiver" : "";

  return (
    <div
      className="relative shrink-0"
      style={{ width, height: umbrella ? Math.round(width * (UMBRELLA_SPACE + RATIO)) : height }}
    >
      {umbrella && <Umbrella layer="handle" storm={storm} />}
      <Image
        src={umbrella ? "/mascot-hold_new.png" : "/mascot_new.png"}
        alt=""
        width={width}
        height={height}
        className={`absolute bottom-0 left-0 ${bodyClass}`}
        style={{ zIndex: 1 }}
      />
      {umbrella && <RaisedWing className={bodyClass} />}
      {umbrella && <Umbrella layer="canopy" storm={storm} />}
      {umbrella && (
        <div className={`mascot-rain-layer ${storm ? "is-storm" : ""}`} style={{ zIndex: 4 }} aria-hidden>
          {DROPS.map((d, i) => (
            <span
              key={i}
              className="mascot-drop"
              style={
                {
                  left: `${d.left}%`,
                  top: `${d.top}%`,
                  "--fall": d.fall,
                  "--dur": `${storm ? d.dur * 0.7 : d.dur}s`,
                  "--delay": `${d.delay}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}
      {storm && (
        <svg
          viewBox="0 0 20 32"
          className="mascot-bolt pointer-events-none absolute"
          style={{ left: "-38%", top: "-8%", width: "34%", zIndex: 4 }}
          aria-hidden
        >
          <path d="M12 0 L2 18 H9 L6 32 L18 11 H11 L15 0 Z" fill="#facc15" />
        </svg>
      )}
    </div>
  );
}

export function MascotSays({
  children,
  size = "md",
  mood = "none",
  className = "",
}: {
  children: React.ReactNode;
  size?: keyof typeof WIDTHS;
  mood?: Mood;
  className?: string;
}) {
  return (
    <div className={`flex items-end gap-2 ${className}`}>
      <MascotFigure width={WIDTHS[size]} mood={mood} />
      <div className="min-w-0 rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm leading-relaxed text-zinc-800 shadow-sm ring-1 ring-zinc-200">
        {children}
      </div>
    </div>
  );
}
