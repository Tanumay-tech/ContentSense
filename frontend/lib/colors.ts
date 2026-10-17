// Categorical palette (validated for colour-vision deficiency in this fixed order).
// Colour follows the entity: a topic keeps its slot for the whole analysis run.
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
export const OTHER = "#a9a7a0";
export const PRIMARY = "#2a78d6";
export const MUTED_BAR = "#c9d9ef";

// Marker shapes give scatter points a second, non-colour channel.
export const SHAPES = ["circle", "square", "triangle", "diamond", "star", "cross", "wye", "circle"] as const;

export function colorFor(name: string, order: string[]): string {
  const i = order.indexOf(name);
  return i >= 0 && i < SERIES.length ? SERIES[i] : OTHER;
}

export function shapeFor(name: string, order: string[]) {
  const i = order.indexOf(name);
  return SHAPES[(i < 0 ? 0 : i) % SHAPES.length];
}
