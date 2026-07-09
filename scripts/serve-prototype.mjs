import { createServer } from "node:http";
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../prototype/index.html", import.meta.url));
createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}).listen(8787, () => console.log("prototype on :8787"));
