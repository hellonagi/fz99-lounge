import path from "path";
import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  outputFileTracingIncludes: {
    '/[locale]': ['./content/**/*'],
    '/[locale]/news': ['./content/**/*'],
    '/[locale]/news/[slug]': ['./content/**/*'],
  },
  compiler: {
    removeConsole: {
      exclude: ['error', 'warn'],
    },
  },
  eslint: {
    // TODO: remove once the pre-existing lint debt is cleared
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/screenshots/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
        pathname: '/avatars/**',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
