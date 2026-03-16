import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

const port = Number(process.env.PORT || 3000);
const indexPath = join(process.cwd(), "index.html");

createServer((req, res) => {
  if (!existsSync(indexPath)) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("frontend placeholder missing index.html");
    return;
  }

  if (req.url !== "/" && req.url !== "/index.html") {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  createReadStream(indexPath).pipe(res);
}).listen(port, "0.0.0.0", () => {
  console.log(`[frontend] listening on http://0.0.0.0:${port}`);
});
