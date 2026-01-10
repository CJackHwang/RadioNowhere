import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许所有常见局域网网段访问
  allowedDevOrigins: [
    '*.local',
    '*.local:3000',
    '192.168.*.*',
    '192.168.*.*:3000',
    '10.*.*.*',
    '172.16.*.*',
  ],
};

export default nextConfig;
