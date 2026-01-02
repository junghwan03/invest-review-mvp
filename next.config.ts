import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ❌ Vercel 배포할 땐 이거 주석 처리 필수! (API가 살아야 하니까요)
  // output: "export", 
  
  images: { unoptimized: true },

  // ✅ CORS 설정 (이게 있어야 토스 앱이 거부 안 당함)
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" }, // 모든 곳에서 허용
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
    ];
  },
};

export default nextConfig;