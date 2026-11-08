/** Khai báo tập trung query key cho TanStack Query (CLAUDE.md mục 4). */
export const queryKeys = {
  shifts: {
    current: ['shifts', 'current'] as const,
  },
  customers: {
    all: ['customers'] as const,
    byPhone: (phone: string) => ['customers', 'by-phone', phone] as const,
  },
}
