// A live game (player phone or host projector) takes over the whole screen,
// Kahoot-style — site chrome there is just something to fat-finger
// mid-question. Shared by Nav and MobileNav.
export function isFullScreenGame(pathname: string | null) {
  return !!pathname && (pathname.startsWith("/games/play/") || pathname.startsWith("/games/host/"));
}
