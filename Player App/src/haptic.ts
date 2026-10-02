const PULSE = { tap: 15, tick: 10, snap: 22 } as const;

export function buzz(kind: keyof typeof PULSE) {
  try {
    navigator.vibrate?.(PULSE[kind]);
  } catch {
    // Some browsers block vibration without a user gesture.
  }
}
