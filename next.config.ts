import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  trailingSlash: true,
  productionBrowserSourceMaps: false, 
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['img.icons8.com', 'upload.wikimedia.org', 'cdn-icons-png.flaticon.com', 'www.logo.wine'], // add more as needed
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        // Add fallbacks for Node.js modules if needed by 'cookies-next'
        // For example:
        // fs: false,
        // path: false,
        // crypto: false,
      };
    }
    if (config.devtool) {
      config.devtool = false;
    }
    return config;
  },
};

export default nextConfig;
