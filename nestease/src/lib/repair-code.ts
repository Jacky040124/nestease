/**
 * Generates a 6-character alphanumeric repair code for a property.
 * Format: alternating letter-digit pattern (e.g., A3K7P2)
 */
export function generateRepairCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // exclude I, O (ambiguous)
  const digits = "23456789"; // exclude 0, 1 (ambiguous)

  let code = "";
  for (let i = 0; i < 6; i++) {
    if (i % 2 === 0) {
      code += letters[Math.floor(Math.random() * letters.length)];
    } else {
      code += digits[Math.floor(Math.random() * digits.length)];
    }
  }
  return code;
}
