export interface SvgClientPoint {
  x: number;
  y: number;
}

/** Uses the browser's rendered SVG transform, including letterboxing and CSS transforms. */
export function clientPointToSvg(
  clientX: number,
  clientY: number,
  canvas: SVGSVGElement,
): SvgClientPoint {
  const matrix = canvas.getScreenCTM?.() ?? null;
  if (matrix && typeof DOMPoint !== "undefined") {
    const local = new DOMPoint(clientX, clientY).matrixTransform(
      matrix.inverse(),
    );
    return { x: local.x, y: local.y };
  }

  const bounds = canvas.getBoundingClientRect();
  const viewBox = canvas.viewBox.baseVal;
  const viewWidth = viewBox.width || 600;
  const viewHeight = viewBox.height || 544;
  const scale =
    Math.min(bounds.width / viewWidth, bounds.height / viewHeight) || 1;
  const renderedWidth = viewWidth * scale;
  const renderedHeight = viewHeight * scale;
  const offsetX = (bounds.width - renderedWidth) / 2;
  const offsetY = (bounds.height - renderedHeight) / 2;
  return {
    x: (clientX - bounds.left - offsetX) / scale + viewBox.x,
    y: (clientY - bounds.top - offsetY) / scale + viewBox.y,
  };
}
