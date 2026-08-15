declare const __NAVIXA_GOOGLE_CLIENT_ID__: string;

/**
 * OAuth client IDs must be visible to the browser by design. The value is
 * injected at build time from the protected deployment secret so it is never
 * committed directly in the source repository.
 */
export const GOOGLE_CLIENT_ID=typeof __NAVIXA_GOOGLE_CLIENT_ID__==="string"?__NAVIXA_GOOGLE_CLIENT_ID__.trim():"";
