/**
 * CSRF constant names shared between server and client. Kept in a dependency-free
 * module so the browser bundle can import them without pulling in `node:crypto`.
 */
export const CSRF_HEADER = "x-csrf-token";
export const CSRF_COOKIE = "si_csrf";
