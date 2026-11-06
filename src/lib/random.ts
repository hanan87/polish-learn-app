export function shuffle<T>(input: readonly T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function sample<T>(input: readonly T[], count: number): T[] {
  return shuffle(input).slice(0, count);
}

export function pick<T>(input: readonly T[]): T {
  return input[Math.floor(Math.random() * input.length)];
}
