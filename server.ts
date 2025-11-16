import { serve } from "bun";
import { appendFile } from "fs/promises";

serve({
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/") {
      return new Response(Bun.file("index.html"), {
        headers: { "Content-Type": "text/html" },
      });
    }
    if (url.pathname === "/main.js") {
      const result = await Bun.build({
        entrypoints: ['main.ts'],
        target: 'browser'
      });
      return new Response(result.outputs[0], {
        headers: { "Content-Type": "application/javascript" },
      });
    }
    return new Response("Not Found", { status: 404 });
  },
  port: 3000,
});

console.log("Server running at http://localhost:3000");