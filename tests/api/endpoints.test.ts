import { describe, it, expect } from "vitest";
import { getBaseUrl, withMinorVersion, MINOR_VERSION, BASE_URLS } from "../../src/api/endpoints.js";

describe("getBaseUrl", () => {
  it("returns production URL by default", () => {
    expect(getBaseUrl("12345")).toBe(
      "https://quickbooks.api.intuit.com/v3/company/12345",
    );
  });

  it("returns production URL when sandbox is false", () => {
    expect(getBaseUrl("12345", false)).toBe(
      "https://quickbooks.api.intuit.com/v3/company/12345",
    );
  });

  it("returns sandbox URL when sandbox is true", () => {
    expect(getBaseUrl("12345", true)).toBe(
      "https://sandbox-quickbooks.api.intuit.com/v3/company/12345",
    );
  });

  it("embeds realmId in the URL", () => {
    expect(getBaseUrl("99887766")).toContain("/99887766");
  });
});

describe("withMinorVersion", () => {
  it("appends with ? when URL has no query string", () => {
    const url = "https://api.example.com/v3/company/123/customer/1";
    expect(withMinorVersion(url)).toBe(`${url}?minorversion=${MINOR_VERSION}`);
  });

  it("appends with & when URL already has query params", () => {
    const url = "https://api.example.com/v3/query?query=SELECT";
    expect(withMinorVersion(url)).toBe(`${url}&minorversion=${MINOR_VERSION}`);
  });
});

describe("constants", () => {
  it("MINOR_VERSION is 73", () => {
    expect(MINOR_VERSION).toBe(73);
  });

  it("BASE_URLS has production and sandbox", () => {
    expect(BASE_URLS.production).toContain("quickbooks.api.intuit.com");
    expect(BASE_URLS.sandbox).toContain("sandbox-quickbooks.api.intuit.com");
  });
});
