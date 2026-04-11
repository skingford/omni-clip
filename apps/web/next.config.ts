import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  transpilePackages: ['@omni-clip/core'],
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
};

export default nextConfig;
