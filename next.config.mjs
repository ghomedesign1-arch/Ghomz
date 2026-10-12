/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com", pathname: "/s/files/1/0659/0821/1883/**" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  // Make the Cairo TTFs available to the invoice-PDF API route on Vercel
  // (serverless bundler needs to be told which /public files to trace).
  experimental: {
    outputFileTracingIncludes: {
      "/api/shopify/orders/[id]/invoice": ["./public/fonts/**/*"],
    },
  },
};

export default nextConfig;
