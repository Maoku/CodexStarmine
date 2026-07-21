export const IOS_SEGMENTATION_IMAGE_MAXIMUM_EDGE = 512;

export interface NavigatorPlatformInfo {
  maxTouchPoints?: number;
  platform?: string;
  userAgent: string;
}

export function isIOSPlatform(
  platformInfo: NavigatorPlatformInfo | undefined,
): boolean {
  if (!platformInfo) return false;
  if (/iPad|iPhone|iPod/i.test(platformInfo.userAgent)) return true;
  return (
    platformInfo.platform === "MacIntel" &&
    (platformInfo.maxTouchPoints ?? 0) > 1
  );
}

export function segmentationImageMaximumEdge(
  defaultMaximumEdge: number,
  platformInfo: NavigatorPlatformInfo | undefined,
): number {
  return isIOSPlatform(platformInfo)
    ? Math.min(defaultMaximumEdge, IOS_SEGMENTATION_IMAGE_MAXIMUM_EDGE)
    : defaultMaximumEdge;
}
