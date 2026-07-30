import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/weeding/:path*",
        destination: "/wedding/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
