import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Not using Vitest's `globals` mode (test/describe/etc are imported
// explicitly per file), so React Testing Library's auto-cleanup — which
// hooks the global afterEach — never registers on its own. Without this,
// every render() in a multi-test file stacks up in the same document
// instead of being torn down between tests.
afterEach(() => {
  cleanup();
});
