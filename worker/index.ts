interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

function parseRange(header: string, size: number): [number, number] | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) return null;
  const start = match[1] === "" ? Math.max(0, size - Number(match[2])) : Number(match[1]);
  const end = match[1] === "" || match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  return start <= end && start < size ? [start, end] : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    headers.set("Accept-Ranges", "bytes");
    const range = request.headers.get("Range");
    if (asset.status !== 200 || !range) {
      return new Response(asset.body, { status: asset.status, headers });
    }
    const body = await asset.arrayBuffer();
    const bounds = parseRange(range, body.byteLength);
    if (!bounds) {
      headers.set("Content-Range", `bytes */${body.byteLength}`);
      return new Response(null, { status: 416, headers });
    }
    const [start, end] = bounds;
    headers.set("Content-Range", `bytes ${start}-${end}/${body.byteLength}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(body.slice(start, end + 1), { status: 206, headers });
  },
};
