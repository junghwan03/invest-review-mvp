/** @type {import('next').NextConfig} */
const nextConfig = {
  //output: "export",
  distDir: ".next/web", // 토스가 요구하는 경로로 변경
  images: {
    unoptimized: true,
  },
};

export default nextConfig;