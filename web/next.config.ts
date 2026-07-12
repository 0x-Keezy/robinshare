import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sin el badge "N" de dev flotando en la esquina (contamina QA visual y demos)
  devIndicators: false,
};

export default nextConfig;
