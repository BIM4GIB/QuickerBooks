export const MINOR_VERSION = 73;

export const BASE_URLS = {
  production: "https://quickbooks.api.intuit.com/v3/company",
  sandbox: "https://sandbox-quickbooks.api.intuit.com/v3/company",
} as const;

export function getBaseUrl(realmId: string, sandbox = false): string {
  const host = sandbox ? BASE_URLS.sandbox : BASE_URLS.production;
  return `${host}/${realmId}`;
}

export function withMinorVersion(url: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}minorversion=${MINOR_VERSION}`;
}
