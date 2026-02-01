/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: require('path').join(__dirname),
  transpilePackages: ['pdf-lib', 'qrcode'],
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.fenam.website' }],
        destination: 'https://fenam.website/:path*',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
