import { describe, expect, it } from "vitest";

import { FREE_VIEW_PRESET_IDS } from "../../modes/viewFree";
import {
  getViewerPanelTogglePresentation,
  renderViewerCameraControl,
  renderViewerVolumeControl,
  viewerCameraViewLabel,
} from "./ViewingStage";

describe("viewer camera controls", () => {
  it("renders the shared presets, reset action, and interaction guidance", () => {
    const markup = renderViewerCameraControl("wide");

    for (const presetId of FREE_VIEW_PRESET_IDS) {
      expect(markup).toContain(`value="${presetId}"`);
    }
    expect(markup).toContain('name="viewer-view-preset"');
    expect(markup).toContain('data-viewer-action="view-reset"');
    expect(markup).toContain("ドラッグ");
    expect(markup).toContain("WASD / 矢印");
    expect(markup).toContain('value="wide" selected');
  });

  it("offers drone mode and disables manual controls while it is active", () => {
    const markup = renderViewerCameraControl("wide", "ja", "drone");

    expect(markup).toContain('data-viewer-action="camera-manual"');
    expect(markup).toContain('data-viewer-action="camera-drone"');
    expect(markup).toContain(
      'data-viewer-action="camera-drone" aria-pressed="true"',
    );
    expect(markup).toContain('name="viewer-view-preset" disabled');
    expect(markup).toContain("静止撮影を挟みながら");
    expect(markup).toContain("開花の中を突き抜けて");
    expect(markup).toContain("いつでも「手動カメラ」へ戻せます");
  });

  it("labels a handoff from drone mode as a free manual view", () => {
    expect(viewerCameraViewLabel("drone", "audience")).toBe("ドローン");
    expect(viewerCameraViewLabel("manual", "audience", "ja", true)).toBe(
      "自由操作",
    );
    expect(viewerCameraViewLabel("manual", "wide")).toBe("湖畔ワイド");
  });
});

describe("viewer audio controls", () => {
  it("renders the saved volume as an accessible percentage slider", () => {
    const markup = renderViewerVolumeControl(0.63);

    expect(markup).toContain("花火の音量");
    expect(markup).toContain('name="viewer-volume"');
    expect(markup).toContain('min="0" max="100"');
    expect(markup).toContain('value="63"');
    expect(markup).toContain(">63%</output>");
    expect(markup).toContain("打上音と開花音");
  });

  it("clamps invalid UI values to the slider range", () => {
    expect(renderViewerVolumeControl(2, "en")).toContain('value="100"');
    expect(renderViewerVolumeControl(-1, "en")).toContain('value="0"');
  });
});

describe("viewer panel toggle", () => {
  it.each([
    ["free", "フリー鑑賞"],
    ["check", "確認"],
  ] as const)(
    "keeps the %s panel reopenable after it is collapsed",
    (context, panelName) => {
      expect(getViewerPanelTogglePresentation(context, true)).toEqual({
        ariaLabel: `${panelName}パネルを折りたたむ`,
        text: "折りたたむ",
      });
      expect(getViewerPanelTogglePresentation(context, false)).toEqual({
        ariaLabel: `${panelName}パネルを開く`,
        text: "パネルを開く",
      });
    },
  );
});
