import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GEO Analyzer — AI 검색 노출 진단",
  description: "URL을 입력하면 AI(ChatGPT·Claude 등)가 당신의 사이트를 어떻게 보는지 알려드립니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
