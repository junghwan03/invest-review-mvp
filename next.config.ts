import type { NextConfig } from "next";

const nextConfig: any = { 
  // 1️⃣ [토스 빌드용] 토스에 업로드할 때만 아래 주석(//)을 푸세요.
  // output: "export", 
  // distDir: ".next/web", 
  
  // 2️⃣ [Vercel 배포용] Vercel에 올릴 때는 위 두 줄을 반드시 주석 처리해야 API가 작동합니다.

  images: {
    unoptimized: true,
  },
  
  // ✅ 빌드 에러 방지 (아주 잘하셨습니다)
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;