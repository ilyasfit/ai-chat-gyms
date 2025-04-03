import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config) => {
    // Remove the second argument entirely
    // Add rule for raw-loader to handle .md files
    config.module.rules.push({
      test: /\.md$/,
      use: "raw-loader",
    });

    // Important: return the modified config
    return config;
  },
};

export default nextConfig;
