import { describe, expect, it } from "vitest";
import { isOnAnnouncementTarget, sitePath } from "./announcementPage";

const ORIGIN = "https://mutlabs.tech";

describe("sitePath", () => {
  it("passes relative links through and strips our own origin", () => {
    expect(sitePath("/forms/design-arena", ORIGIN)).toBe("/forms/design-arena");
    expect(sitePath("https://mutlabs.tech/forms/design-arena?x=1", ORIGIN)).toBe("/forms/design-arena?x=1");
  });

  it("returns null for outside links and a lookalike host", () => {
    expect(sitePath("https://example.com/forms/design-arena", ORIGIN)).toBeNull();
    expect(sitePath("https://mutlabs.tech.evil.example/x", ORIGIN)).toBeNull();
    expect(sitePath(null, ORIGIN)).toBeNull();
  });
});

describe("isOnAnnouncementTarget", () => {
  it("matches the page the button links to, relative or same-site absolute", () => {
    expect(isOnAnnouncementTarget("/forms/design-arena", "/forms/design-arena", ORIGIN)).toBe(true);
    expect(isOnAnnouncementTarget("/forms/design-arena", "https://mutlabs.tech/forms/design-arena", ORIGIN)).toBe(true);
  });

  it("ignores query, hash and a trailing slash", () => {
    expect(isOnAnnouncementTarget("/forms/design-arena/", "/forms/design-arena?ref=x#top", ORIGIN)).toBe(true);
  });

  it("does not match other pages, sub-pages or outside links", () => {
    expect(isOnAnnouncementTarget("/forms", "/forms/design-arena", ORIGIN)).toBe(false);
    expect(isOnAnnouncementTarget("/forms/design-arena/edit", "/forms/design-arena", ORIGIN)).toBe(false);
    expect(isOnAnnouncementTarget("/forms/design-arena", "https://example.com/forms/design-arena", ORIGIN)).toBe(false);
    expect(isOnAnnouncementTarget("/", null, ORIGIN)).toBe(false);
  });
});
