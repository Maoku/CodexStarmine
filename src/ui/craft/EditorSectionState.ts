import type { LayerIntentV4, SectionRef } from "../../data";

/**
 * Pattern sections are document state, so history navigation must restore the
 * visible editor section with the pattern snapshot. Manual and preset section
 * choices remain transient view state until an explicit edit uses them.
 */
export function synchronizeEditorSection(
  current: SectionRef,
  selectedLayer: LayerIntentV4 | undefined,
): SectionRef {
  return selectedLayer?.authoringMode === "pattern"
    ? { ...selectedLayer.pattern.section }
    : current;
}
