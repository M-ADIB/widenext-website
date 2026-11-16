(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var hasIO = "IntersectionObserver" in window;

  /* Header turns solid after the first screen, the phone dock shows between hero and contact */
  var top = $("[data-top]"), dock = $("[data-dock]"), contact = $("#contact");
  var onScroll = function () {
    var y = scrollY;
    top.classList.toggle("is-solid", y > 40);
    if (dock) {
      var c = contact.getBoundingClientRect().top;
      dock.classList.toggle("is-on", y > innerHeight * 0.9 && c > innerHeight * 0.6);
    }
  };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* Full-screen menu on phones and tablets. A link closes the menu, then scrolls to its section. */
  var menu = $("[data-menu]"), menuOpen = $("[data-menu-open]");
  if (menu && menuOpen && menu.showModal) {
    menuOpen.addEventListener("click", function () {
      menu.showModal();
      document.body.classList.add("lock");
      menuOpen.setAttribute("aria-expanded", "true");
    });
    $("[data-menu-close]", menu).addEventListener("click", function () { menu.close(); });
    var unlock = function () {
      document.body.classList.remove("lock");
      menuOpen.setAttribute("aria-expanded", "false");
    };
    menu.addEventListener("close", unlock);
    $$("[data-menu-link]", menu).forEach(function (a) {
      a.addEventListener("click", function (e) {
        var hash = a.getAttribute("href"), target = $(hash);
        if (!target) return;
        e.preventDefault();
        unlock();
        menu.close();
        /* Scroll once the dialog has handed focus back to the header, so nothing cancels the scroll */
        setTimeout(function () {
          target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
          history.replaceState(null, "", hash);
        }, 30);
      });
    });
  }

  /* Loops only play while on screen, to save battery and data */
  var vids = $$("video[data-inview]");
  if (hasIO && !reduce) {
    var vio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { v.preload = "auto"; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      });
    }, { threshold: 0.35 });
    vids.forEach(function (v) { vio.observe(v); });
  } else {
    vids.forEach(function (v) { v.controls = true; });
  }

  /* Soft rise as blocks enter */
  if (hasIO && !reduce) {
    var rio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); rio.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    $$(".tile, .case, .steps li").forEach(function (el) { el.classList.add("rise"); rio.observe(el); });
  }

  /* Case cards open and close in place. A closed body is inert, so the keyboard skips what is hidden. */
  $$("[data-case]").forEach(function (c) {
    var btn = $(".case-btn", c), body = $(".case-body", c);
    var set = function (open) {
      c.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      body.inert = !open;
    };
    set(c.hasAttribute("data-open"));
    btn.addEventListener("click", function () { set(!c.classList.contains("is-open")); });
  });

  /* Sliders: arrows, a counter and a progress line under each rail, plus mouse drag on desktop */
  var arrow = function (d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>'; };
  $$(".rail").forEach(function (rail) {
    var items = $$("li", rail);
    var nav = document.createElement("div");
    nav.className = "slider-nav";
    nav.innerHTML = '<span class="slider-count" aria-live="polite"></span><span class="slider-bar" aria-hidden="true"><i></i></span>' +
      '<span class="slider-btns"><button type="button" aria-label="Previous">' + arrow("M15 18l-6-6 6-6") + '</button><button type="button" aria-label="Next">' + arrow("M9 18l6-6-6-6") + "</button></span>";
    rail.after(nav);
    var count = $(".slider-count", nav), bar = $(".slider-bar i", nav), btns = $$("button", nav);
    var pad = function () { return parseFloat(getComputedStyle(rail).paddingLeft) || 0; };
    var current = function () {
      var x = rail.scrollLeft + pad(), best = 0;
      items.forEach(function (li, i) { if (Math.abs(li.offsetLeft - x) < Math.abs(items[best].offsetLeft - x)) best = i; });
      return best;
    };
    var go = function (i) {
      i = Math.max(0, Math.min(items.length - 1, i));
      rail.scrollTo({ left: items[i].offsetLeft - pad(), behavior: reduce ? "auto" : "smooth" });
    };
    var update = function () {
      var max = rail.scrollWidth - rail.clientWidth, p = max > 0 ? rail.scrollLeft / max : 1;
      var atEnd = rail.scrollLeft >= max - 2, i = atEnd ? items.length - 1 : current();
      count.textContent = i + 1 + " / " + items.length;
      bar.style.transform = "scaleX(" + Math.max(1 / items.length, p) + ")";
      btns[0].disabled = rail.scrollLeft <= 2;
      btns[1].disabled = atEnd;
      nav.hidden = max <= 2;
    };
    btns[0].addEventListener("click", function () { go(current() - 1); });
    btns[1].addEventListener("click", function () { go(current() + 1); });
    rail.addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    rail.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); go(current() + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(current() - 1); }
    });
    var sx = null, sl = 0, moved = false;
    rail.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      sx = e.clientX; sl = rail.scrollLeft; moved = false;
    });
    addEventListener("pointermove", function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 4) { moved = true; rail.classList.add("is-drag"); }
      if (moved) rail.scrollLeft = sl - dx;
    });
    addEventListener("pointerup", function () {
      if (sx === null) return;
      sx = null;
      if (!moved) return;
      var i = current();
      rail.classList.remove("is-drag");
      go(i);
    });
    update();
  });

  /* Asir film player: two cuts. A cut plays only when its file path is set in data-src. */
  var player = $("[data-player]");
  if (player) {
    var tabs = $$("[data-cut]", player);
    var frames = $$("[data-cut-img]", player);
    frames.forEach(function (img) {
      var src = img.getAttribute("data-src");
      if (!src) return;
      var v = document.createElement("video");
      v.src = src; v.poster = img.src; v.controls = true; v.playsInline = true; v.preload = "none";
      v.setAttribute("data-cut-img", img.getAttribute("data-cut-img"));
      v.setAttribute("aria-label", img.alt);
      v.hidden = img.hidden;
      img.parentNode.replaceChild(v, img);
    });
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        var cut = t.getAttribute("data-cut");
        tabs.forEach(function (o) { o.setAttribute("aria-selected", o === t ? "true" : "false"); });
        $$("[data-cut-img]", player).forEach(function (f) {
          var on = f.getAttribute("data-cut-img") === cut;
          f.hidden = !on;
          if (!on && f.pause) f.pause();
        });
        $(".player-cap", player).textContent = cut === "intl" ? "International cut" : "Local cut";
      });
    });
  }

  /* Photo library lightbox, all 20 film stills */
  var lib = [
    ["assets/img/asir-film-01-c.webp", "Woman in an orange scarf"], ["assets/img/asir-film-02-b.webp", "Asir honey"], ["assets/img/asir-film-03-c.webp", "Man at a mud tower"], ["assets/img/asir-film-11-c.webp", "Men at a cafe"],
    ["assets/img/asir-film-15-b.webp", "Woman with binoculars"], ["assets/img/asir-film-18-c.webp", "Hikers celebrating on a ridge"], ["assets/img/asir-film-01-a.webp", "Weaver under a tree"], ["assets/img/asir-film-03-b.webp", "Mud tower"],
    ["assets/img/asir-film-05-a.webp", "Hikers on a trail"], ["assets/img/asir-film-05-c.webp", "Mountain road"], ["assets/img/asir-film-06-a.webp", "Light rays in a house"], ["assets/img/asir-film-06-c.webp", "Hikers on a ridge"],
    ["assets/img/asir-film-07-c.webp", "Winding mountain road"], ["assets/img/asir-film-09-c.webp", "Woman in a painted room"], ["assets/img/asir-film-12-b.webp", "Woman in the market"], ["assets/img/asir-film-12-c.webp", "Hot air balloon"],
    ["assets/img/asir-film-14-a.webp", "Dancers"], ["assets/img/asir-film-16-b.webp", "Man with a stick in blue mist"], ["assets/img/asir-film-17-c.webp", "Jeep at sunset"], ["assets/img/asir-film-15-c.webp", "Photographer at work"]
  ];
  var lb = $("[data-lightbox]"), idx = 0, opener = null;
  var show = function (i) {
    idx = (i + lib.length) % lib.length;
    var img = $("[data-lb-img]", lb);
    img.src = lib[idx][0];
    img.alt = lib[idx][1] + ", Asir";
    $("[data-lb-cap]", lb).textContent = lib[idx][1];
    $("[data-lb-count]", lb).textContent = idx + 1 + " of " + lib.length;
  };
  if (lb) {
    $$("[data-lib-open]").forEach(function (b) {
      b.addEventListener("click", function () {
        opener = b; show(Number(b.getAttribute("data-lib-open")));
        if (lb.showModal) lb.showModal(); else lb.setAttribute("open", "");
        document.body.classList.add("lock");
      });
    });
    $$("[data-lb-step]", lb).forEach(function (b) { b.addEventListener("click", function () { show(idx + Number(b.getAttribute("data-lb-step"))); }); });
    $("[data-lb-close]", lb).addEventListener("click", function () { lb.close(); });
    lb.addEventListener("close", function () { document.body.classList.remove("lock"); if (opener) setTimeout(function () { opener.focus(); }, 0); });
    lb.addEventListener("keydown", function (e) { if (e.key === "ArrowRight") show(idx + 1); if (e.key === "ArrowLeft") show(idx - 1); });
    var sx = null;
    lb.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) show(idx + (dx < 0 ? 1 : -1));
      sx = null;
    });
  }
})();
