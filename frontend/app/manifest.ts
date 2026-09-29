import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nexus SV",
    short_name: "Nexus SV",
    description: "AI knowledge chatbot",
    start_url: "/chat/",
    display: "standalone",
    background_color: "#08060a",
    theme_color: "#08060a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}