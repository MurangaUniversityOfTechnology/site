import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Next's official Vitest guide uses the vite-tsconfig-paths plugin, but
  // Vite now resolves tsconfig paths natively — this avoids the extra
  // dependency the guide's install command still lists.
  resolve: { tsconfigPaths: true },
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["node_modules", ".next", "e2e/**"],
  },
});
