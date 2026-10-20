# Feedback relay

`worker.js` is a Cloudflare Worker. The feedback form on the patch notes pages posts to it, and it forwards each
comment (and screenshot) to the `#feedback` channel in the RearGuard Discord.

- The Discord webhook address is stored as a Worker secret named `DISCORD_WEBHOOK`. It is never in this repo or the site.
- It only accepts posts from `https://razzit.github.io`, caps comments at 2,000 characters and screenshots at 8 MB
  (PNG, JPG, WebP, GIF), allows one post per sender every 30 seconds, and blocks pings (`@everyone` does nothing).

To update it: open the Worker in the Cloudflare dashboard, choose **Edit code**, paste `worker.js` and **Deploy**.
The form's address for the relay is `ENDPOINT` at the top of `assets/feedback.js`.
