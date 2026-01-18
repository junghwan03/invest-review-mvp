import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  //output: "export",      // 정적 빌드 활성화
  distDir: ".next/web",  // [중요] 토스 빌드 도구가 파일을 찾을 수 있게 경로 강제 지정
  images: {
    unoptimized: true,   // 정적 배포 시 필수
  },
};

export default nextConfig;