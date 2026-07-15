import {
  RENEWAL_SCREEN_TRANSITIONS,
  type RenewalNavigationAction,
  type RenewalScreenKind,
} from "./renewalContracts";

export interface InitialSetupDraft {
  sizeClass: "small" | "medium" | "large";
  template: "chrysanthemum" | "peony" | "blank";
}

export type AppScreen =
  | { kind: "mode-select" }
  | { kind: "library"; selectedDesignId?: string }
  | { kind: "initial-setup"; draft: InitialSetupDraft }
  | { kind: "editor"; designId: string; origin: "new" | "saved" }
  | {
      kind: "viewer";
      context: "check" | "free";
      designId?: string;
    };

export interface AppFlowNavigationPayload {
  designId?: string;
  draft?: InitialSetupDraft;
  origin?: "new" | "saved";
}

export interface AppFlowControllerOptions {
  confirmDiscard?: () => boolean;
}

type Listener = (screen: AppScreen) => void;

const DEFAULT_SETUP_DRAFT: InitialSetupDraft = {
  sizeClass: "medium",
  template: "chrysanthemum",
};

export function appScreenKind(screen: AppScreen): RenewalScreenKind {
  if (screen.kind !== "viewer") return screen.kind;
  return screen.context === "check" ? "viewer-check" : "viewer-free";
}

export class AppFlowController {
  readonly #confirmDiscard: () => boolean;
  readonly #listeners = new Set<Listener>();
  #editorDirty = false;
  #lastEditorScreen?: Extract<AppScreen, { kind: "editor" }>;
  #screen: AppScreen = { kind: "mode-select" };

  constructor(options: AppFlowControllerOptions = {}) {
    this.#confirmDiscard = options.confirmDiscard ?? (() => true);
  }

  get hasUnsavedEditorChanges(): boolean {
    return this.#editorDirty;
  }

  get screen(): AppScreen {
    return structuredClone(this.#screen);
  }

  navigate(
    action: RenewalNavigationAction,
    payload: AppFlowNavigationPayload = {},
  ): boolean {
    const from = appScreenKind(this.#screen);
    const transition = RENEWAL_SCREEN_TRANSITIONS.find(
      (candidate) => candidate.action === action && candidate.from === from,
    );
    if (!transition) return false;
    if (transition.dirtyGuard && this.#editorDirty) {
      if (!this.#confirmDiscard()) return false;
      this.#editorDirty = false;
    }

    this.#screen = this.#destination(transition.to, payload);
    if (this.#screen.kind === "editor") {
      this.#lastEditorScreen = structuredClone(this.#screen);
    }
    this.#emit();
    return true;
  }

  back(): boolean {
    const kind = appScreenKind(this.#screen);
    if (kind === "library" || kind === "viewer-free") {
      return this.navigate("back-to-mode-select");
    }
    if (kind === "initial-setup") return this.navigate("cancel-setup");
    if (kind === "editor") {
      return this.navigate("back-to-library", {
        designId:
          this.#screen.kind === "editor" ? this.#screen.designId : undefined,
      });
    }
    if (kind === "viewer-check") {
      return this.navigate("back-to-editor", {
        designId: this.#lastEditorScreen?.designId,
        origin: this.#lastEditorScreen?.origin,
      });
    }
    return false;
  }

  setEditorDirty(dirty: boolean): void {
    this.#editorDirty = dirty;
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    listener(this.screen);
    return () => this.#listeners.delete(listener);
  }

  #destination(
    kind: RenewalScreenKind,
    payload: AppFlowNavigationPayload,
  ): AppScreen {
    if (kind === "mode-select") return { kind };
    if (kind === "library") {
      return { kind, selectedDesignId: payload.designId };
    }
    if (kind === "initial-setup") {
      return {
        kind,
        draft: structuredClone(payload.draft ?? DEFAULT_SETUP_DRAFT),
      };
    }
    if (kind === "editor") {
      const previousDesignId =
        this.#screen.kind === "editor" ? this.#screen.designId : undefined;
      return {
        kind,
        designId:
          payload.designId ??
          previousDesignId ??
          this.#lastEditorScreen?.designId ??
          "draft-current",
        origin: payload.origin ?? this.#lastEditorScreen?.origin ?? "saved",
      };
    }
    const currentDesignId =
      this.#screen.kind === "editor" ? this.#screen.designId : undefined;
    return {
      kind: "viewer",
      context: kind === "viewer-check" ? "check" : "free",
      designId: payload.designId ?? currentDesignId,
    };
  }

  #emit(): void {
    const screen = this.screen;
    this.#listeners.forEach((listener) => listener(screen));
  }
}
