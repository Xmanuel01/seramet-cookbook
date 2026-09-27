// This PIN gates SAMPLE-ONLY frontend UI. It is intentionally not an auth credential.
// Fixed deadline prevents re-deployment from extending the preview without an explicit code change.
export const DEMO_PIN = "123456";
export const DEMO_EXPIRES_AT = Date.parse("2026-09-30T10:34:00Z");
export function demoAvailable(now = Date.now()): boolean {
  return now < DEMO_EXPIRES_AT;
}
