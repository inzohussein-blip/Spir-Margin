/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Type-checking (tsc) still runs on build; ESLint is skipped because the
  // vendored banking component kit carries inline eslint-disable directives
  // for plugins not configured in this project.
  eslint: { ignoreDuringBuilds: true },
  // PGlite ships a WASM Postgres; keep it (and its assets) out of the bundler
  // so it loads as a normal Node dependency at runtime.
  experimental: {
    serverComponentsExternalPackages: ["@electric-sql/pglite"],
  },
};
export default nextConfig;
