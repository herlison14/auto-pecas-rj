import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  turbopack: {
    // Resolve o aviso de múltiplos lockfiles na máquina dev.
    root: path.resolve(__dirname),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
};

export default nextConfig;
