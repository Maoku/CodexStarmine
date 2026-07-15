export type RenewalScreenKind =
  | "mode-select"
  | "library"
  | "initial-setup"
  | "editor"
  | "viewer-check"
  | "viewer-free";

/** Five mounted screen components; the viewer has check and free contexts. */
export const RENEWAL_SCREEN_COMPONENTS = [
  "mode-select",
  "library",
  "initial-setup",
  "editor",
  "viewer",
] as const;

export type RenewalNavigationAction =
  | "choose-craft"
  | "choose-free"
  | "create-design"
  | "edit-design"
  | "cancel-setup"
  | "begin-editing"
  | "check-on-lake"
  | "back-to-editor"
  | "back-to-library"
  | "save-to-library"
  | "back-to-mode-select";

export interface RenewalScreenTransition {
  readonly action: RenewalNavigationAction;
  readonly dirtyGuard: boolean;
  readonly from: RenewalScreenKind;
  readonly to: RenewalScreenKind;
}

/**
 * Navigation acceptance matrix fixed before the renewal UI is introduced.
 * Phase 1's flow controller must implement these routes without adding hidden
 * cross-screen shortcuts.
 */
export const RENEWAL_SCREEN_TRANSITIONS = [
  {
    action: "choose-craft",
    dirtyGuard: false,
    from: "mode-select",
    to: "library",
  },
  {
    action: "choose-free",
    dirtyGuard: false,
    from: "mode-select",
    to: "viewer-free",
  },
  {
    action: "create-design",
    dirtyGuard: false,
    from: "library",
    to: "initial-setup",
  },
  {
    action: "edit-design",
    dirtyGuard: false,
    from: "library",
    to: "editor",
  },
  {
    action: "cancel-setup",
    dirtyGuard: false,
    from: "initial-setup",
    to: "library",
  },
  {
    action: "begin-editing",
    dirtyGuard: false,
    from: "initial-setup",
    to: "editor",
  },
  {
    action: "check-on-lake",
    dirtyGuard: false,
    from: "editor",
    to: "viewer-check",
  },
  {
    action: "back-to-editor",
    dirtyGuard: false,
    from: "viewer-check",
    to: "editor",
  },
  {
    action: "back-to-library",
    dirtyGuard: true,
    from: "editor",
    to: "library",
  },
  {
    action: "save-to-library",
    dirtyGuard: false,
    from: "editor",
    to: "library",
  },
  {
    action: "back-to-mode-select",
    dirtyGuard: false,
    from: "viewer-free",
    to: "mode-select",
  },
] as const satisfies readonly RenewalScreenTransition[];

export type RenewalPreviewKind =
  "virtual-star-balloon" | "inline-diagnostic" | "lake-check" | "free-show";

export interface RenewalPreviewResponsibility {
  readonly input:
    "single-star" | "draft-aggregate" | "single-design" | "show-plan";
  readonly kind: RenewalPreviewKind;
  readonly renderer: "abstract-2d" | "firework-system";
  readonly result: "abstract" | "production";
}

/** Rendering ownership matrix used by Phase 4 and Phase 5 regression tests. */
export const RENEWAL_PREVIEW_RESPONSIBILITIES = [
  {
    input: "single-star",
    kind: "virtual-star-balloon",
    renderer: "abstract-2d",
    result: "abstract",
  },
  {
    input: "draft-aggregate",
    kind: "inline-diagnostic",
    renderer: "abstract-2d",
    result: "abstract",
  },
  {
    input: "single-design",
    kind: "lake-check",
    renderer: "firework-system",
    result: "production",
  },
  {
    input: "show-plan",
    kind: "free-show",
    renderer: "firework-system",
    result: "production",
  },
] as const satisfies readonly RenewalPreviewResponsibility[];
