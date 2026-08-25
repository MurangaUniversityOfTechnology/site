import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { JoinProjectPanel } from "@/components/JoinProjectPanel";
import { ApiError, projectApi } from "@/lib/api";
import { useMe } from "@/lib/useMe";

vi.mock("@/lib/useMe");
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, projectApi: { ...actual.projectApi, join: vi.fn() } };
});

const mockUseMe = vi.mocked(useMe);

beforeEach(() => {
  vi.mocked(projectApi.join).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("JoinProjectPanel", () => {
  test("renders nothing while loading", () => {
    mockUseMe.mockReturnValue({ me: null, loading: true, refresh: vi.fn() });
    const { container } = render(<JoinProjectPanel slug="p" isMember={false} requestStatus={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("shows Contributor badge when already a member, regardless of me", () => {
    mockUseMe.mockReturnValue({ me: null, loading: false, refresh: vi.fn() });
    render(<JoinProjectPanel slug="p" isMember={true} requestStatus={null} />);
    expect(screen.getByText(/Contributor/)).toBeInTheDocument();
  });

  test("shows pending status copy", () => {
    mockUseMe.mockReturnValue({ me: null, loading: false, refresh: vi.fn() });
    render(<JoinProjectPanel slug="p" isMember={false} requestStatus="pending" />);
    expect(screen.getByText(/pending review/)).toBeInTheDocument();
  });

  test("shows rejected status copy", () => {
    mockUseMe.mockReturnValue({ me: null, loading: false, refresh: vi.fn() });
    render(<JoinProjectPanel slug="p" isMember={false} requestStatus="rejected" />);
    expect(screen.getByText(/not approved/)).toBeInTheDocument();
  });

  test("prompts sign-in when signed out", () => {
    mockUseMe.mockReturnValue({ me: null, loading: false, refresh: vi.fn() });
    render(<JoinProjectPanel slug="p" isMember={false} requestStatus={null} />);
    expect(screen.getByRole("link", { name: /sign in to join/i })).toHaveAttribute("href", "/sign-in");
  });

  test("prompts membership activation when signed in but not active", () => {
    mockUseMe.mockReturnValue({
      me: { id: "1", email: "a@example.com", email_verified: true, is_admin: false, membership_status: "none" },
      loading: false,
      refresh: vi.fn(),
    });
    render(<JoinProjectPanel slug="p" isMember={false} requestStatus={null} />);
    expect(screen.getByRole("link", { name: /activate membership to join/i })).toHaveAttribute(
      "href",
      "/membership/activate"
    );
  });

  test("active member can open the form, toggle areas, and submit", async () => {
    mockUseMe.mockReturnValue({
      me: { id: "1", email: "a@example.com", email_verified: true, is_admin: false, membership_status: "active" },
      loading: false,
      refresh: vi.fn(),
    });
    vi.mocked(projectApi.join).mockResolvedValue({ id: "req-1", status: "pending", created_at: "2026-01-01" });

    render(<JoinProjectPanel slug="my-project" isMember={false} requestStatus={null} />);

    fireEvent.click(screen.getByRole("button", { name: /join project/i }));
    fireEvent.click(screen.getByRole("button", { name: "Backend" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "I want to help" } });
    fireEvent.click(screen.getByRole("button", { name: /send request/i }));

    expect(projectApi.join).toHaveBeenCalledWith("my-project", {
      contribution_areas: ["Backend"],
      message: "I want to help",
    });

    await screen.findByText(/pending review/);
  });

  test("surfaces an ApiError message when submit fails", async () => {
    mockUseMe.mockReturnValue({
      me: { id: "1", email: "a@example.com", email_verified: true, is_admin: false, membership_status: "active" },
      loading: false,
      refresh: vi.fn(),
    });
    vi.mocked(projectApi.join).mockRejectedValue(new ApiError(400, "Already requested"));

    render(<JoinProjectPanel slug="my-project" isMember={false} requestStatus={null} />);
    fireEvent.click(screen.getByRole("button", { name: /join project/i }));
    fireEvent.click(screen.getByRole("button", { name: /send request/i }));

    await screen.findByText("Already requested");
  });
});
