export function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function optionalEnv(name: string, fallback = "") {
  return process.env[name] || fallback;
}

export function aiMockMode() {
  return process.env.AI_MOCK_MODE !== "false" || !process.env.ANTHROPIC_API_KEY;
}

// Dev/demo only: mint email login codes server-side and show them on the sign-in screen,
// bypassing email delivery entirely. Anyone who can reach the app can log in as any email
// while this is on — never enable in production.
export function devLoginCodesEnabled() {
  return process.env.DEV_LOGIN_CODES === "true" && process.env.NODE_ENV !== "production";
}
