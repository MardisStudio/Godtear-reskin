export function wrap(index: number, count: number) {
  if (count <= 0) {
    return 0;
  }

  return ((index % count) + count) % count;
}

/** Shortest signed distance from a fractional cursor to a card index. */
export function fanOffset(index: number, cursor: number, count: number) {
  let delta = index - cursor;
  delta -= Math.round(delta / count) * count;
  return delta;
}
