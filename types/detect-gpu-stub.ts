export interface TierResult {
  tier: number;
  type: string;
  isMobile?: boolean;
  fps?: number;
  gpu?: string;
  device?: string;
}

export function getGPUTier(_options?: {
  benchmarksURL?: string;
}): Promise<TierResult> {
  return Promise.resolve({ tier: 3, type: "BENCHMARK" });
}
