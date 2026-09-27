import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: ".", testMatch: ["mobile-ui.spec.ts", "tasks-mobile.spec.ts", "home-mobile.spec.ts", "invoices-mobile.spec.ts", "inbox-mobile.spec.ts"], fullyParallel: false,
  timeout: 45000, reporter: "list", outputDir: "../.design-reference/test-results",
  use: { ...devices["iPhone 13"], browserName: "chromium", baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
});
