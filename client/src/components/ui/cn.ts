/** Ghép class Tailwind, bỏ giá trị rỗng. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}
