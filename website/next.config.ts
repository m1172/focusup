import type { NextConfig } from 'next';

// Fully static site (out/) for Cloudflare Pages or any static host.
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
