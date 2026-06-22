--4afa6c28204c732a4b1ed059dd385bc02fe56f018aec5e73e7bebfea8176
Content-Disposition: form-data; name="index.js"

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var COMPLETE_MODELS = [
  "deepseek/deepseek-chat-v3-0324:free",
  "google/gemini-2.0-flash-exp:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "openai/gpt-oss-120b:free",
  "openrouter/free"
];
var STREAM_MODELS = [
  "deepseek/deepseek-chat-v3-0324:free",
  "google/gemini-2.0-flash-exp:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "openai/gpt-oss-120b:free",
  "openrouter/free"
];
var FIRST_TOKEN_MS = 8e3;
var NONSTREAM_MODEL_MS = 2e4;
var REFERER = "https://app.aligna11.com";
var TITLE = "ALIGNA11";
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
var json = /* @__PURE__ */ __name((data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json", ...CORS }
}), "json");
function orMessages(body) {
  return body.system ? [{ role: "system", content: body.system }, ...body.messages || []] : body.messages || [];
}
__name(orMessages, "orMessages");
function orHeaders(env) {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
    "HTTP-Referer": REFERER,
    "X-Title": TITLE
  };
}
__name(orHeaders, "orHeaders");
async function handleClaude(body, env) {
  for (const model of COMPLETE_MODELS) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), NONSTREAM_MODEL_MS);
    try {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: orHeaders(env),
        signal: ctl.signal,
        body: JSON.stringify({
          model,
          max_tokens: body.max_tokens || 4e3,
          reasoning: { exclude: true },
          messages: orMessages(body),
          temperature: body.temperature
        })
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error.message || "OpenRouter error");
      const text = data.choices?.[0]?.message?.content || "";
      if (!text) throw new Error("empty response");
      return json({ content: [{ type: "text", text }], model, usage: data.usage });
    } catch (e) {
      console.log(`claude: ${model} failed (${e.message}), trying next`);
    } finally {
      clearTimeout(timer);
    }
  }
  return json({ error: "All AI services unavailable. Please try again shortly." }, 503);
}
__name(handleClaude, "handleClaude");
function handleClaudeStream(body, env, ctx) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const pump = /* @__PURE__ */ __name(async () => {
    for (const model of STREAM_MODELS) {
      const ctl = new AbortController();
      let firstTokenTimer = setTimeout(() => ctl.abort(), FIRST_TOKEN_MS);
      try {
        const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: orHeaders(env),
          signal: ctl.signal,
          body: JSON.stringify({
            model,
            max_tokens: body.max_tokens || 4e3,
            reasoning: { exclude: true },
            stream: true,
            messages: orMessages(body)
          })
        });
        if (!upstream.ok || !upstream.body) {
          clearTimeout(firstTokenTimer);
          continue;
        }
        const reader = upstream.body.getReader();
        let buffer = "";
        let gotAny = false;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const j = JSON.parse(data);
              const delta = j.choices?.[0]?.delta?.content;
              if (delta) {
                if (!gotAny) {
                  clearTimeout(firstTokenTimer);
                  gotAny = true;
                }
                await writer.write(encoder.encode(delta));
              }
            } catch (e) {
            }
          }
        }
        clearTimeout(firstTokenTimer);
        if (gotAny) {
          await writer.close();
          return;
        }
      } catch (e) {
        clearTimeout(firstTokenTimer);
      }
    }
    try {
      await writer.close();
    } catch (e) {
    }
  }, "pump");
  ctx.waitUntil(pump());
  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
      ...CORS
    }
  });
}
__name(handleClaudeStream, "handleClaudeStream");
function mpStr(s) {
  const b = new TextEncoder().encode(s);
  let head;
  if (b.length <= 31) head = new Uint8Array([160 | b.length]);
  else if (b.length <= 255) head = new Uint8Array([217, b.length]);
  else head = new Uint8Array([218, b.length >> 8 & 255, b.length & 255]);
  const out = new Uint8Array(head.length + b.length);
  out.set(head);
  out.set(b, head.length);
  return out;
}
__name(mpStr, "mpStr");
var mpBool = /* @__PURE__ */ __name((v) => new Uint8Array([v ? 195 : 194]), "mpBool");
var mpInt8 = /* @__PURE__ */ __name((n) => new Uint8Array([204, n & 255]), "mpInt8");
var mpArr0 = /* @__PURE__ */ __name(() => new Uint8Array([144]), "mpArr0");
function buildFishPayload(text, modelId) {
  const fields = [
    ["text", mpStr(text)],
    ["chunk_length", mpInt8(200)],
    ["format", mpStr("mp3")],
    ["mp3_bitrate", mpInt8(128)],
    ["references", mpArr0()],
    ["reference_id", mpStr(modelId)],
    ["normalize", mpBool(true)],
    ["latency", mpStr("normal")],
    ["streaming", mpBool(false)]
  ];
  const parts = [new Uint8Array([128 | fields.length])];
  for (const [k, v] of fields) parts.push(mpStr(k), v);
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}
__name(buildFishPayload, "buildFishPayload");
async function handleFishTts(body, env) {
  const text = String(body.text || "").trim();
  const modelId = String(body.modelId || "9baa1352ca014e81999898e77de4533b");
  if (!text) return new Response("No text provided", { status: 400, headers: CORS });
  if (!env.FISH_API_KEY) return new Response("Voice service not configured", { status: 500, headers: CORS });
  const upstream = await fetch("https://api.fish.audio/v1/tts", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.FISH_API_KEY}`,
      "Content-Type": "application/msgpack"
    },
    body: buildFishPayload(text, modelId)
  });
  if (!upstream.ok) {
    const errText = await upstream.text();
    console.log("Fish Audio error:", upstream.status, errText.slice(0, 300));
    return new Response(`Voice service error: Fish Audio returned ${upstream.status}`, { status: 502, headers: CORS });
  }
  return new Response(upstream.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", ...CORS }
  });
}
__name(handleFishTts, "handleFishTts");
var EL_VOICE_ID = "E1ZjXjqM1u5ygLiSuhP0";
var EL_MODEL_ID = "eleven_turbo_v2_5";
async function handleElevenLabs(body, env) {
  const text = String(body.text || "").trim();
  if (!text) return new Response("No text provided", { status: 400, headers: CORS });
  if (!env.ELEVENLABS_API_KEY) return new Response("Voice service not configured", { status: 500, headers: CORS });
  const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": env.ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg"
    },
    body: JSON.stringify({
      text,
      model_id: EL_MODEL_ID,
      voice_settings: { stability: 0.72, similarity_boost: 0.8, style: 0.1, use_speaker_boost: true }
    })
  });
  if (!upstream.ok) {
    const errText = await upstream.text();
    console.log("ElevenLabs error:", upstream.status, errText.slice(0, 300));
    return new Response(`Voice error: ElevenLabs returned ${upstream.status}`, { status: 502, headers: CORS });
  }
  return new Response(upstream.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", ...CORS }
  });
}
__name(handleElevenLabs, "handleElevenLabs");
var GHL_LOCATION_ID = "FDVOhLpFdM5QPhVeD1sq";
var GHL_BASE = "https://services.leadconnectorhq.com";
async function ghlPost(env, path, body) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.GHL_API_TOKEN}`,
      "Content-Type": "application/json",
      "Version": "2021-07-28"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL ${path} returned ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}
__name(ghlPost, "ghlPost");
function welcomeEmail(firstName) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f4f4f6;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f6;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a1230;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.3);">
        <tr><td style="height:3px;background:linear-gradient(90deg,#c4a8d4,#f1b6c6,#ffffff,#f1b6c6,#c4a8d4);"></td></tr>
        <tr><td align="center" style="padding:48px 40px 32px;background:linear-gradient(160deg,#1a1230 0%,#2E1760 50%,#1a1230 100%);">
          <div style="font-family:'Georgia',serif;font-size:42px;font-weight:600;letter-spacing:12px;color:#ffffff;text-transform:uppercase;margin-bottom:4px;">ALIGNA</div>
          <div style="font-family:'Georgia',serif;font-size:80px;font-weight:600;line-height:0.85;letter-spacing:8px;color:#d8d0e8;margin-bottom:24px;">11</div>
          <div style="font-size:14px;color:rgba(244,244,246,0.7);font-style:italic;letter-spacing:2px;">Welcome To Your Moment In Time</div>
        </td></tr>
        <tr><td style="padding:40px 40px 32px;background:#2E1760;">
          <p style="font-family:'Georgia',serif;font-size:22px;color:#f4f4f6;margin:0 0 20px;line-height:1.4;">
            ${firstName}, you have arrived exactly when you were meant to.
          </p>
          <p style="font-size:16px;color:rgba(244,244,246,0.85);line-height:1.8;margin:0 0 18px;">
            Your 14 days inside ALIGNA11 begin right now. Sacred numerology intelligence, built around your name, your numbers, and your moment in time.
          </p>
          <p style="font-size:16px;color:rgba(244,244,246,0.85);line-height:1.8;margin:0 0 18px;">
            Every day you come to this app, you will receive something personal. Not general. Not vague. Yours. Built from the numbers that were woven into you before you took your first breath.
          </p>
          <p style="font-size:16px;color:rgba(244,244,246,0.85);line-height:1.8;margin:0 0 32px;">
            This is a gift from us to you. Not because it has no value. Because we believe every person deserves to understand the precision of the timing they were born into.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:8px 0 32px;">
              <a href="https://app.aligna11.com" style="display:inline-block;padding:16px 48px;background:linear-gradient(180deg,#f2f2f2 0%,#d4d4d4 20%,#e8e8e8 40%,#ffffff 50%,#c0c0c0 60%,#a8a8a8 80%,#d4d4d4 100%);border:2px solid #f1b6c6;border-radius:50px;font-family:'Georgia',serif;font-size:15px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#1a1230;text-decoration:none;">
                Open ALIGNA11
              </a>
            </td></tr>
          </table>
          <p style="font-size:14px;color:rgba(244,244,246,0.55);line-height:1.7;margin:0;border-top:1px solid rgba(244,244,246,0.1);padding-top:24px;font-style:italic;">
            "For I know the plans I have for you," declares the Lord, "plans to prosper you and not to harm you, plans to give you hope and a future." \u2014 Jeremiah 29:11
          </p>
        </td></tr>
        <tr><td style="padding:24px 40px;background:#1a1230;">
          <p style="font-size:13px;color:rgba(244,244,246,0.45);margin:0 0 8px;line-height:1.6;">
            With love and light,<br>
            <strong style="color:rgba(244,244,246,0.7);">The ALIGNA11 Team</strong>
          </p>
          <p style="font-size:11px;color:rgba(244,244,246,0.3);margin:0;font-style:italic;">
            "Gift someone kindness today \u2014 it costs you nothing but brings you harvests of light on the daily path of your life. Choose today to be kind." \u2014 Lizzy Morris
          </p>
        </td></tr>
        <tr><td style="height:3px;background:linear-gradient(90deg,#c4a8d4,#f1b6c6,#ffffff,#f1b6c6,#c4a8d4);"></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
__name(welcomeEmail, "welcomeEmail");
async function handleGhlRegister(body, env) {
  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  if (!firstName || !email) {
    return new Response("firstName and email required", { status: 400, headers: CORS });
  }
  try {
    const contactRes = await ghlPost(env, "/contacts/upsert", {
      locationId: GHL_LOCATION_ID,
      firstName,
      lastName,
      email,
      tags: ["aligna11-user", "aligna11-gift-register"],
      source: "Aligna11 App"
    });
    const contactId = contactRes.contact?.id || contactRes.id;
    if (!contactId) throw new Error("Contact creation returned no ID");
    await ghlPost(env, "/conversations/messages", {
      type: "Email",
      contactId,
      subject: "Welcome to ALIGNA11 \u2014 You Have Arrived Exactly When You Were Meant To",
      html: welcomeEmail(firstName)
    });
    return json({ success: true, contactId });
  } catch (err) {
    console.log("GHL registration error:", err.message);
    return json({ success: false, error: err.message });
  }
}
__name(handleGhlRegister, "handleGhlRegister");
var index_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response("", { status: 200, headers: CORS });
    }
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: CORS });
    }
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: "Invalid JSON" }, 400);
    }
    const path = new URL(request.url).pathname;
    switch (path) {
      case "/api/claude":
        return handleClaude(body, env);
      case "/api/claude-stream":
        return handleClaudeStream(body, env, ctx);
      case "/api/fish-tts":
        return handleFishTts(body, env);
      case "/api/elevenlabs-tts":
        return handleElevenLabs(body, env);
      case "/api/ghl-register":
        return handleGhlRegister(body, env);
      default:
        return new Response("Not found", { status: 404, headers: CORS });
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map

--4afa6c28204c732a4b1ed059dd385bc02fe56f018aec5e73e7bebfea8176--
