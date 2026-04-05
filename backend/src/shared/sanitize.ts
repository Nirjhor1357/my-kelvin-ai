export function sanitizeText(input: string, maxChars = 2000): string {
  const cleaned = input
    .replace(/\u0000/g, "")
    .replace(/[\r\t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned.length > maxChars ? cleaned.slice(0, maxChars) : cleaned;
}
