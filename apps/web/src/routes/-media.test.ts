import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@sweettreats/env/server", () => ({
  env: {},
}));

let handleMediaGet: typeof import("./media/$").handleMediaGet;

beforeAll(async () => {
  ({ handleMediaGet } = await import("./media/$"));
});

function request() {
  return new Request("https://sweet.test/media/products/chocolate-chip-cookie.png");
}

describe("media route", () => {
  it("redirects to the public asset path when R2 media is not configured", async () => {
    const response = await handleMediaGet({
      media: null,
      request: request(),
      splat: "products/chocolate-chip-cookie.png",
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://sweet.test/products/chocolate-chip-cookie.png",
    );
  });

  it("redirects missing product images to their bundled fallback path", async () => {
    const response = await handleMediaGet({
      media: { get: vi.fn(async () => null) },
      request: request(),
      splat: "products/missing.png",
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://sweet.test/products/missing.png");
  });

  it("returns cached media objects from R2", async () => {
    const body = "cookie image";
    const response = await handleMediaGet({
      media: {
        get: vi.fn(async () => ({
          body,
          httpEtag: "abc123",
          writeHttpMetadata(headers: Headers) {
            headers.set("content-type", "image/png");
          },
        })),
      },
      request: request(),
      splat: "products/chocolate-chip-cookie.png",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("etag")).toBe("abc123");
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(await response.text()).toBe(body);
  });
});
