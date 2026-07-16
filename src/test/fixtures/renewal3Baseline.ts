export const RENEWAL3_BASELINE_VIEWPORTS = [
  { height: 900, screenshot: "phase0-editor-1440x900.png", width: 1440 },
  { height: 720, screenshot: "phase0-editor-1280x720.png", width: 1280 },
  { height: 844, screenshot: "phase0-editor-390x844.png", width: 390 },
] as const;

export const RENEWAL3_BASELINE_FIXTURES = {
  camera: {
    checkUsesFreeView: false,
    freeUsesFreeView: true,
  },
  lake: {
    moonReflection: true,
    periodicWaveCount: 2,
  },
  manual: {
    coordinateTransform: "bounding-client-rect",
    helpers: ["circle", "heart"],
  },
  pattern: {
    templates: ["circle", "heart"],
  },
  preview: {
    model: "approximate-eight-point-ring",
    productionPlan: false,
  },
  title: {
    runtime: "advertise",
    visibleDeadlineSeconds: 5,
  },
  workbench: {
    exposesNumericSectionControls: true,
    planes: ["xy", "xz"],
    ratios: [0.1, 0.3, 0.5, 0.7, 0.9],
  },
} as const;
