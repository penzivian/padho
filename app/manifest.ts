import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Padho.",
    short_name: "Padho",
    description: "Tests, grading and progress for your batches.",
    start_url: "/",
    display: "standalone",
    background_color: "#eef0e7",
    theme_color: "#1a6b63",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }
    ]
  };
}
