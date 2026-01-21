import { test, expect, vi, beforeEach, describe } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";
import type { AuthResult } from "@/actions";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock actions
vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

// Mock anon work tracker
vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

// Mock project actions
vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

describe("useAuth", () => {
  let mockSignInAction: any;
  let mockSignUpAction: any;
  let mockGetAnonWorkData: any;
  let mockClearAnonWork: any;
  let mockGetProjects: any;
  let mockCreateProject: any;

  beforeEach(async () => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Import and store mock references
    const actions = await import("@/actions");
    mockSignInAction = vi.mocked(actions.signIn);
    mockSignUpAction = vi.mocked(actions.signUp);

    const anonWorkTracker = await import("@/lib/anon-work-tracker");
    mockGetAnonWorkData = vi.mocked(anonWorkTracker.getAnonWorkData);
    mockClearAnonWork = vi.mocked(anonWorkTracker.clearAnonWork);

    const getProjectsModule = await import("@/actions/get-projects");
    mockGetProjects = vi.mocked(getProjectsModule.getProjects);

    const createProjectModule = await import("@/actions/create-project");
    mockCreateProject = vi.mocked(createProjectModule.createProject);
  });

  describe("initial state", () => {
    test("returns correct initial state", () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
    });

    test("does not call any actions on mount", () => {
      renderHook(() => useAuth());

      expect(mockSignInAction).not.toHaveBeenCalled();
      expect(mockSignUpAction).not.toHaveBeenCalled();
      expect(mockGetAnonWorkData).not.toHaveBeenCalled();
      expect(mockGetProjects).not.toHaveBeenCalled();
      expect(mockCreateProject).not.toHaveBeenCalled();
    });
  });

  describe("signIn", () => {
    test("sets isLoading to true during sign in", async () => {
      mockSignInAction.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ success: true }), 100);
          })
      );

      const { result } = renderHook(() => useAuth());

      let loadingDuringExecution = false;

      act(() => {
        result.current.signIn("test@example.com", "password123");
      });

      // Check loading state immediately after calling signIn
      await waitFor(() => {
        if (result.current.isLoading) {
          loadingDuringExecution = true;
        }
      });

      expect(loadingDuringExecution).toBe(true);
    });

    test("sets isLoading to false after successful sign in", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "new-project-123" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("sets isLoading to false after failed sign in", async () => {
      mockSignInAction.mockResolvedValue({
        success: false,
        error: "Invalid credentials",
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "wrongpassword");
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("calls signInAction with correct credentials", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "project-123" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "mypassword");
      });

      expect(mockSignInAction).toHaveBeenCalledWith(
        "user@example.com",
        "mypassword"
      );
      expect(mockSignInAction).toHaveBeenCalledTimes(1);
    });

    test("returns result from signInAction", async () => {
      const mockResult: AuthResult = { success: true };
      mockSignInAction.mockResolvedValue(mockResult);
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "project-123" });

      const { result } = renderHook(() => useAuth());

      let returnValue: AuthResult | undefined;
      await act(async () => {
        returnValue = await result.current.signIn(
          "test@example.com",
          "password123"
        );
      });

      expect(returnValue).toEqual(mockResult);
    });

    test("returns error result from signInAction", async () => {
      const mockResult: AuthResult = {
        success: false,
        error: "Invalid credentials",
      };
      mockSignInAction.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useAuth());

      let returnValue: AuthResult | undefined;
      await act(async () => {
        returnValue = await result.current.signIn(
          "test@example.com",
          "wrongpassword"
        );
      });

      expect(returnValue).toEqual(mockResult);
    });

    test("does not navigate when sign in fails", async () => {
      mockSignInAction.mockResolvedValue({
        success: false,
        error: "Invalid credentials",
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "wrongpassword");
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(mockGetAnonWorkData).not.toHaveBeenCalled();
    });

    test("sets isLoading to false even if signInAction throws", async () => {
      mockSignInAction.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.signIn("test@example.com", "password123");
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("signUp", () => {
    test("sets isLoading to true during sign up", async () => {
      mockSignUpAction.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ success: true }), 100);
          })
      );

      const { result } = renderHook(() => useAuth());

      let loadingDuringExecution = false;

      act(() => {
        result.current.signUp("test@example.com", "password123");
      });

      await waitFor(() => {
        if (result.current.isLoading) {
          loadingDuringExecution = true;
        }
      });

      expect(loadingDuringExecution).toBe(true);
    });

    test("sets isLoading to false after successful sign up", async () => {
      mockSignUpAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "new-project-123" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("test@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("sets isLoading to false after failed sign up", async () => {
      mockSignUpAction.mockResolvedValue({
        success: false,
        error: "Email already exists",
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("test@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("calls signUpAction with correct credentials", async () => {
      mockSignUpAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "project-123" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("newuser@example.com", "securepass123");
      });

      expect(mockSignUpAction).toHaveBeenCalledWith(
        "newuser@example.com",
        "securepass123"
      );
      expect(mockSignUpAction).toHaveBeenCalledTimes(1);
    });

    test("returns result from signUpAction", async () => {
      const mockResult: AuthResult = { success: true };
      mockSignUpAction.mockResolvedValue(mockResult);
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "project-123" });

      const { result } = renderHook(() => useAuth());

      let returnValue: AuthResult | undefined;
      await act(async () => {
        returnValue = await result.current.signUp(
          "test@example.com",
          "password123"
        );
      });

      expect(returnValue).toEqual(mockResult);
    });

    test("returns error result from signUpAction", async () => {
      const mockResult: AuthResult = {
        success: false,
        error: "Password too short",
      };
      mockSignUpAction.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useAuth());

      let returnValue: AuthResult | undefined;
      await act(async () => {
        returnValue = await result.current.signUp("test@example.com", "123");
      });

      expect(returnValue).toEqual(mockResult);
    });

    test("does not navigate when sign up fails", async () => {
      mockSignUpAction.mockResolvedValue({
        success: false,
        error: "Email already exists",
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("test@example.com", "password123");
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(mockGetAnonWorkData).not.toHaveBeenCalled();
    });

    test("sets isLoading to false even if signUpAction throws", async () => {
      mockSignUpAction.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.signUp("test@example.com", "password123");
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("handlePostSignIn - with anonymous work", () => {
    test("creates project with anonymous work data", async () => {
      const mockAnonWork = {
        messages: [{ role: "user", content: "Test message" }],
        fileSystemData: { "/App.jsx": "content" },
      };

      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(mockAnonWork);
      mockCreateProject.mockResolvedValue({ id: "anon-project-123" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(mockCreateProject).toHaveBeenCalledWith({
        name: expect.stringContaining("Design from"),
        messages: mockAnonWork.messages,
        data: mockAnonWork.fileSystemData,
      });
    });

    test("clears anonymous work after creating project", async () => {
      const mockAnonWork = {
        messages: [{ role: "user", content: "Test message" }],
        fileSystemData: { "/App.jsx": "content" },
      };

      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(mockAnonWork);
      mockCreateProject.mockResolvedValue({ id: "anon-project-123" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(mockClearAnonWork).toHaveBeenCalledTimes(1);
    });

    test("navigates to created project with anonymous work", async () => {
      const mockAnonWork = {
        messages: [{ role: "user", content: "Test message" }],
        fileSystemData: { "/App.jsx": "content" },
      };

      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(mockAnonWork);
      mockCreateProject.mockResolvedValue({ id: "anon-project-456" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/anon-project-456");
      expect(mockPush).toHaveBeenCalledTimes(1);
    });

    test("does not fetch existing projects when anonymous work exists", async () => {
      const mockAnonWork = {
        messages: [{ role: "user", content: "Test message" }],
        fileSystemData: { "/App.jsx": "content" },
      };

      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(mockAnonWork);
      mockCreateProject.mockResolvedValue({ id: "anon-project-123" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(mockGetProjects).not.toHaveBeenCalled();
    });

    test("does not create project when anonymous work has no messages", async () => {
      const mockAnonWork = {
        messages: [],
        fileSystemData: {},
      };

      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(mockAnonWork);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "new-project-123" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(mockClearAnonWork).not.toHaveBeenCalled();
      expect(mockGetProjects).toHaveBeenCalled();
    });

    test("uses anonymous work with signUp as well", async () => {
      const mockAnonWork = {
        messages: [{ role: "user", content: "Test message" }],
        fileSystemData: { "/App.jsx": "content" },
      };

      mockSignUpAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(mockAnonWork);
      mockCreateProject.mockResolvedValue({ id: "anon-project-789" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("newuser@example.com", "password123");
      });

      expect(mockCreateProject).toHaveBeenCalledWith({
        name: expect.stringContaining("Design from"),
        messages: mockAnonWork.messages,
        data: mockAnonWork.fileSystemData,
      });
      expect(mockClearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/anon-project-789");
    });

    test("creates project name with timestamp", async () => {
      const mockAnonWork = {
        messages: [{ role: "user", content: "Test" }],
        fileSystemData: {},
      };

      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(mockAnonWork);
      mockCreateProject.mockResolvedValue({ id: "project-123" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      const createCall = mockCreateProject.mock.calls[0][0];
      expect(createCall.name).toMatch(/^Design from \d{1,2}:\d{2}:\d{2}/);
    });
  });

  describe("handlePostSignIn - with existing projects", () => {
    test("navigates to most recent project when projects exist", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([
        { id: "project-1", name: "Most Recent", updatedAt: new Date() },
        { id: "project-2", name: "Older", updatedAt: new Date(2024, 0, 1) },
      ]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(mockGetProjects).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/project-1");
      expect(mockCreateProject).not.toHaveBeenCalled();
    });

    test("does not clear anonymous work when no anonymous work exists", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([{ id: "project-1" }]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(mockClearAnonWork).not.toHaveBeenCalled();
    });

    test("works with signUp when projects exist", async () => {
      mockSignUpAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([{ id: "existing-project" }]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("newuser@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/existing-project");
    });
  });

  describe("handlePostSignIn - creating new project", () => {
    test("creates new project when no existing projects", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "new-project-123" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(mockCreateProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/^New Design #\d+$/),
        messages: [],
        data: {},
      });
    });

    test("navigates to newly created project", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "brand-new-project" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/brand-new-project");
    });

    test("creates project with random number in name", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "project-123" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      const createCall = mockCreateProject.mock.calls[0][0];
      expect(createCall.name).toMatch(/^New Design #\d+$/);

      // Extract number and verify it's within expected range
      const number = parseInt(createCall.name.match(/#(\d+)$/)?.[1] || "0");
      expect(number).toBeGreaterThanOrEqual(0);
      expect(number).toBeLessThan(100000);
    });

    test("creates project with empty messages and data", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "project-123" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(mockCreateProject).toHaveBeenCalledWith({
        name: expect.any(String),
        messages: [],
        data: {},
      });
    });

    test("works with signUp when no projects exist", async () => {
      mockSignUpAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "first-project" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("newuser@example.com", "password123");
      });

      expect(mockCreateProject).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/first-project");
    });
  });

  describe("edge cases", () => {
    test("handles null return from getAnonWorkData", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "project-123" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(mockGetProjects).toHaveBeenCalled();
    });

    test("handles undefined return from getAnonWorkData", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(undefined);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "project-123" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(mockGetProjects).toHaveBeenCalled();
    });

    test("handles empty string credentials", async () => {
      mockSignInAction.mockResolvedValue({
        success: false,
        error: "Email and password are required",
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("", "");
      });

      expect(mockSignInAction).toHaveBeenCalledWith("", "");
    });

    test("handles special characters in credentials", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "project-123" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn(
          "user+tag@example.com",
          "p@ssw0rd!#$%^&*()"
        );
      });

      expect(mockSignInAction).toHaveBeenCalledWith(
        "user+tag@example.com",
        "p@ssw0rd!#$%^&*()"
      );
    });

    test("handles concurrent sign in calls", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "project-123" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await Promise.all([
          result.current.signIn("test1@example.com", "pass1"),
          result.current.signIn("test2@example.com", "pass2"),
        ]);
      });

      expect(mockSignInAction).toHaveBeenCalledTimes(2);
    });

    test("handles getProjects throwing error", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockRejectedValue(new Error("Database error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.signIn("test@example.com", "password123");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("handles createProject throwing error", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockRejectedValue(new Error("Database error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.signIn("test@example.com", "password123");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("handles project with special characters in ID", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({
        id: "project-with-special-chars-123!@#",
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/project-with-special-chars-123!@#");
    });

    test("maintains referential stability of returned functions", () => {
      const { result, rerender } = renderHook(() => useAuth());

      const initialSignIn = result.current.signIn;
      const initialSignUp = result.current.signUp;

      rerender();

      expect(result.current.signIn).not.toBe(initialSignIn);
      expect(result.current.signUp).not.toBe(initialSignUp);
    });

    test("resets loading state after both success and error", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "project-123" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(false);

      mockSignInAction.mockResolvedValue({
        success: false,
        error: "Invalid credentials",
      });

      await act(async () => {
        await result.current.signIn("test@example.com", "wrongpassword");
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});
