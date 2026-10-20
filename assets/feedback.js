// Feedback form: sends a comment and an optional screenshot to the RearGuard Discord through the relay.
(function () {
  // The deployed relay's address (a Cloudflare Worker). Empty until it's set up; the form says so.
  var ENDPOINT = "https://rearguard-feedback.brenton-kelly.workers.dev/";
  var MAX_IMAGE = 8 * 1024 * 1024;
  var TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

  var jump = document.getElementById("nav-jump");
  if (jump) jump.addEventListener("change", function () {
    var target = jump.value && document.getElementById(jump.value);
    if (target) target.scrollIntoView();
    jump.value = "";
  });

  var form = document.getElementById("feedback-form");
  if (!form) return;
  var status = document.getElementById("fb-status");
  var send = document.getElementById("fb-send");
  var fileInput = document.getElementById("fb-image");
  var drop = document.getElementById("fb-drop");
  var preview = document.getElementById("fb-preview");
  var previewImg = document.getElementById("fb-preview-img");
  var previewName = document.getElementById("fb-preview-name");
  var remove = document.getElementById("fb-remove");
  var comment = document.getElementById("fb-comment");
  var count = document.getElementById("fb-count");
  var image = null;

  function say(text, kind) { status.textContent = text; status.dataset.kind = kind || ""; }

  if (!ENDPOINT) {
    send.disabled = true;
    say("The feedback form opens soon. Until then, post in the RearGuard Discord.", "info");
  }

  comment.addEventListener("input", function () { count.textContent = comment.value.length + " / 2000"; });

  function setImage(file) {
    if (!file) return;
    if (TYPES.indexOf(file.type) < 0) { say("Screenshots need to be PNG, JPG, WebP or GIF.", "error"); return; }
    if (file.size > MAX_IMAGE) { say("That screenshot is over 8 MB. Try a smaller one.", "error"); return; }
    image = file;
    if (previewImg.src) URL.revokeObjectURL(previewImg.src);
    previewImg.src = URL.createObjectURL(file);
    previewName.textContent = file.name || "Pasted screenshot";
    preview.hidden = false;
    drop.hidden = true;
    say("", "");
  }
  function clearImage() {
    image = null;
    fileInput.value = "";
    if (previewImg.src) URL.revokeObjectURL(previewImg.src);
    previewImg.removeAttribute("src");
    preview.hidden = true;
    drop.hidden = false;
  }

  fileInput.addEventListener("change", function () { setImage(fileInput.files[0]); });
  remove.addEventListener("click", clearImage);
  ["dragenter", "dragover"].forEach(function (t) {
    drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add("over"); });
  });
  ["dragleave", "drop"].forEach(function (t) {
    drop.addEventListener(t, function () { drop.classList.remove("over"); });
  });
  drop.addEventListener("drop", function (e) {
    e.preventDefault();
    if (e.dataTransfer.files.length) setImage(e.dataTransfer.files[0]);
  });
  form.addEventListener("paste", function (e) {
    var items = (e.clipboardData || {}).items || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].kind === "file" && items[i].type.indexOf("image/") === 0) { setImage(items[i].getAsFile()); e.preventDefault(); return; }
    }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!ENDPOINT) return;
    if (!comment.value.trim()) { say("Write a comment before sending.", "error"); comment.focus(); return; }
    var data = new FormData(form);
    data.delete("image");
    if (image) data.append("image", image, image.name || "screenshot.png");
    send.disabled = true;
    say("Sending…", "info");
    fetch(ENDPOINT, { method: "POST", body: data })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok, body: b }; }); })
      .then(function (res) {
        if (res.ok) {
          form.reset(); clearImage(); count.textContent = "0 / 2000";
          say("Sent. Thanks, it's in the RearGuard Discord now.", "ok");
        } else {
          say(res.body.error || "That didn't send. Try again in a minute.", "error");
        }
      })
      .catch(function () { say("That didn't send. Check your connection and try again.", "error"); })
      .then(function () { send.disabled = false; });
  });
})();
