/** @type {import('next').NextConfig} */
const nextConfig = {
  generateBuildId: async () => {
    return process.env.CI_BUILD_ID || null;
  },
};

export default nextConfig;
