import type { NextConfig } from "out";

const nextConfig: NextConfig = {
  output: "export", // 주석 해제하여 정적 빌드 활성화 (토스 업로드용)
  images: {
    unoptimized: true, // 정적 배포 시 이미지 최적화 기능 비활성화 필수
  },
};

export default nextConfig;