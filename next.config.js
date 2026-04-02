/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
    serverExternalPackages: ['@supabase/ssr'],
  },
}

module.exports = nextConfig
