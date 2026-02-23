/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.parqet.com",
        port: "",
        pathname: "/logos/**",
      },
    ],
  },
  output: "standalone",
  rewrites: async () => {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8080/:path*",
      },
    ];
  },
};

export default nextConfig;
