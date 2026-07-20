export type CraftEditorRefineEvidence =
  "unit" | "dom" | "browser" | "screenshot" | "quality-gate";

export interface CraftEditorRefineAcceptanceContract {
  readonly evidence: readonly CraftEditorRefineEvidence[];
  readonly id: `CER-${string}`;
  readonly phase: 0 | 1 | 2 | 3 | 4 | 5;
  readonly requirement: string;
}

/**
 * Renewal3 hid explicit section controls. The refine brief intentionally
 * supersedes only that interaction contract while retaining the 3D navigator.
 */
export const CRAFT_EDITOR_REFINE_RENEWAL3_OVERRIDES = [
  {
    renewal3Id: "R3-02",
    replacement: "X/Y/Z buttons select YZ/XZ/XY and remain keyboard operable",
  },
  {
    renewal3Id: "R3-03",
    replacement: "A five-step section-position slider is explicitly visible",
  },
] as const;

/** Stable selectors used by unit and browser acceptance checks. */
export const CRAFT_EDITOR_REFINE_TEST_HOOKS = [
  "data-editor-header",
  "data-editor-transport",
  "data-editor-message",
  "data-editor-load",
  "data-save-state",
  "data-selected-layer-inspector",
  "data-preview-dock",
  "data-mobile-drawer",
  "data-workbench-zoom",
  "data-section-plane",
  "data-section-step",
] as const;

export const CRAFT_EDITOR_REFINE_ACCEPTANCE_CONTRACTS = [
  {
    id: "CER-TYPE-HEADER",
    requirement: "Readable type tokens and a compact editor header",
    phase: 1,
    evidence: ["unit", "dom", "browser", "screenshot"],
  },
  {
    id: "CER-TRANSPORT",
    requirement: "Footer status, load, save, and lake-check actions",
    phase: 2,
    evidence: ["unit", "dom", "browser"],
  },
  {
    id: "CER-INSPECTOR",
    requirement: "Layer name in the inspector heading and expanded settings",
    phase: 2,
    evidence: ["unit", "dom", "screenshot"],
  },
  {
    id: "CER-PREVIEW",
    requirement:
      "Collapsible fixed-seed preview below the selected-layer inspector",
    phase: 2,
    evidence: ["unit", "dom", "screenshot"],
  },
  {
    id: "CER-GEOMETRY",
    requirement: "XY, XZ, and YZ section and view projection round trips",
    phase: 3,
    evidence: ["unit"],
  },
  {
    id: "CER-CONTROLS",
    requirement: "Compact XYZ, five-step section, and zoom controls",
    phase: 4,
    evidence: ["unit", "dom", "browser"],
  },
  {
    id: "CER-POINTER",
    requirement: "Pointer placement matches rotated and zoomed projection",
    phase: 4,
    evidence: ["unit", "browser"],
  },
  {
    id: "CER-RESPONSIVE",
    requirement: "Primary actions remain usable at all three target viewports",
    phase: 5,
    evidence: ["browser", "screenshot", "quality-gate"],
  },
  {
    id: "CER-ACCESSIBILITY",
    requirement:
      "Mobile drawers restore focus, conceal inactive rails, and respect reduced motion",
    phase: 5,
    evidence: ["dom", "browser", "quality-gate"],
  },
] as const satisfies readonly CraftEditorRefineAcceptanceContract[];
