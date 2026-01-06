import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';
import nextra from 'nextra';
import './src/libs/Env';

// Define the base Next.js configuration
const baseConfig: NextConfig = {
  devIndicators: {
    position: 'bottom-right',
  },
  poweredByHeader: false,
  reactStrictMode: true,
  reactCompiler: true,
};

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// Set up Nextra with its configuration
const withNextra = nextra({
  defaultShowCopyCode: true,
  latex: true,
  contentDirBasePath: '/',
});

// Export the final Next.js config with Nextra included
const nextConfig = withBundleAnalyzer(withNextra(baseConfig));

export default nextConfig;
