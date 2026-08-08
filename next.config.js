/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  swcMinify: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
    serverComponentsExternalPackages: ['tesseract.js', 'mongodb'],
  },
  webpack: (config, { dev, isServer }) => {
    // Avoid corrupted webpack chunk cache on Windows during hot reload
    if (dev) {
      config.cache = false;
    }
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        encoding: false,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
