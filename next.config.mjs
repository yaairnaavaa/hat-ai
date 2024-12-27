/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // appDir: true, // Habilita la carpeta "app" como raíz del proyecto
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("@ref-finance/ref-sdk"); // Configuración específica para el SDK
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/api/:path*", // Ruta para las APIs
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,DELETE,PATCH,POST,PUT",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/.well-known/ai-plugin.json", // Reescribe esta ruta
        destination: "/api/ai-plugin", // Destino de la reescritura
      },
    ];
  },
};

export default nextConfig;
