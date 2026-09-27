import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Jua } from "next/font/google";
import "./globals.css";

// 본문: Pretendard Variable (한글 + 영문, 굵기 45~920)
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

// 제목·숫자 강조용 둥근 폰트. font-display로 쓴다.
const jua = Jua({
  variable: "--font-jua",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "F5 Study",
  description: "시험 날 진도를 미리 보여주는 학기 생존 학습 관리",
};

// 아이폰 노치·홈 인디케이터 영역까지 쓰고, env(safe-area-inset-*)로 여백을 준다.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#fffbf5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${pretendard.variable} ${jua.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
