interface ImportMetaEnv {
  /** Gốc API, mặc định `/api/v1`. */
  readonly VITE_API_BASE_URL?: string
  /** `true`: mọi request đi vào mock adapter `src/mocks/`, không gọi fetch. */
  readonly VITE_USE_MOCK?: string
  /** Độ trễ mock (ms). `0` tắt; bỏ trống = ngẫu nhiên 150–300 ms. */
  readonly VITE_MOCK_DELAY_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
