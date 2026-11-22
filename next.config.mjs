/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // apps/ holds the Expo apps (native android/ios trees + their own node_modules);
      // watching them exhausts the OS file-watcher limit (ENOSPC)
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**", "**/apps/**"],
      }
    }
    return config
  },
}

export default nextConfig
