/**
 * Escala de eixo com números "redondos" (0, 5, 10, 15…): o topo é o menor
 * valor redondo >= max, dividido em até `maxTicks` intervalos.
 */
export function niceScale(max: number, maxTicks = 4): { top: number; ticks: number[] } {
  if (!Number.isFinite(max) || max <= 0) return { top: 1, ticks: [0, 1] };
  const rough = max / maxTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude;
  const niceStep = Math.max(step, Number.isInteger(max) && max < maxTicks ? 1 : step);
  const top = Math.ceil(max / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += niceStep) ticks.push(Math.round(v * 1e6) / 1e6);
  return { top, ticks };
}

/** Relative luminance (WCAG) de um #rrggbb, para escolher texto claro/escuro sobre a cor. */
export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
