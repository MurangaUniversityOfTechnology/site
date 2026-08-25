import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ApiError, authApi } from "@/lib/api";

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockResponse(status: number, body?: unknown, statusText = "") {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => {
      if (body === undefined) throw new Error("no body");
      return body;
    },
  } as Response;
}

describe("apiFetch (via authApi)", () => {
  test("parses JSON on a successful response", async () => {
    const me = { id: "1", email: "a@example.com", email_verified: true, is_admin: false, membership_status: "active" };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse(200, me));

    const result = await authApi.me();
    expect(result).toEqual(me);
  });

  test("returns undefined on a 204 without calling .json()", async () => {
    const res = mockResponse(204);
    const jsonSpy = vi.spyOn(res, "json");
    vi.mocked(global.fetch).mockResolvedValue(res);

    const result = await authApi.logout();
    expect(result).toBeUndefined();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  test("throws ApiError with the body's detail on a non-OK JSON response", async () => {
    vi.mocked(global.fetch).mockResolvedValue(mockResponse(401, { detail: "Incorrect email or password" }));

    await expect(authApi.me()).rejects.toMatchObject({
      status: 401,
      message: "Incorrect email or password",
    });
    await expect(authApi.me()).rejects.toBeInstanceOf(ApiError);
  });

  test("falls back to statusText when the error body isn't JSON", async () => {
    const res = mockResponse(500, undefined, "Internal Server Error");
    vi.mocked(global.fetch).mockResolvedValue(res);

    await expect(authApi.me()).rejects.toMatchObject({
      status: 500,
      message: "Internal Server Error",
    });
  });

  test("every request sends credentials: include", async () => {
    vi.mocked(global.fetch).mockResolvedValue(mockResponse(200, {}));
    await authApi.me();

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(init?.credentials).toBe("include");
  });
});
