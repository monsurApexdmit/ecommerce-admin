const baseURL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
const imageBaseURL = baseURL.replace(/\/api\/?$/, "");

export function getImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  const clean = path.replace(/^\//, "");
  if (!imageBaseURL) {
    return clean.startsWith("storage/") ? `/${clean}` : `/storage/${clean}`;
  }

  if (clean.startsWith("storage/")) {
    return `${imageBaseURL}/${clean}`;
  }

  return `${imageBaseURL}/storage/${clean}`;
}
