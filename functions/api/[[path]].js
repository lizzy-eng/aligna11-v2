// Proxies /api/* to the ALIGNA11 engine worker (the Cloudflare "brain").
// Keeps the app same-origin so voice, AI, streaming and registration just work.
const ENGINE = "https://aligna11-engine.lizzy-64c.workers.dev";
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const target = ENGINE + url.pathname + url.search;
  const proxied = new Request(target, request);
  return fetch(proxied);
}
