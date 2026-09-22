/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ESLint runs on build. It used to be skipped because the vendored banking
  // component kit carries inline eslint-disable directives for plugins this
  // project does not configure — but that kit has been in .eslintignore for a
  // while, so the reason had outlived itself and the build was left without a
  // gate it could perfectly well have. A lint error fails the build now.
  // PGlite ships a WASM Postgres; keep it (and its assets) out of the bundler
  // so it loads as a normal Node dependency at runtime.
  experimental: {
    serverComponentsExternalPackages: ["@electric-sql/pglite", "pg"],
  },
};
export default nextConfig;
