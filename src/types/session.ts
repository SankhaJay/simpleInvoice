/**
 * The safe, non-sensitive view of the authenticated user that we are willing
 * to expose to the browser. Notably this contains NO tokens.
 */
export interface SessionUser {
  userId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  organisationId: string;
  organisationName: string;
  roleName: string;
}

/**
 * The richer, read-only profile shown on the Profile page. Fetched on demand
 * from `/users/me` — still token-free and safe to send to the browser.
 */
export interface UserProfile {
  userId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  mobileNumber?: string;
  email?: string;
  status?: string;
  createdAt?: string;
  organisation: {
    id: string;
    name: string;
    role: string;
    organisationRole?: string;
    organisationNumber?: string;
    companyNumber?: string;
  };
}

/**
 * The full server-side session payload. The `accessToken` and `orgToken` never
 * leave the server — they live only inside the AES-sealed iron-session cookie
 * and are attached to upstream requests by the BFF layer.
 */
export interface SessionData {
  accessToken: string;
  refreshToken?: string;
  orgToken: string;
  /** Unix epoch (ms) at which `accessToken` expires. */
  expiresAt: number;
  user: SessionUser;
  /** Double-submit CSRF token (also mirrored in a readable cookie). */
  csrfToken: string;
}
