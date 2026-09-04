import { fireEvent, render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MobileNav } from "@/components/MobileNav";
import { useMe } from "@/lib/useMe";
import { useSignOut } from "@/lib/useSignOut";
import { useUnreadCount } from "@/lib/useUnreadCount";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));
vi.mock("@/lib/useMe");
vi.mock("@/lib/useUnreadCount", () => ({ useUnreadCount: vi.fn() }));
vi.mock("@/lib/useSignOut", () => ({ useSignOut: vi.fn() }));

const mockPathname = vi.mocked(usePathname);
const mockUseMe = vi.mocked(useMe);
const mockUseUnreadCount = vi.mocked(useUnreadCount);
const mockUseSignOut = vi.mocked(useSignOut);

afterEach(() => {
  vi.restoreAllMocks();
});

function setup(pathname: string, me: ReturnType<typeof useMe>["me"] = null, signOut = vi.fn()) {
  mockPathname.mockReturnValue(pathname);
  mockUseMe.mockReturnValue({ me, loading: false, refresh: vi.fn() });
  mockUseUnreadCount.mockReturnValue(0);
  mockUseSignOut.mockReturnValue(signOut);
  return render(<MobileNav />);
}

describe("MobileNav", () => {
  test("renders nothing on admin routes", () => {
    const { container } = setup("/admin/roles");
    expect(container).toBeEmptyDOMElement();
  });

  test("Home tab is active on /", () => {
    setup("/");
    expect(screen.getByRole("link", { name: /home/i }).className).toContain("text-navy");
    expect(screen.getByRole("link", { name: /^events$/i }).className).toContain("text-faint");
  });

  test("More tab is active on a prefix-matched route like /projects/foo", () => {
    setup("/projects/foo");
    expect(screen.getByRole("button", { name: /more/i })).toHaveAttribute("aria-expanded", "true");
  });

  test("Profile tab shows Sign In and links there when signed out", () => {
    setup("/dashboard", null);
    const link = screen.getByRole("link", { name: /sign in/i });
    expect(link).toHaveAttribute("href", "/sign-in?next=%2Fdashboard");
  });

  test("Profile tab opens an account sheet with Dashboard/Settings when signed in", () => {
    setup("/dashboard", {
      id: "1",
      email: "a@example.com",
      email_verified: true,
      is_admin: false,
      photo_url: null,
      membership_status: "active",
      onboarded: true,
    });
    fireEvent.click(screen.getByRole("button", { name: /profile/i }));
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute("href", "/settings");
    expect(screen.queryByRole("link", { name: /^admin$/i })).not.toBeInTheDocument();
  });

  test("Profile sheet shows Admin link for admins and calls sign out on click", () => {
    const signOut = vi.fn();
    setup(
      "/dashboard",
      { id: "1", email: "a@example.com", email_verified: true, is_admin: true, photo_url: null, membership_status: "active", onboarded: true },
      signOut,
    );
    fireEvent.click(screen.getByRole("button", { name: /profile/i }));
    expect(screen.getByRole("link", { name: /^admin$/i })).toHaveAttribute("href", "/admin");

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("clicking More opens the sheet, clicking the overlay closes it", () => {
    setup("/");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /more/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Close menu"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("Admin link only shows in the sheet for admins", () => {
    setup("/", { id: "1", email: "a@example.com", email_verified: true, is_admin: false, photo_url: null, membership_status: "active", onboarded: true });
    fireEvent.click(screen.getByRole("button", { name: /more/i }));
    expect(screen.queryByRole("link", { name: /admin/i })).not.toBeInTheDocument();
  });

  test("Admin link shows in the sheet when me.is_admin is true", () => {
    setup("/", { id: "1", email: "a@example.com", email_verified: true, is_admin: true, photo_url: null, membership_status: "active", onboarded: true });
    fireEvent.click(screen.getByRole("button", { name: /more/i }));
    expect(screen.getByRole("link", { name: /admin/i })).toHaveAttribute("href", "/admin");
  });
});
