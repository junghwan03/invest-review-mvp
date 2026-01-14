import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ [수정됨] 토스 앱 빌드(.ait 생성)를 위해 필수입니다! (주석 해제)
  //output: "export", 
  
  images: { unoptimized: true },

  // ✅ CORS 설정 (이건 유지해도 빌드에 방해되지 않습니다)
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" }, 
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
    ];
  },
};

export default nextConfig;import type { NextConfig } from "next";

// 💡 핵심: Vercel 서버인지 확인하는 변수
const isVercel = process.env.VERCEL === '1';

const nextConfig: NextConfig = {
  // ✅ Vercel 배포중이면 'export' 끄기(API 작동), 내 컴퓨터면 'export' 켜기(토스 빌드용)
  output: isVercel ? undefined : "export",

  images: { unoptimized: true },

  // CORS 설정 (Vercel API 사용 시 필요)
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
    ];
  },
};

export default nextConfig;