/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  // Allow loading dev assets when you hit the dev server via LAN IP from your phone.
  allowedDevOrigins: [
    "http://192.168.12.128:3000",
    "https://192.168.12.128:3001",
    "https://february-transmission-exempt-verse.trycloudflare.com",
    "https://undo-boc-merge-cho.trycloudflare.com",
    "https://theorem-yet-indicated-unique.trycloudflare.com",
    "https://sponsorship-personally-monetary-logged.trycloudflare.com"
  ],
};

module.exports = nextConfig;
