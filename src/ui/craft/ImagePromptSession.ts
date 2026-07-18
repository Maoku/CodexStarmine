import type {
  ImagePrompt,
  ImagePromptKind,
  NormalizedImagePoint,
  NormalizedImageRect,
} from "./GuidedImagePlacementTypes";

export const IMAGE_PROMPT_LIMITS: Record<ImagePromptKind, number> = {
  background: 5,
  feature: 5,
  subject: 3,
};

export interface ImagePromptSessionSnapshot {
  prompts: ImagePrompt[];
  subjectBox?: NormalizedImageRect;
}

export interface ImagePromptSessionState extends ImagePromptSessionSnapshot {
  history: ImagePromptSessionSnapshot[];
  revision: number;
}

export type ImagePromptSessionResult =
  | { changed: true; state: ImagePromptSessionState }
  | { changed: false; reason: "duplicate-id" | "limit-reached" };

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function normalizedPrecision(value: number): number {
  return Math.round(clamp01(value) * 1_000_000_000) / 1_000_000_000;
}

function clonePrompts(prompts: ImagePrompt[]): ImagePrompt[] {
  return prompts.map((prompt) => ({
    ...prompt,
    point: { ...prompt.point },
  }));
}

function cloneRect(
  rect: NormalizedImageRect | undefined,
): NormalizedImageRect | undefined {
  return rect ? { ...rect } : undefined;
}

function snapshot(
  state: ImagePromptSessionSnapshot,
): ImagePromptSessionSnapshot {
  return {
    prompts: clonePrompts(state.prompts),
    subjectBox: cloneRect(state.subjectBox),
  };
}

function transition(
  state: ImagePromptSessionState,
  next: ImagePromptSessionSnapshot,
): ImagePromptSessionState {
  return {
    ...snapshot(next),
    history: [...state.history.map(snapshot), snapshot(state)],
    revision: state.revision + 1,
  };
}

export function normalizeImageRect(
  first: NormalizedImagePoint,
  second: NormalizedImagePoint,
): NormalizedImageRect {
  const firstX = clamp01(first.x);
  const firstY = clamp01(first.y);
  const secondX = clamp01(second.x);
  const secondY = clamp01(second.y);
  return {
    left: Math.min(firstX, secondX),
    top: Math.min(firstY, secondY),
    right: Math.max(firstX, secondX),
    bottom: Math.max(firstY, secondY),
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
    state: transition(state, {
      prompts: [
        ...state.prompts,
        {
          id: prompt.id,
          kind: prompt.kind,
          point: {
            x: clamp01(prompt.point.x),
            y: clamp01(prompt.point.y),
          },
        },
      ],
      subjectBox: state.subjectBox,
    }),
  };
}

export function moveImagePrompt(
  state: ImagePromptSessionState,
  id: string,
  point: NormalizedImagePoint,
): ImagePromptSessionState {
  const prompt = state.prompts.find((item) => item.id === id);
  if (!prompt) return state;
  const nextPoint = { x: clamp01(point.x), y: clamp01(point.y) };
  if (prompt.point.x === nextPoint.x && prompt.point.y === nextPoint.y) {
    return state;
  }
  return transition(state, {
    prompts: state.prompts.map((item) =>
      item.id === id ? { ...item, point: nextPoint } : item,
    ),
    subjectBox: state.subjectBox,
  });
}

export function removeImagePrompt(
  state: ImagePromptSessionState,
  id: string,
): ImagePromptSessionState {
  if (!state.prompts.some((prompt) => prompt.id === id)) return state;
  return transition(state, {
    prompts: state.prompts.filter((prompt) => prompt.id !== id),
    subjectBox: state.subjectBox,
  });
}

export function clearImagePrompts(
  state: ImagePromptSessionState,
): ImagePromptSessionState {
  if (state.prompts.length === 0) return state;
  return transition(state, { prompts: [], subjectBox: state.subjectBox });
}

export function setSubjectBox(
  state: ImagePromptSessionState,
  rect: NormalizedImageRect,
): ImagePromptSessionState {
  const normalized = normalizeImageRect(
    { x: rect.left, y: rect.top },
    { x: rect.right, y: rect.bottom },
  );
  if (
    state.subjectBox?.left === normalized.left &&
    state.subjectBox.top === normalized.top &&
    state.subjectBox.right === normalized.right &&
    state.subjectBox.bottom === normalized.bottom
  ) {
    return state;
  }
  return transition(state, {
    prompts: state.prompts,
    subjectBox: normalized,
  });
}

export function moveSubjectBox(
  state: ImagePromptSessionState,
  delta: NormalizedImagePoint,
): ImagePromptSessionState {
  const rect = state.subjectBox;
  if (!rect) return state;
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;
  const left = normalizedPrecision(Math.min(rect.left + delta.x, 1 - width));
  const top = normalizedPrecision(Math.min(rect.top + delta.y, 1 - height));
  return setSubjectBox(state, {
    bottom: normalizedPrecision(top + height),
    left,
    right: normalizedPrecision(left + width),
    top,
  });
}

export function clearSubjectBox(
  state: ImagePromptSessionState,
): ImagePromptSessionState {
  if (!state.subjectBox) return state;
  return transition(state, { prompts: state.prompts });
}

export function clearImagePromptSession(
  state: ImagePromptSessionState,
): ImagePromptSessionState {
  if (state.prompts.length === 0 && !state.subjectBox) return state;
  return transition(state, { prompts: [] });
}

export function undoImagePrompt(
  state: ImagePromptSessionState,
): ImagePromptSessionState {
  const previous = state.history.at(-1);
  if (!previous) return state;
  return {
    ...snapshot(previous),
    history: state.history.slice(0, -1).map(snapshot),
    revision: state.revision + 1,
  };
}
