import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   output: "export",      // <--- Vercel 배포할 때는 이 줄을 반드시 주석 처리!
   distDir: ".next/web",  // <--- 이 줄도 Vercel에서는 필요 없으니 주석 처리!
  images: {
    unoptimized: true,
  },
};

export default nextConfig;