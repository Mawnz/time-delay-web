import { serve } from "bun";

serve({
  async fetch(req) {
    const url = new URL(req.url);
    let response: Response;

    if (url.pathname.startsWith("/cdn-proxy/")) {
        const proxyPath = url.pathname.replace("/cdn-proxy/", "");
        const targetUrl = `https://unpkg.com/${proxyPath}`;
        
        try {
            const upstreamResponse = await fetch(targetUrl);
            
            console.log(`Proxying: ${targetUrl} -> Status: ${upstreamResponse.status}`);
            
            if (upstreamResponse.status !== 200) {
                 console.error(`Upstream failed for ${targetUrl}`);
                 return new Response("Upstream Error", { status: 502 });
            }

            let contentType = upstreamResponse.headers.get("Content-Type");
            if (targetUrl.endsWith(".wasm")) {
                contentType = "application/wasm";
            } else if (targetUrl.endsWith(".js")) {
                contentType = "application/javascript";
            }

            response = new Response(upstreamResponse.body, {
                status: upstreamResponse.status,
                headers: {
                    "Content-Type": contentType || "application/octet-stream",
                    "Cross-Origin-Resource-Policy": "cross-origin",
                    "Access-Control-Allow-Origin": "*", 
                }
            });
        } catch (e) {
            console.error("Proxy error:", e);
            response = new Response("Proxy Error", { status: 502 });
        }
    } 
    else if (url.pathname === "/") {
      response = new Response(Bun.file("index.html"), {
        headers: { "Content-Type": "text/html" },
      });
    } else if (url.pathname === "/main.js") {
      const result = await Bun.build({
        entrypoints: ['main.ts'],
        target: 'browser',
      });
      response = new Response(result.outputs[0], {
        headers: { "Content-Type": "application/javascript" },
      });
    } else if (url.pathname === "/styles.css") {
      response = new Response(Bun.file("styles.css"), {
        headers: { "Content-Type": "text/css" },
      });
    } else if (url.pathname === "/favicon.ico") {
        response = new Response(null, { status: 204 });
    } else {
      response = new Response("Not Found", { status: 404 });
    }

    // Global headers for SharedArrayBuffer support
    response.headers.set("Cross-Origin-Embedder-Policy", "credentialless");
    response.headers.set("Cross-Origin-Opener-Policy", "same-origin");

    return response;
  },
  port: 3000,
});

console.log("Server running at http://localhost:3000");