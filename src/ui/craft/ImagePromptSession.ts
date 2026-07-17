import type {
  ImagePrompt,
  ImagePromptKind,
  NormalizedImagePoint,
} from "./GuidedImagePlacementTypes";

export const IMAGE_PROMPT_LIMITS: Record<ImagePromptKind, number> = {
  background: 5,
  feature: 5,
  subject: 3,
};

export interface ImagePromptSessionState {
  history: ImagePrompt[][];
  prompts: ImagePrompt[];
  revision: number;
}

export type ImagePromptSessionResult =
  | { changed: true; state: ImagePromptSessionState }
  | { changed: false; reason: "duplicate-id" | "limit-reached" };

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function clonePrompts(prompts: ImagePrompt[]): ImagePrompt[] {
  return prompts.map((prompt) => ({
    ...prompt,
    point: { ...prompt.point },
  }));
}

function transition(
  state: ImagePromptSessionState,
  prompts: ImagePrompt[],
): ImagePromptSessionState {
  return {
    history: [...state.history, clonePrompts(state.prompts)],
    prompts: clonePrompts(prompts),
    revision: state.revision + 1,
  };
}

export function createImagePromptSession(): ImagePromptSessionState {
  return { history: [], prompts: [], revision: 0 };
}

export function addImagePrompt(
  state: ImagePromptSessionState,
  prompt: {
    id: string;
    kind: ImagePromptKind;
    point: NormalizedImagePoint;
  },
): ImagePromptSessionResult {
  if (state.prompts.some((item) => item.id === prompt.id)) {
    return { changed: false, reason: "duplicate-id" };
  }
  if (
    state.prompts.filter((item) => item.kind === prompt.kind).length >=
    IMAGE_PROMPT_LIMITS[prompt.kind]
  ) {
    return { changed: false, reason: "limit-reached" };
  }
  return {
    changed: true,
    state: transition(state, [
      ...state.prompts,
      {
        id: prompt.id,
        kind: prompt.kind,
        point: {
          x: clamp01(prompt.point.x),
          y: clamp01(prompt.point.y),
        },
      },
    ]),
  };
}

export function removeImagePrompt(
  state: ImagePromptSessionState,
  id: string,
): ImagePromptSessionState {
  if (!state.prompts.some((prompt) => prompt.id === id)) return state;
  return transition(
    state,
    state.prompts.filter((prompt) => prompt.id !== id),
  );
}

export function clearImagePrompts(
  state: ImagePromptSessionState,
): ImagePromptSessionState {
  if (state.prompts.length === 0) return state;
  return transition(state, []);
}

export function undoImagePrompt(
  state: ImagePromptSessionState,
): ImagePromptSessionState {
  const previous = state.history.at(-1);
  if (!previous) return state;
  return {
    history: state.history.slice(0, -1).map(clonePrompts),
    prompts: clonePrompts(previous),
    revision: state.revision + 1,
  };
}
