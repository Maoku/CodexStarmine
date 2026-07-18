import type {
  ImagePrompt,
  NormalizedImageRect,
  ProbabilityMask,
  SubjectMask,
} from "./GuidedImagePlacementTypes";
import {
  countPromptViolations,
  thresholdProbabilityMask,
} from "./MaskCandidateSelector";

interface Component {
  indices: number[];
  meanProbability: number;
  subjectSeedCount: number;
  boxOverlap: number;
}

export interface SubjectMaskPostprocessorOptions {
  subjectBox?: NormalizedImageRect;
  threshold: number;
}

export interface SubjectMaskPostprocessorResult {
  constraintRepairApplied: boolean;
  constraintsSatisfied: boolean;
  mask: SubjectMask;
  promptViolationCount: number;
}

function pointIndex(
  point: { x: number; y: number },
  width: number,
  height: number,
): number {
  const x = Math.min(width - 1, Math.max(0, Math.floor(point.x * width)));
  const y = Math.min(height - 1, Math.max(0, Math.floor(point.y * height)));
  return y * width + x;
}

function paintPromptDisk(
  mask: SubjectMask,
  prompt: ImagePrompt,
  value: number,
): boolean {
  const center = pointIndex(prompt.point, mask.width, mask.height);
  const centerX = center % mask.width;
  const centerY = Math.floor(center / mask.width);
  const radius = Math.max(
    1,
    Math.round(Math.min(mask.width, mask.height) * 0.008),
  );
  let changed = false;
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if (
        x < 0 ||
        y < 0 ||
        x >= mask.width ||
        y >= mask.height ||
        Math.hypot(x - centerX, y - centerY) > radius
      ) {
        continue;
      }
      const index = y * mask.width + x;
      if (mask.data[index] !== value) {
        mask.data[index] = value;
        changed = true;
      }
    }
  }
  return changed;
}

function components(
  mask: SubjectMask,
  probabilityMask: ProbabilityMask,
  prompts: ImagePrompt[],
  subjectBox: NormalizedImageRect | undefined,
): Component[] {
  const length = mask.width * mask.height;
  const visited = new Uint8Array(length);
  const subjectSeeds = new Set(
    prompts
      .filter((prompt) => prompt.kind === "subject")
      .map((prompt) => pointIndex(prompt.point, mask.width, mask.height)),
  );
  const result: Component[] = [];
  for (let start = 0; start < length; start += 1) {
    if (!mask.data[start] || visited[start]) continue;
    const indices = [start];
    visited[start] = 1;
    let probability = 0;
    let subjectSeedCount = 0;
    let insideBox = 0;
    for (let head = 0; head < indices.length; head += 1) {
      const index = indices[head];
      probability += probabilityMask.data[index] ?? 0;
      if (subjectSeeds.has(index)) subjectSeedCount += 1;
      const x = index % mask.width;
      const y = Math.floor(index / mask.width);
      const normalizedX = (x + 0.5) / mask.width;
      const normalizedY = (y + 0.5) / mask.height;
      if (
        !subjectBox ||
        (normalizedX >= subjectBox.left &&
          normalizedX <= subjectBox.right &&
          normalizedY >= subjectBox.top &&
          normalizedY <= subjectBox.bottom)
      ) {
        insideBox += 1;
      }
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x < mask.width - 1 ? index + 1 : -1,
        index - mask.width,
        index + mask.width,
      ];
      for (const neighbor of neighbors) {
        if (
          neighbor >= 0 &&
          neighbor < length &&
          mask.data[neighbor] &&
          !visited[neighbor]
        ) {
          visited[neighbor] = 1;
          indices.push(neighbor);
        }
      }
    }
    result.push({
      boxOverlap: insideBox / indices.length,
      indices,
      meanProbability: probability / indices.length,
      subjectSeedCount,
    });
  }
  return result;
}

function retainAdaptiveComponents(
  mask: SubjectMask,
  probabilityMask: ProbabilityMask,
  prompts: ImagePrompt[],
  options: SubjectMaskPostprocessorOptions,
): SubjectMask {
  const found = components(mask, probabilityMask, prompts, options.subjectBox);
  if (found.length === 0) return mask;
  const hasSubjectSeeds = prompts.some((prompt) => prompt.kind === "subject");
  const minimumArea = Math.max(3, Math.floor(mask.width * mask.height * 0.002));
  const largestComponent = found.reduce((largest, component) =>
    component.indices.length > largest.indices.length ? component : largest,
  );
  const output = new Uint8Array(mask.width * mask.height);
  for (const component of found) {
    const explicitlySelected = component.subjectSeedCount > 0;
    const strongUnpromptedComponent =
      component.indices.length >= minimumArea &&
      component.meanProbability >= Math.min(0.98, options.threshold + 0.15) &&
      component.boxOverlap >= 0.5;
    const keep = hasSubjectSeeds
      ? explicitlySelected
      : component === largestComponent || strongUnpromptedComponent;
    if (keep) component.indices.forEach((index) => (output[index] = 255));
  }
  return { data: output, height: mask.height, width: mask.width };
}

export function postprocessProbabilityMask(
  probabilityMask: ProbabilityMask,
  prompts: ImagePrompt[],
  options: SubjectMaskPostprocessorOptions,
): SubjectMaskPostprocessorResult {
  let mask = thresholdProbabilityMask(probabilityMask, options.threshold);
  let constraintRepairApplied = false;
  for (const prompt of prompts) {
    if (prompt.kind === "subject") {
      constraintRepairApplied =
        paintPromptDisk(mask, prompt, 255) || constraintRepairApplied;
    }
  }
  for (const prompt of prompts) {
    if (prompt.kind === "background") {
      constraintRepairApplied =
        paintPromptDisk(mask, prompt, 0) || constraintRepairApplied;
    }
  }
  mask = retainAdaptiveComponents(mask, probabilityMask, prompts, options);
  // Component removal may expose a repaired seed only if prompts conflict. Reapply in
  // deterministic foreground-then-background order and report any remaining conflict.
  for (const prompt of prompts) {
    if (prompt.kind === "subject") {
      constraintRepairApplied =
        paintPromptDisk(mask, prompt, 255) || constraintRepairApplied;
    }
  }
  for (const prompt of prompts) {
    if (prompt.kind === "background") {
      constraintRepairApplied =
        paintPromptDisk(mask, prompt, 0) || constraintRepairApplied;
    }
  }
  const promptViolationCount = countPromptViolations(mask, prompts);
  return {
    constraintRepairApplied,
    constraintsSatisfied: promptViolationCount === 0,
    mask,
    promptViolationCount,
  };
}

export function cleanBinarySubjectMask(
  mask: SubjectMask,
  prompts: ImagePrompt[],
): SubjectMaskPostprocessorResult {
  const probabilityMask: ProbabilityMask = {
    data: Float32Array.from(mask.data, (value) => (value ? 1 : 0)),
    height: mask.height,
    width: mask.width,
  };
  return postprocessProbabilityMask(probabilityMask, prompts, {
    threshold: 0.5,
  });
}
