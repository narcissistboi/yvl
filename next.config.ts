import { wgslTurbopackRule } from "@vgpu/wgsl/next";
import type { NextConfig } from "next";

const config: NextConfig = {
  output: "export",
  basePath: "/yvl",
  images: { unoptimized: true },
  transpilePackages: ["vgpu", "@vgpu/core", "@vgpu/wgsl", "@vgpu/wgsl-std"],
  turbopack: {
    rules: {
      "*.wgsl": wgslTurbopackRule(),
    },
  },
};

export default config;
