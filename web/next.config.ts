import type { NextConfig } from 'next';
import path from 'path';

const parentSrc = path.join(import.meta.dirname, '../src');

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(import.meta.dirname, '../'),
  webpack: (config) => {
    // Alias @omni-clip to parent src directory
    config.resolve.alias = {
      ...config.resolve.alias,
      '@omni-clip': parentSrc,
    };

    // Allow webpack to resolve .ts files in the parent src directory
    // when encountering .js extension imports (ESM convention)
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.js'],
    };

    // Include parent src in module resolution
    config.resolve.modules = [
      ...(config.resolve.modules || []),
      parentSrc,
    ];

    // Ensure webpack processes .ts files from parent src
    config.module.rules.forEach((rule: any) => {
      if (rule && rule.oneOf) {
        rule.oneOf.forEach((oneOfRule: any) => {
          if (oneOfRule.issuerLayer === undefined && oneOfRule.include) {
            // Extend include paths to cover parent src
            if (Array.isArray(oneOfRule.include)) {
              oneOfRule.include.push(parentSrc);
            }
          }
        });
      }
    });

    return config;
  },
};

export default nextConfig;
