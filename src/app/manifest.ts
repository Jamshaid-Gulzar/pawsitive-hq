import type { MetadataRoute } from "next";

// Lets pet parents "Add to Home Screen" and open Pawsitive full-screen, like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pawsitive HQ",
    short_name: "Pawsitive",
    description: "Book stays, pass vaccine checks and get photo updates of your pet.",
    start_url: "/my",
    display: "standalone",
    background_color: "#fbf7f2",
    theme_color: "#fbf7f2",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
