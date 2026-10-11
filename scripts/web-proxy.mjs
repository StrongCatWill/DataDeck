// Web build on its own port: forwards everything to the running Next server and tags each request
// x-datadeck-variant: web, so next.config.mjs serves the portal at "/". One server, shared in-memory state.
// Usage: npm run dev (port 3000), then npm run dev:web (port 3080).
import http from "node:http";
import net from "node:net";

const PORT = Number(process.env.WEB_PORT ?? 3080);
const TARGET_PORT = Number(process.env.TARGET_PORT ?? 3000);
const TARGET_HOST = process.env.TARGET_HOST ?? "127.0.0.1";

const server = http.createServer((req, res) => {
  const upstream = http.request(
    {
      host: TARGET_HOST,
      port: TARGET_PORT,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, "x-datadeck-variant": "web" },
    },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", (err) => {
    res.writeHead(502, { "content-type": "text/plain" });
    res.end(`Next server on :${TARGET_PORT} is not reachable (${err.code}). Run npm run dev first.`);
  });
  req.pipe(upstream);
});

// HMR websocket: pass the upgrade through untouched.
server.on("upgrade", (req, socket, head) => {
  const up = net.connect(TARGET_PORT, TARGET_HOST, () => {
    const headers = Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join("\r\n");
    up.write(`${req.method} ${req.url} HTTP/1.1\r\n${headers}\r\n\r\n`);
    up.write(head);
    up.pipe(socket).pipe(up);
  });
  up.on("error", () => socket.destroy());
  socket.on("error", () => up.destroy());
});

server.listen(PORT, () => {
  console.log(`Data Deck web: http://localhost:${PORT} -> :${TARGET_PORT} (portal at /)`);
});
