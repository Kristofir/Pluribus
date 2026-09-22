const key = "pluribus:oauth-attempt";
const maxAgeMs = 5 * 60 * 1000;

export function rememberOAuthAttempt() {
  try {
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    // Sign-in can still proceed if browser storage is unavailable.
  }
}

export function forgetOAuthAttempt() {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Nothing else needs to be cleared.
  }
}

export function oauthAttemptPending(code?: string, returned?: boolean) {
  if (code) {
    rememberOAuthAttempt();
    return true;
  }
  if (returned) {
    forgetOAuthAttempt();
    return false;
  }
  try {
    const startedAt = Number(sessionStorage.getItem(key));
    if (startedAt > 0 && Date.now() - startedAt < maxAgeMs) return true;
  } catch {
    // Fall through to the normal anonymous demo.
  }
  forgetOAuthAttempt();
  return false;
}
