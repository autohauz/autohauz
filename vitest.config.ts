import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // The real `server-only` throws unless bundled under the react-server
      // condition; tests import server modules directly.
      "server-only": path.resolve(__dirname, "src/__tests__/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Unit tests run without a configured environment; the env contract in
    // src/lib/env.ts would otherwise throw on import of any server module.
    env: { SKIP_ENV_VALIDATION: "1" },
    // jsdom workers are heavy to boot; on a busy machine an unbounded fork
    // pool hits vitest's worker-start timeout before a single test runs.
    maxWorkers: 4,
  },
});
