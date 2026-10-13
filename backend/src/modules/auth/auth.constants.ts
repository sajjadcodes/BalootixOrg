export const ACCESS_TOKEN_COOKIE = 'access_token';
// 15 minutes.
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const ACCESS_TOKEN_MAX_AGE_MS = ACCESS_TOKEN_TTL_SECONDS * 1000;

export const REFRESH_TOKEN_COOKIE = 'refresh_token';
// 7 days, renewed on each refresh (rotation).
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
export const REFRESH_TOKEN_MAX_AGE_MS = REFRESH_TOKEN_TTL_SECONDS * 1000;
