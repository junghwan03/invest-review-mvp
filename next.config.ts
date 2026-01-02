import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "export",  // ❌ 이 줄 삭제/주석
  images: { unoptimized: true },
};

export default nextConfig;

