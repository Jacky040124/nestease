export const GRADIENT_PAIRS = [
  ["from-teal-100", "to-cyan-50"],
  ["from-blue-100", "to-indigo-50"],
  ["from-amber-100", "to-yellow-50"],
  ["from-emerald-100", "to-green-50"],
  ["from-violet-100", "to-purple-50"],
  ["from-rose-100", "to-pink-50"],
  ["from-sky-100", "to-blue-50"],
  ["from-orange-100", "to-amber-50"],
];

export function getGradient(address: string): string {
  const hash = address.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const pair = GRADIENT_PAIRS[hash % GRADIENT_PAIRS.length];
  return `bg-gradient-to-br ${pair[0]} ${pair[1]}`;
}
