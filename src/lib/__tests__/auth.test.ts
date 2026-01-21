import { test, expect, vi, beforeEach, afterEach, describe } from "vitest";
import { createSession, deleteSession, getSession, verifySession } from "@/lib/auth";
import { NextRequest } from "next/server";

// Mock the dependencies
vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("jose", () => ({
  SignJWT: vi.fn(),
  jwtVerify: vi.fn(),
}));

describe("createSession", () => {
  let mockCookieStore: {
    set: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockSignJWT: any;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Store original NODE_ENV
    originalEnv = process.env.NODE_ENV;

    // Create mock cookie store
    mockCookieStore = {
      set: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
    };

    // Mock the cookies() function to return our mock store
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);

    // Mock SignJWT chain
    mockSignJWT = {
      setProtectedHeader: vi.fn().mockReturnThis(),
      setExpirationTime: vi.fn().mockReturnThis(),
      setIssuedAt: vi.fn().mockReturnThis(),
      sign: vi.fn().mockResolvedValue("mocked-jwt-token"),
    };

    const { SignJWT } = await import("jose");
    vi.mocked(SignJWT).mockImplementation(() => mockSignJWT);
  });

  afterEach(() => {
    // Restore original NODE_ENV
    if (originalEnv !== undefined) {
      process.env.NODE_ENV = originalEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  test("creates a session with JWT token", async () => {
    const userId = "user-123";
    const email = "test@example.com";

    await createSession(userId, email);

    // Verify SignJWT was called with session payload
    const { SignJWT } = await import("jose");
    expect(SignJWT).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        email,
        expiresAt: expect.any(Date),
      })
    );

    // Verify JWT chain methods were called
    expect(mockSignJWT.setProtectedHeader).toHaveBeenCalledWith({
      alg: "HS256",
    });
    expect(mockSignJWT.setExpirationTime).toHaveBeenCalledWith("7d");
    expect(mockSignJWT.setIssuedAt).toHaveBeenCalled();
    expect(mockSignJWT.sign).toHaveBeenCalled();
  });

  test("sets cookie with correct name and token", async () => {
    const userId = "user-123";
    const email = "test@example.com";

    await createSession(userId, email);

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "auth-token",
      "mocked-jwt-token",
      expect.any(Object)
    );
  });

  test("sets cookie with httpOnly flag", async () => {
    const userId = "user-123";
    const email = "test@example.com";

    await createSession(userId, email);

    const cookieOptions = mockCookieStore.set.mock.calls[0][2];
    expect(cookieOptions.httpOnly).toBe(true);
  });

  test("sets cookie with lax sameSite policy", async () => {
    const userId = "user-123";
    const email = "test@example.com";

    await createSession(userId, email);

    const cookieOptions = mockCookieStore.set.mock.calls[0][2];
    expect(cookieOptions.sameSite).toBe("lax");
  });

  test("sets cookie with root path", async () => {
    const userId = "user-123";
    const email = "test@example.com";

    await createSession(userId, email);

    const cookieOptions = mockCookieStore.set.mock.calls[0][2];
    expect(cookieOptions.path).toBe("/");
  });

  test("sets cookie expiry to 7 days from now", async () => {
    const userId = "user-123";
    const email = "test@example.com";
    const beforeTime = Date.now();

    await createSession(userId, email);

    const cookieOptions = mockCookieStore.set.mock.calls[0][2];
    const expiryTime = cookieOptions.expires.getTime();
    const afterTime = Date.now();

    // Expected expiry is 7 days (7 * 24 * 60 * 60 * 1000 ms)
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
    const expectedMinExpiry = beforeTime + sevenDaysInMs;
    const expectedMaxExpiry = afterTime + sevenDaysInMs;

    expect(expiryTime).toBeGreaterThanOrEqual(expectedMinExpiry);
    expect(expiryTime).toBeLessThanOrEqual(expectedMaxExpiry);
  });

  test("sets secure flag to false in development", async () => {
    process.env.NODE_ENV = "development";

    const userId = "user-123";
    const email = "test@example.com";

    await createSession(userId, email);

    const cookieOptions = mockCookieStore.set.mock.calls[0][2];
    expect(cookieOptions.secure).toBe(false);
  });

  test("sets secure flag to true in production", async () => {
    process.env.NODE_ENV = "production";

    const userId = "user-123";
    const email = "test@example.com";

    await createSession(userId, email);

    const cookieOptions = mockCookieStore.set.mock.calls[0][2];
    expect(cookieOptions.secure).toBe(true);
  });

  test("sets secure flag to false when NODE_ENV is not set", async () => {
    delete process.env.NODE_ENV;

    const userId = "user-123";
    const email = "test@example.com";

    await createSession(userId, email);

    const cookieOptions = mockCookieStore.set.mock.calls[0][2];
    expect(cookieOptions.secure).toBe(false);
  });

  test("handles different userId formats", async () => {
    const testCases = [
      { userId: "123", email: "test@example.com" },
      { userId: "user-abc-def-123", email: "test@example.com" },
      { userId: "00000000-0000-0000-0000-000000000000", email: "test@example.com" },
    ];

    for (const testCase of testCases) {
      vi.clearAllMocks();
      await createSession(testCase.userId, testCase.email);

      const { SignJWT } = await import("jose");
      expect(SignJWT).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testCase.userId,
        })
      );
    }
  });

  test("handles different email formats", async () => {
    const testCases = [
      { userId: "user-123", email: "simple@example.com" },
      { userId: "user-123", email: "user+tag@example.com" },
      { userId: "user-123", email: "user.name@sub.example.com" },
    ];

    for (const testCase of testCases) {
      vi.clearAllMocks();
      await createSession(testCase.userId, testCase.email);

      const { SignJWT } = await import("jose");
      expect(SignJWT).toHaveBeenCalledWith(
        expect.objectContaining({
          email: testCase.email,
        })
      );
    }
  });

  test("session payload includes expiry date", async () => {
    const userId = "user-123";
    const email = "test@example.com";

    await createSession(userId, email);

    const { SignJWT } = await import("jose");
    const payload = vi.mocked(SignJWT).mock.calls[0][0];

    expect(payload.expiresAt).toBeInstanceOf(Date);
    expect(payload.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  test("calls cookies() function", async () => {
    const userId = "user-123";
    const email = "test@example.com";

    await createSession(userId, email);

    const { cookies } = await import("next/headers");
    expect(cookies).toHaveBeenCalled();
  });

  test("signs JWT with secret", async () => {
    const userId = "user-123";
    const email = "test@example.com";

    await createSession(userId, email);

    // Verify sign was called (secret is TextEncoded JWT_SECRET)
    expect(mockSignJWT.sign).toHaveBeenCalledTimes(1);
    expect(mockSignJWT.sign).toHaveBeenCalledWith(expect.anything());
  });
});

describe("deleteSession", () => {
  let mockCookieStore: {
    set: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create mock cookie store
    mockCookieStore = {
      set: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
    };

    // Mock the cookies() function to return our mock store
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);
  });

  test("calls cookies() function", async () => {
    await deleteSession();

    const { cookies } = await import("next/headers");
    expect(cookies).toHaveBeenCalled();
  });

  test("deletes cookie with correct name", async () => {
    await deleteSession();

    expect(mockCookieStore.delete).toHaveBeenCalledWith("auth-token");
  });

  test("deletes cookie only once", async () => {
    await deleteSession();

    expect(mockCookieStore.delete).toHaveBeenCalledTimes(1);
  });

  test("completes successfully without errors", async () => {
    await expect(deleteSession()).resolves.not.toThrow();
  });

  test("does not call set or get on cookie store", async () => {
    await deleteSession();

    expect(mockCookieStore.set).not.toHaveBeenCalled();
    expect(mockCookieStore.get).not.toHaveBeenCalled();
  });

  test("handles multiple sequential calls", async () => {
    await deleteSession();
    await deleteSession();
    await deleteSession();

    expect(mockCookieStore.delete).toHaveBeenCalledTimes(3);
    expect(mockCookieStore.delete).toHaveBeenCalledWith("auth-token");
  });
});

describe("getSession", () => {
  let mockCookieStore: {
    set: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockJwtVerify: any;

  beforeEach(async () => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create mock cookie store
    mockCookieStore = {
      set: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
    };

    // Mock the cookies() function to return our mock store
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);

    // Mock jwtVerify
    const { jwtVerify } = await import("jose");
    mockJwtVerify = vi.mocked(jwtVerify);
  });

  test("calls cookies() function", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    await getSession();

    const { cookies } = await import("next/headers");
    expect(cookies).toHaveBeenCalled();
  });

  test("gets cookie with correct name", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    await getSession();

    expect(mockCookieStore.get).toHaveBeenCalledWith("auth-token");
  });

  test("returns null when no token exists", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const result = await getSession();

    expect(result).toBeNull();
  });

  test("returns null when token value is undefined", async () => {
    mockCookieStore.get.mockReturnValue({ value: undefined });

    const result = await getSession();

    expect(result).toBeNull();
  });

  test("calls jwtVerify with token and secret", async () => {
    const mockToken = "valid-jwt-token";
    mockCookieStore.get.mockReturnValue({ value: mockToken });

    const mockPayload = {
      userId: "user-123",
      email: "test@example.com",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    mockJwtVerify.mockResolvedValue({ payload: mockPayload });

    await getSession();

    expect(mockJwtVerify).toHaveBeenCalledWith(mockToken, expect.anything());
  });

  test("returns session payload when verification succeeds", async () => {
    const mockToken = "valid-jwt-token";
    mockCookieStore.get.mockReturnValue({ value: mockToken });

    const mockPayload = {
      userId: "user-123",
      email: "test@example.com",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    mockJwtVerify.mockResolvedValue({ payload: mockPayload });

    const result = await getSession();

    expect(result).toEqual(mockPayload);
  });

  test("returns payload with correct userId", async () => {
    const mockToken = "valid-jwt-token";
    mockCookieStore.get.mockReturnValue({ value: mockToken });

    const mockPayload = {
      userId: "user-abc-123",
      email: "test@example.com",
      expiresAt: new Date(),
    };

    mockJwtVerify.mockResolvedValue({ payload: mockPayload });

    const result = await getSession();

    expect(result?.userId).toBe("user-abc-123");
  });

  test("returns payload with correct email", async () => {
    const mockToken = "valid-jwt-token";
    mockCookieStore.get.mockReturnValue({ value: mockToken });

    const mockPayload = {
      userId: "user-123",
      email: "user@example.com",
      expiresAt: new Date(),
    };

    mockJwtVerify.mockResolvedValue({ payload: mockPayload });

    const result = await getSession();

    expect(result?.email).toBe("user@example.com");
  });

  test("returns null when jwtVerify throws error", async () => {
    const mockToken = "invalid-jwt-token";
    mockCookieStore.get.mockReturnValue({ value: mockToken });

    mockJwtVerify.mockRejectedValue(new Error("Invalid token"));

    const result = await getSession();

    expect(result).toBeNull();
  });

  test("returns null when token is expired", async () => {
    const mockToken = "expired-jwt-token";
    mockCookieStore.get.mockReturnValue({ value: mockToken });

    mockJwtVerify.mockRejectedValue(new Error("Token expired"));

    const result = await getSession();

    expect(result).toBeNull();
  });

  test("returns null when token signature is invalid", async () => {
    const mockToken = "tampered-jwt-token";
    mockCookieStore.get.mockReturnValue({ value: mockToken });

    mockJwtVerify.mockRejectedValue(new Error("Signature verification failed"));

    const result = await getSession();

    expect(result).toBeNull();
  });

  test("does not call set or delete on cookie store", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    await getSession();

    expect(mockCookieStore.set).not.toHaveBeenCalled();
    expect(mockCookieStore.delete).not.toHaveBeenCalled();
  });

  test("handles different session payload structures", async () => {
    const testCases = [
      {
        userId: "123",
        email: "simple@example.com",
        expiresAt: new Date("2025-01-01"),
      },
      {
        userId: "user-uuid-format",
        email: "complex+tag@sub.domain.com",
        expiresAt: new Date("2026-12-31"),
      },
    ];

    for (const mockPayload of testCases) {
      vi.clearAllMocks();
      mockCookieStore.get.mockReturnValue({ value: "valid-token" });
      mockJwtVerify.mockResolvedValue({ payload: mockPayload });

      const result = await getSession();

      expect(result).toEqual(mockPayload);
    }
  });
});

describe("verifySession", () => {
  let mockJwtVerify: any;

  beforeEach(async () => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Mock jwtVerify
    const { jwtVerify } = await import("jose");
    mockJwtVerify = vi.mocked(jwtVerify);
  });

  function createMockRequest(token?: string): NextRequest {
    const mockCookies = {
      get: vi.fn((name: string) => {
        if (name === "auth-token" && token) {
          return { value: token };
        }
        return undefined;
      }),
    };

    return {
      cookies: mockCookies,
    } as any as NextRequest;
  }

  test("returns null when no token exists", async () => {
    const request = createMockRequest();

    const result = await verifySession(request);

    expect(result).toBeNull();
  });

  test("returns null when token value is undefined", async () => {
    const request = createMockRequest(undefined);

    const result = await verifySession(request);

    expect(result).toBeNull();
  });

  test("gets cookie with correct name", async () => {
    const request = createMockRequest();

    await verifySession(request);

    expect(request.cookies.get).toHaveBeenCalledWith("auth-token");
  });

  test("calls jwtVerify with token and secret", async () => {
    const mockToken = "valid-jwt-token";
    const request = createMockRequest(mockToken);

    const mockPayload = {
      userId: "user-123",
      email: "test@example.com",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    mockJwtVerify.mockResolvedValue({ payload: mockPayload });

    await verifySession(request);

    expect(mockJwtVerify).toHaveBeenCalledWith(mockToken, expect.anything());
  });

  test("returns session payload when verification succeeds", async () => {
    const mockToken = "valid-jwt-token";
    const request = createMockRequest(mockToken);

    const mockPayload = {
      userId: "user-123",
      email: "test@example.com",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    mockJwtVerify.mockResolvedValue({ payload: mockPayload });

    const result = await verifySession(request);

    expect(result).toEqual(mockPayload);
  });

  test("returns payload with correct userId", async () => {
    const mockToken = "valid-jwt-token";
    const request = createMockRequest(mockToken);

    const mockPayload = {
      userId: "user-abc-123",
      email: "test@example.com",
      expiresAt: new Date(),
    };

    mockJwtVerify.mockResolvedValue({ payload: mockPayload });

    const result = await verifySession(request);

    expect(result?.userId).toBe("user-abc-123");
  });

  test("returns payload with correct email", async () => {
    const mockToken = "valid-jwt-token";
    const request = createMockRequest(mockToken);

    const mockPayload = {
      userId: "user-123",
      email: "user@example.com",
      expiresAt: new Date(),
    };

    mockJwtVerify.mockResolvedValue({ payload: mockPayload });

    const result = await verifySession(request);

    expect(result?.email).toBe("user@example.com");
  });

  test("returns null when jwtVerify throws error", async () => {
    const mockToken = "invalid-jwt-token";
    const request = createMockRequest(mockToken);

    mockJwtVerify.mockRejectedValue(new Error("Invalid token"));

    const result = await verifySession(request);

    expect(result).toBeNull();
  });

  test("returns null when token is expired", async () => {
    const mockToken = "expired-jwt-token";
    const request = createMockRequest(mockToken);

    mockJwtVerify.mockRejectedValue(new Error("Token expired"));

    const result = await verifySession(request);

    expect(result).toBeNull();
  });

  test("returns null when token signature is invalid", async () => {
    const mockToken = "tampered-jwt-token";
    const request = createMockRequest(mockToken);

    mockJwtVerify.mockRejectedValue(new Error("Signature verification failed"));

    const result = await verifySession(request);

    expect(result).toBeNull();
  });

  test("handles different session payload structures", async () => {
    const testCases = [
      {
        userId: "123",
        email: "simple@example.com",
        expiresAt: new Date("2025-01-01"),
      },
      {
        userId: "user-uuid-format",
        email: "complex+tag@sub.domain.com",
        expiresAt: new Date("2026-12-31"),
      },
    ];

    for (const mockPayload of testCases) {
      vi.clearAllMocks();
      const request = createMockRequest("valid-token");
      mockJwtVerify.mockResolvedValue({ payload: mockPayload });

      const result = await verifySession(request);

      expect(result).toEqual(mockPayload);
    }
  });

  test("does not modify request object", async () => {
    const mockToken = "valid-jwt-token";
    const request = createMockRequest(mockToken);

    const mockPayload = {
      userId: "user-123",
      email: "test@example.com",
      expiresAt: new Date(),
    };

    mockJwtVerify.mockResolvedValue({ payload: mockPayload });

    await verifySession(request);

    // Should only call get, not modify cookies
    expect(request.cookies.get).toHaveBeenCalledTimes(1);
  });

  test("handles multiple verification attempts with same request", async () => {
    const mockToken = "valid-jwt-token";
    const request = createMockRequest(mockToken);

    const mockPayload = {
      userId: "user-123",
      email: "test@example.com",
      expiresAt: new Date(),
    };

    mockJwtVerify.mockResolvedValue({ payload: mockPayload });

    const result1 = await verifySession(request);
    const result2 = await verifySession(request);

    expect(result1).toEqual(mockPayload);
    expect(result2).toEqual(mockPayload);
    expect(mockJwtVerify).toHaveBeenCalledTimes(2);
  });

  test("works with real NextRequest object structure", async () => {
    // Create a more realistic NextRequest mock
    const mockToken = "valid-jwt-token";
    const request = new NextRequest("https://example.com", {
      headers: {
        cookie: `auth-token=${mockToken}`,
      },
    });

    const mockPayload = {
      userId: "user-123",
      email: "test@example.com",
      expiresAt: new Date(),
    };

    mockJwtVerify.mockResolvedValue({ payload: mockPayload });

    const result = await verifySession(request);

    expect(result).toEqual(mockPayload);
  });
});
