// CORS-fixing proxy for the Otterly public API.
//
// Otterly returns Access-Control-Allow-Origin on the preflight but NOT on the
// actual response, so browsers block the payload. This function sits in front of
// data.otterly.ai, forwards the caller's request (including their Authorization
// header) unchanged, and re-emits the response WITH the CORS header.
//
// It only ever forwards to data.otterly.ai (hardcoded), and it adds no key of its
// own — a caller still needs a valid Otterly API key. So it is not an open relay.

const UPSTREAM = "https://data.otterly.ai";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type",
  "Access-Control-Max-Age": "86400",
};

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== "GET") {
    return json({ error: "Only GET is supported." }, 405);
  }

  const url = new URL(request.url);
  // Strip the leading /api that routed us here; forward the rest verbatim.
  const upstreamPath = url.pathname.replace(/^\/api/, "");
  if (!upstreamPath.startsWith("/v1/")) {
    return json({ error: "Only /v1/* paths are proxied." }, 400);
  }
  const target = UPSTREAM + upstreamPath + url.search;

  const auth = request.headers.get("authorization");
  let upstreamRes;
  try {
    upstreamRes = await fetch(target, {
      method: "GET",
      headers: { ...(auth ? { Authorization: auth } : {}), Accept: "application/json" },
    });
  } catch (err) {
    return json({ error: "Upstream request failed: " + err.message }, 502);
  }

  const body = await upstreamRes.text();
  return new Response(body, {
    status: upstreamRes.status,
    headers: {
      ...cors,
      "Content-Type": upstreamRes.headers.get("content-type") || "application/json",
    },
  });
};

export const config = { path: "/api/*" };

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
