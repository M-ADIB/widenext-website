(function () {
  /* Settings. Fill these on launch. */
  // CONFIRM BEFORE LAUNCH: Widenext's Calendly event link, e.g. "https://calendly.com/widenext/30min". Empty means step 4 offers WhatsApp.
  var CALENDLY_URL = "";
  // CONFIRM BEFORE LAUNCH: where leads go (a form backend or a server function). Empty means nothing is sent. Never put a secret key here, this file is public.
  var LEAD_ENDPOINT = "";
  // CONFIRM BEFORE LAUNCH: budget answers that skip the calendar and land on "Application received".
  var DISQUALIFY = ["Under SAR 100K"];
  var WHATSAPP = "966565500009";
  var DRAFT_KEY = "wn_apply_draft", DRAFT_TTL = 24 * 60 * 60 * 1000;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var form = $("[data-apply]");
  if (!form) return;

  var panels = $$("[data-panel]", form), labels = $$("[data-step-label]");
  var prev = $("[data-prev]", form), next = $("[data-next]", form), nextLabel = $("[data-next-label]", form);
  var alertBox = $("[data-alert]", form), actions = $("[data-actions]", form);
  var step = 1, sending = false, submitted = false;

  var NAME = /^(?=.*\p{L})[\p{L}\p{M}][\p{L}\p{M}\s'’.-]{1,}$/u;
  var EMAIL = /^[^\s@.]+(\.[^\s@.]+)*@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;
  var cleanPhone = function (v) { return v.replace(/[\s().-]/g, ""); };

  var checks = {
    name: function (v) { return NAME.test(v.trim()) ? "" : "Use at least two letters."; },
    email: function (v) { return EMAIL.test(v.trim()) ? "" : "Enter an email like name@company.com."; },
    phone: function (v) {
      var p = cleanPhone(v);
      if (p.charAt(0) !== "+") return "Start with your country code, like +966 50 123 4567.";
      return /^\+\d{8,15}$/.test(p) ? "" : "That number looks too short or too long.";
    },
    text: function (v) { return v.trim().length >= 2 ? "" : "Add at least two characters."; },
    brief: function (v) { return v.trim().length >= 10 ? "" : "Add a sentence or two so we can prepare."; }
  };

  var setErr = function (el, msg) {
    var err = $("#" + el.id + "-err");
    if (err) err.textContent = msg;
    if (msg) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid");
  };
  var groupVal = function (name) {
    return $$('[name="' + name + '"]:checked', form).map(function (i) { return i.value; });
  };
  var setGroupErr = function (fs, msg) {
    $("#q-" + fs.getAttribute("data-group") + "-err").textContent = msg;
    if (msg) fs.setAttribute("data-invalid", ""); else fs.removeAttribute("data-invalid");
  };

  var validate = function (n) {
    var panel = panels[n - 1], first = null;
    $$("[data-check]", panel).forEach(function (el) {
      var msg = el.value.trim() && el.value.trim() !== "+966" ? checks[el.getAttribute("data-check")](el.value) : "This one is required.";
      setErr(el, msg);
      if (msg && !first) first = el;
    });
    $$("[data-group]", panel).forEach(function (fs) {
      var msg = groupVal(fs.getAttribute("data-group")).length ? "" : "Pick one to continue.";
      setGroupErr(fs, msg);
      if (msg && !first) first = $("input", fs);
    });
    if (!first && n === 3 && groupVal("show_up")[0] === "No") {
      var fs = $('[data-group="show_up"]', panel);
      setGroupErr(fs, "We hold each slot for you, so please only book if you'll tell us when plans change.");
      first = $("input", fs);
    }
    if (first) first.focus();
    return !first;
  };

  /* Errors clear as soon as the visitor fixes the field */
  form.addEventListener("input", function (e) {
    var el = e.target;
    if (el.hasAttribute("data-check") && el.getAttribute("aria-invalid")) setErr(el, checks[el.getAttribute("data-check")](el.value));
    var fs = el.closest("[data-group]");
    if (fs) setGroupErr(fs, "");
    alertBox.hidden = true;
    save();
  });

  var data = function () {
    var d = {};
    $$("input, textarea", form).forEach(function (el) {
      if (!el.name) return;
      if (el.type === "radio" || el.type === "checkbox") { if (el.checked) d[el.name] = el.type === "checkbox" ? (d[el.name] || []).concat(el.value) : el.value; }
      else d[el.name] = el.value.trim();
    });
    d.email = (d.email || "").toLowerCase();
    d.phone = cleanPhone(d.phone || "");
    return d;
  };

  /* Draft: answers survive a reload for 24 hours. Storage can be blocked, so every call is guarded. */
  var save = function () {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), step: step, submitted: submitted, d: data() })); } catch (e) {}
  };
  var clearDraft = function () { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} };
  var restore = function () {
    var raw;
    try { raw = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (e) { raw = null; }
    if (!raw || Date.now() - raw.at > DRAFT_TTL) { clearDraft(); return; }
    Object.keys(raw.d || {}).forEach(function (k) {
      var v = raw.d[k];
      $$('[name="' + k + '"]', form).forEach(function (el) {
        if (el.type === "radio" || el.type === "checkbox") el.checked = [].concat(v).indexOf(el.value) > -1;
        else if (v) el.value = v;
      });
    });
    submitted = !!raw.submitted;
    if (raw.step > 1) go(submitted ? 4 : Math.min(raw.step, 3), true);
  };

  var calStarted = false;
  var go = function (n, quiet) {
    step = n;
    panels.forEach(function (p, i) { p.hidden = i !== n - 1; });
    labels.forEach(function (l, i) {
      l.classList.toggle("is-done", i < n - 1);
      if (i === n - 1) l.setAttribute("aria-current", "step"); else l.removeAttribute("aria-current");
    });
    $("[data-bar]").style.width = n * 25 + "%";
    $("[data-stepcount]").textContent = "Step " + n + " of 4";
    prev.hidden = n === 1 || n === 4;
    actions.hidden = n === 4;
    nextLabel.textContent = n === 3 ? "Next: book a call" : "Continue";
    if (n === 4) startCalendar();
    if (!quiet) {
      $(".fp-card").scrollIntoView({ block: "start" });
      $(".fp-h", panels[n - 1]).focus({ preventScroll: true });
    }
    save();
  };

  var end = function (kind) {
    var d = data();
    clearDraft();
    form.hidden = true;
    $(".fp-steps").hidden = true;
    $(".fp-bar").hidden = true;
    $("[data-stepcount]").hidden = true;
    var box = $('[data-end="' + kind + '"]');
    $$("[data-first]", box).forEach(function (s) { s.textContent = d.first_name || "there"; });
    box.hidden = false;
    box.focus();
  };

  /* The lead is saved before the calendar shows, so it is kept even if the visitor never books */
  var send = function (d) {
    if (!LEAD_ENDPOINT) return Promise.resolve();
    return fetch(LEAD_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); });
  };

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (step < 3) { if (validate(step)) go(step + 1); return; }
    if (step !== 3 || sending || !validate(3)) return;
    var d = data();
    d.qualified = DISQUALIFY.indexOf(d.budget) === -1;
    d.page = location.href;
    sending = true;
    next.disabled = true;
    nextLabel.textContent = "Saving…";
    send(d).then(function () {
      submitted = true;
      if (d.qualified) go(4); else end("received");
    }).catch(function () {
      alertBox.textContent = "We couldn't save your answers. Check your connection and try again.";
      alertBox.hidden = false;
      nextLabel.textContent = "Next: book a call";
    }).then(function () { sending = false; next.disabled = false; });
  });
  prev.addEventListener("click", function () { if (step > 1) go(step - 1); });

  /* Step 4: Calendly inline, prefilled with name and email. Falls back to WhatsApp until a link is set. */
  var startCalendar = function () {
    if (calStarted) return;
    calStarted = true;
    var d = data(), cal = $("[data-cal]");
    if (!CALENDLY_URL) {
      cal.hidden = true;
      $(".fp-sub", panels[3]).textContent = "Your answers are saved. Send us a WhatsApp message and we'll agree a time for the call.";
      var msg = "Hi Widenext, I'm " + (d.first_name + " " + d.last_name).trim() + " from " + (d.company || "my company") + ". I just filled in the project form and would like to book a call.";
      $("[data-wa]").href = "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(msg);
      $("[data-nocal]").hidden = false;
      return;
    }
    var q = new URLSearchParams(location.search), p = new URLSearchParams();
    p.set("name", (d.first_name + " " + d.last_name).trim());
    p.set("email", d.email);
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach(function (k) { if (q.get(k)) p.set(k, q.get(k)); });
    var plain = CALENDLY_URL + (CALENDLY_URL.indexOf("?") > -1 ? "&" : "?") + p.toString();
    p.set("embed_domain", location.hostname);
    p.set("embed_type", "Inline");
    p.set("hide_gdpr_banner", "1");
    var frame = document.createElement("iframe");
    frame.src = CALENDLY_URL + (CALENDLY_URL.indexOf("?") > -1 ? "&" : "?") + p.toString();
    frame.title = "Book a call with Widenext";
    cal.appendChild(frame);
    $("[data-cal-open]").href = plain;
    var heard = false;
    var slow = setTimeout(function () { if (!heard) $("[data-cal-slow]").hidden = false; }, 7000);
    addEventListener("message", function (e) {
      if (e.origin !== "https://calendly.com" || !e.data || typeof e.data.event !== "string") return;
      if (!heard) { heard = true; clearTimeout(slow); $("[data-cal-loading]").hidden = true; }
      if (e.data.event === "calendly.page_height" && e.data.payload && e.data.payload.height) frame.style.height = parseInt(e.data.payload.height, 10) + "px";
      if (e.data.event === "calendly.event_scheduled") setTimeout(function () { end("booked"); }, 1200);
    });
  };

  restore();
})();
