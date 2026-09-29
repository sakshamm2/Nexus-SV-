/** @type {import('next').NextConfig} */
module.exports = {
  output: "export",      // builds plain static files into the "out" folder
  trailingSlash: true,   // /chat becomes chat/index.html, which works inside an app
  images: { unoptimized: true },
};