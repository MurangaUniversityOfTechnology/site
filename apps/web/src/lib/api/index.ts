// Barrel re-exporting every API domain module so existing `@/lib/api` imports
// keep working unchanged. See ./core, ./shared, and the per-domain files
// (auth, profile, membership, donations, events, courses, roadmaps,
// challenges, notifications, members, content, projects, forms, community,
// admin/*) for the actual implementations — this file adds no logic of its
// own.
export { API_URL, ApiError } from "./core";
export * from "./shared";
export * from "./auth";
export * from "./profile";
export * from "./membership";
export * from "./donations";
export * from "./events";
export * from "./courses";
export * from "./roadmaps";
export * from "./challenges";
export * from "./notifications";
export * from "./members";
export * from "./content";
export * from "./projects";
export * from "./forms";
export * from "./community";
export * from "./admin";
