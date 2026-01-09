import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';
import nextra from 'nextra';

// Define the base Next.js configuration
const baseConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  devIndicators: {
    position: 'bottom-right',
  },
  poweredByHeader: false,
  reactStrictMode: true,
  reactCompiler: true,
  trailingSlash: true,
  experimental: {
    optimizePackageImports: ['nextra-theme-docs', 'react-icons', 'qrcode.react'],
  },
};

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// Set up Nextra with its configuration
const withNextra = nextra({
  contentDirBasePath: '/',
});

// Export the final Next.js config with Nextra included
const nextConfig = withBundleAnalyzer(withNextra(baseConfig));

export default nextConfig;
