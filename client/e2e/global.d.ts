export {}

declare global {
  interface Window {
    /** Gắn bởi src/mocks khi VITE_USE_MOCK=true. */
    __SE100_MOCK__?: { reset: () => void; setDelay: (ms: number | null) => void }
  }
}
