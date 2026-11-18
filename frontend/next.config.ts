import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The old standalone RAG chat page is now part of the main assistant.
  async redirects() {
    return [{ source: "/rag", destination: "/", permanent: true }];
  },
};

export default nextConfig;
