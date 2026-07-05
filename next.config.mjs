/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: false,
    serverComponentsExternalPackages: ["unpdf"]
  }
};

export default nextConfig;
