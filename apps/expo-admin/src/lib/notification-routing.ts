export function resolveNotificationRoute(actionUrl?: string | null): string | null {
  if (!actionUrl) return null;

  let path = actionUrl.trim();
  if (!path) return null;

  try {
    if (/^https?:\/\//i.test(path)) {
      path = new URL(path).pathname;
    }
  } catch {
    // keep raw path if URL parsing fails
  }

  path = path.replace(/^\/dashboard/, "");
  path = path.replace(/\/+$/, "");

  if (!path.startsWith("/")) {
    path = `/${path}`;
  }

  if (path === "") {
    return null;
  }

  return path || null;
}
