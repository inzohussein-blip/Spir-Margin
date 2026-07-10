/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Type-checking (tsc) still runs on build; ESLint is skipped because the
  // vendored banking component kit carries inline eslint-disable directives
  // for plugins not configured in this project.
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
