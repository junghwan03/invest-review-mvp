import type { NextConfig } from "next";

const nextConfig: any = { 
  // ✅ [Vercel/Github 배포용] 서버 배포 시에는 아래 두 줄을 반드시 주석(//) 처리해야 합니다!
  // (토스 빌드할 때만 주석을 푸세요)
  // output: "export", 
  // distDir: ".next/web", 
  
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;