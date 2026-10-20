// RearGuard feedback relay (Cloudflare Worker).
// Takes the feedback form from the patch notes site and posts it to the #feedback channel on Discord.
// The Discord webhook address is kept as a Worker secret named DISCORD_WEBHOOK, never in this file or the site.

const ALLOWED_ORIGINS = ["https://razzit.github.io"];
const MAX_COMMENT = 2000;            // characters
const MAX_IMAGE = 8 * 1024 * 1024;   // bytes
const COOLDOWN_SECONDS = 30;         // per sender, between posts
const IMAGE_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };
    const reply = (status, body) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return reply(405, { error: "Send feedback with the form on the patch notes page." });
    if (!allowed) return reply(403, { error: "Feedback can only be sent from the RearGuard patch notes site." });
    if (!env.DISCORD_WEBHOOK) return reply(500, { error: "The feedback channel isn't connected yet." });

    // One post per sender every COOLDOWN_SECONDS (kept in this data centre's cache).
    const sender = request.headers.get("CF-Connecting-IP") || "unknown";
    const cooldownKey = new Request("https://cooldown.rearguard/" + encodeURIComponent(sender));
    const cache = caches.default;
    if (await cache.match(cooldownKey)) {
      return reply(429, { error: "You just sent feedback. Wait half a minute before sending more." });
    }

    let form;
    try { form = await request.formData(); }
    catch { return reply(400, { error: "That didn't come through as a form. Reload the page and try again." }); }

    // Bots fill in the hidden "website" field; people never see it.
    if (String(form.get("website") || "").trim()) return reply(200, { ok: true });

    const comment = String(form.get("comment") || "").trim();
    if (!comment) return reply(400, { error: "Write a comment before sending." });
    if (comment.length > MAX_COMMENT) return reply(400, { error: `Keep your comment under ${MAX_COMMENT} characters.` });
    const name = String(form.get("name") || "").trim().slice(0, 40) || "Anonymous tester";
    const build = String(form.get("build") || "").trim().slice(0, 40) || "Unknown build";

    const payload = {
      username: "RearGuard Feedback",
      allowed_mentions: { parse: [] },
      embeds: [{
        title: `${build} feedback`,
        description: comment,
        color: 0xA7B46C,
        author: { name },
        timestamp: new Date().toISOString(),
      }],
    };
    const out = new FormData();

    const image = form.get("image");
    if (image && typeof image === "object" && image.size > 0) {
      if (image.size > MAX_IMAGE) return reply(413, { error: "That screenshot is over 8 MB. Try a smaller one." });
      const ext = IMAGE_TYPES[image.type];
      if (!ext) return reply(415, { error: "Screenshots need to be PNG, JPG, WebP or GIF." });
      const filename = `screenshot.${ext}`;
      payload.embeds[0].image = { url: `attachment://${filename}` };
      out.append("files[0]", image, filename);
    }
    out.append("payload_json", JSON.stringify(payload));

    const sent = await fetch(env.DISCORD_WEBHOOK, { method: "POST", body: out });
    if (!sent.ok) return reply(502, { error: "Discord didn't accept that. Try again in a minute." });

    ctx.waitUntil(cache.put(cooldownKey, new Response("1", { headers: { "Cache-Control": `max-age=${COOLDOWN_SECONDS}` } })));
    return reply(200, { ok: true });
  },
};
