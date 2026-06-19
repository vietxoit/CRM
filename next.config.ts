import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, PATCH, OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
      ],
    },
  ],
  // Fix WebSocket HMR cho LAN
  webpack: (config: any, { dev }: any) => {
  if (dev) {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
    };
  }
  return config;
},
};

export default nextConfig;
