import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * `window.localStorage` is undefined here – Node's own Web Storage global
 * shadows happy-dom's and stays unset without `--localstorage-file`. Give it a
 * real `Storage` so code under test persists the way it does in a browser.
 */
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: new window.Storage(),
});

// Testing Library only auto-cleans when Vitest globals are enabled.
afterEach(cleanup);
