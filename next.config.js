/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: require('path').join(__dirname),
  transpilePackages: ['pdf-lib', 'qrcode'],
}

module.exports = nextConfig
