/* POP Chat · interaction
 *
 * Motion budget (Lumen Day Foundry — no perpetual loops):
 *   1. hero entrance      — mark / title / lede / actions stagger, CSS on load
 *   2. verb landmark      — 1px underline draw-in, 320ms, once
 *   3. scroll reveal      — IntersectionObserver, staggered via --i
 *   4. apparatus sequence — one-shot: pulse travels, lands, blocked node acks
 *   5. hover states       — card lift + one-shot sheen, nav underline, spec row
 *   6. theme toggle       — smooth color transitions with localStorage persistence
 *   7. loader             — skeleton screen with shimmer, fades on load
 */

(function () {
  "use strict";

  // Flip off the no-js guard immediately: the reveal observers below are
  // what make content visible, and CSS has a failsafe if they stall.
  document.documentElement.classList.remove("no-js");
  document.documentElement.classList.add("js");

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ─── Theme Toggle · light/dark with localStorage ────────── */
  var themeToggle = document.getElementById("themeToggle");
  var themeToggleSheet = document.getElementById("themeToggleSheet");
  var htmlEl = document.documentElement;

  function getStoredTheme() {
    try {
      return localStorage.getItem("theme");
    } catch (e) {
      return null;
    }
  }

  function setStoredTheme(theme) {
    try {
      localStorage.setItem("theme", theme);
    } catch (e) {
      /* ignore */
    }
  }

  function getPreferredTheme() {
    var stored = getStoredTheme();
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function updateToggleLabels(theme) {
    var label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
    var labelText = theme === "dark" ? "Light mode" : "Dark mode";
    if (themeToggle) {
      themeToggle.setAttribute("aria-label", label);
    }
    if (themeToggleSheet) {
      if (themeToggleSheet.getAttribute("aria-label") !== label) {
        themeToggleSheet.setAttribute("aria-label", label);
      }
      var labelEl = themeToggleSheet.querySelector(".theme-toggle__label");
      // Guard the write: assigning textContent replaces the text node even
      // when unchanged, which re-triggers the body MutationObserver below
      // and spins the main thread in an endless microtask loop.
      if (labelEl && labelEl.textContent !== labelText) {
        labelEl.textContent = labelText;
      }
    }
  }

  function applyTheme(theme, skipTransition) {
    if (skipTransition) {
      htmlEl.setAttribute("data-theme-transitioning", "");
    }
    htmlEl.setAttribute("data-theme", theme);
    updateToggleLabels(theme);
    // Force reflow to ensure transitioning attribute takes effect
    if (skipTransition) {
      htmlEl.offsetHeight; // eslint-disable-line no-unused-expressions
      htmlEl.removeAttribute("data-theme-transitioning");
    }
    setStoredTheme(theme);
  }

  function initTheme() {
    var theme = getPreferredTheme();
    applyTheme(theme, true); // skip transition on initial load
  }

  function onThemeToggleClick() {
    var current = htmlEl.getAttribute("data-theme") || "light";
    var next = current === "dark" ? "light" : "dark";
    applyTheme(next, false);
  }

  function bindThemeToggles() {
    themeToggle = document.getElementById("themeToggle");
    themeToggleSheet = document.getElementById("themeToggleSheet");

    if (themeToggle && !themeToggle._bound) {
      themeToggle.addEventListener("click", onThemeToggleClick);
      themeToggle._bound = true;
    }
    if (themeToggleSheet && !themeToggleSheet._bound) {
      themeToggleSheet.addEventListener("click", onThemeToggleClick);
      themeToggleSheet._bound = true;
    }
    // Update labels after binding
    var currentTheme = htmlEl.getAttribute("data-theme") || "light";
    updateToggleLabels(currentTheme);
  }

  // Initial bind
  bindThemeToggles();

  // Re-bind if the toggles are added later. Restricted to the header/sheet
  // subtree: observing all of <body> means every DOM change anywhere on the
  // page re-runs bindThemeToggles, which is both wasteful and a re-entrancy
  // hazard (its own label writes would retrigger this observer).
  if ("MutationObserver" in window) {
    var mo = new MutationObserver(function () {
      bindThemeToggles();
    });
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributeFilter: ["id"]
    });
  }

  // Listen for system theme changes (only if user hasn't set a preference)
  try {
    var mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    var hasStored = !!getStoredTheme();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", function (e) {
        if (!hasStored && !getStoredTheme()) {
          applyTheme(e.matches ? "dark" : "light", false);
        }
      });
    }
  } catch (e) {
    /* ignore */
  }

  /* ─── Smooth scroll · Lenis ────────────────────────────
   * Progressive enhancement: if lenis.min.js failed to load, or the user
   * prefers reduced motion, everything below falls back to native scrolling.
   * Nothing else in this file depends on lenis existing.
   */
  var lenis = null;

  function initSmoothScroll() {
    // Lenis owns the easing curve, so native smooth must stay off while it
    // runs. If it never loads (blocked script, offline cache) we fall back to
    // the browser's own smooth scrolling rather than shipping hard jumps.
    if (reduced.matches) return;

    if (typeof window.Lenis !== "function") {
      document.documentElement.classList.add("no-lenis");
      return;
    }

    lenis = new window.Lenis({
      duration: 1.1,
      // Exponential ease-out, the curve lenis recommends for page scrolling.
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      // Native momentum on touch already feels right and lerping it feels laggy.
      syncTouch: false,
      touchMultiplier: 1.6
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Route in-page anchors through lenis so they get the same easing,
    // and clear the native scroll-padding which lenis bypasses.
    document.addEventListener("click", function (e) {
      var link = e.target.closest && e.target.closest('a[href^="#"]');
      if (!link) return;
      var hash = link.getAttribute("href");
      if (!hash || hash === "#" || link.hasAttribute("data-no-lenis")) return;
      var target = document.querySelector(hash);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -(bannerHeight() + 24) });
      if (history.replaceState) history.replaceState(null, "", hash);
    });
  }

  /* Offset for anchor jumps so the target clears the fixed nav.
     Measured from the nav element, not the --banner-height custom property:
     that value is declared in rem and parseFloat("4.5rem") yields 4.5, not
     the 72px actually occupied. */
  function bannerHeight() {
    var navEl = document.getElementById("nav");
    if (navEl) {
      var h = navEl.getBoundingClientRect().height;
      if (h > 0) return h;
    }
    // Fallback: convert the rem token using the root font size.
    var token = getComputedStyle(document.documentElement)
      .getPropertyValue("--banner-height").trim();
    var rem = parseFloat(token);
    var rootPx = parseFloat(
      getComputedStyle(document.documentElement).fontSize
    ) || 16;
    if (!isNaN(rem)) return rem * rootPx;
    return 64;
  }

  /* ─── Nav · scrolled state + scroll progress ───────────── */
  var nav = document.getElementById("nav");
  var progress = document.getElementById("navProgress");
  var pbEdge = document.querySelector(".pb-edge");
  var ticking = false;

  // Progressive blur ramp: 0 until the nav is pinned, then eases to 1 over
  // the first ~120px. Past 1 there is nothing left to change, so we stop
  // writing the property and let the scrim sit at its final blur.
  var PB_RANGE = 120;
  function syncProgressiveBlur() {
    if (!pbEdge) return;
    var y = window.scrollY;
    if (y <= 0) {
      pbEdge.style.setProperty("--pb-p", "0");
      return;
    }
    var p = Math.min(y / PB_RANGE, 1);
    // ease-out so the blur arrives quickly but settles softly
    p = 1 - Math.pow(1 - p, 3);
    pbEdge.style.setProperty("--pb-p", p.toFixed(3));
  }

  function syncScroll() {
    ticking = false;

    if (nav) {
      nav.classList.toggle("is-scrolled", window.scrollY > 8);
    }

    if (progress) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
      progress.style.setProperty("--progress", ratio.toFixed(4));
    }

    syncProgressiveBlur();
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(syncScroll);
  }

  /* ─── Mobile sheet ─────────────────────────────────────── */
  var toggle = document.getElementById("navToggle");
  var sheet = document.getElementById("sheet");
  var sheetOpen = false;
  var closeTimer = null;

  function openSheet() {
    if (!sheet || !toggle || sheetOpen) return;
    clearTimeout(closeTimer);
    sheetOpen = true;
    sheet.hidden = false;
    // next frame so the transition has a start value to move from
    window.requestAnimationFrame(function () {
      sheet.classList.add("is-open");
    });
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
  }

  function closeSheet() {
    if (!sheet || !toggle || !sheetOpen) return;
    sheetOpen = false;
    sheet.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    closeTimer = setTimeout(function () {
      if (!sheetOpen) sheet.hidden = true;
    }, 460);
  }

  if (toggle && sheet) {
    toggle.addEventListener("click", function () {
      if (sheetOpen) closeSheet(); else openSheet();
    });

    sheet.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeSheet();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || !sheetOpen) return;
      closeSheet();
      toggle.focus();
    });

    document.addEventListener("click", function (e) {
      if (!sheetOpen) return;
      if (sheet.contains(e.target) || toggle.contains(e.target)) return;
      closeSheet();
    });

    // a resize past the desktop breakpoint hides the toggle, so the sheet must go
    var wide = window.matchMedia("(min-width: 62rem)");
    var onWide = function (e) { if (e.matches) closeSheet(); };
    if (wide.addEventListener) wide.addEventListener("change", onWide);
    else if (wide.addListener) wide.addListener(onWide);
  }

  /* ─── Reveal on enter · Scroll-locked animations ─────────── */
  var revealTargets = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  var revealGroupTargets = Array.prototype.slice.call(document.querySelectorAll(".reveal-group"));
  var revealSlideLeftTargets = Array.prototype.slice.call(document.querySelectorAll(".reveal-slide-left"));
  var revealSlideRightTargets = Array.prototype.slice.call(document.querySelectorAll(".reveal-slide-right"));
  var revealScaleTargets = Array.prototype.slice.call(document.querySelectorAll(".reveal-scale"));
  var revealParallaxTargets = Array.prototype.slice.call(document.querySelectorAll(".reveal-parallax"));
  var revealLinesTargets = Array.prototype.slice.call(document.querySelectorAll(".reveal-lines"));
  var revealBlurTargets = Array.prototype.slice.call(document.querySelectorAll(".reveal-blur"));
  var revealRotateTargets = Array.prototype.slice.call(document.querySelectorAll(".reveal-rotate"));
  var revealClipTargets = Array.prototype.slice.call(document.querySelectorAll(".reveal-clip"));
  var revealStackTargets = Array.prototype.slice.call(document.querySelectorAll(".reveal-stack"));
  var revealLettersTargets = Array.prototype.slice.call(document.querySelectorAll(".reveal-letters"));

  function showAll() {
    revealTargets.forEach(function (el) { el.classList.add("is-in"); });
    revealGroupTargets.forEach(function (el) { el.classList.add("is-in"); });
    revealSlideLeftTargets.forEach(function (el) { el.classList.add("is-in"); });
    revealSlideRightTargets.forEach(function (el) { el.classList.add("is-in"); });
    revealScaleTargets.forEach(function (el) { el.classList.add("is-in"); });
    revealParallaxTargets.forEach(function (el) { el.classList.add("is-in"); });
    revealLinesTargets.forEach(function (el) { el.classList.add("is-in"); });
    revealBlurTargets.forEach(function (el) { el.classList.add("is-in"); });
    revealRotateTargets.forEach(function (el) { el.classList.add("is-in"); });
    revealClipTargets.forEach(function (el) { el.classList.add("is-in"); });
    revealStackTargets.forEach(function (el) { el.classList.add("is-in"); });
    revealLettersTargets.forEach(function (el) { el.classList.add("is-in"); });
  }

  function initReveal() {
    if (reduced.matches || !("IntersectionObserver" in window)) {
      showAll();
      return;
    }

    // Standard reveal - triggers when element enters viewport
    var ioReveal = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          ioReveal.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -15% 0px", threshold: 0.1 }
    );

    // Reveal group - for staggered children
    var ioGroup = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          ioGroup.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -20% 0px", threshold: 0.05 }
    );

    // Slide left/right - slightly earlier trigger
    var ioSlide = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          ioSlide.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    );

    // Scale - triggers a bit earlier for pop effect
    var ioScale = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          ioScale.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -5% 0px", threshold: 0.15 }
    );

    // Parallax - for hero elements, triggers earlier
    var ioParallax = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          ioParallax.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px 0% 0px", threshold: 0 }
    );

    // Lines - for text line-by-line
    var ioLines = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          ioLines.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -15% 0px", threshold: 0.1 }
    );

    // Blur, rotate, clip, stack, letters
    var ioBlur = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          ioBlur.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -15% 0px", threshold: 0.1 }
    );

    var ioRotate = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          ioRotate.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    );

    var ioClip = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          ioClip.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -5% 0px", threshold: 0.15 }
    );

    var ioStack = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          ioStack.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -20% 0px", threshold: 0.05 }
    );

    var ioLetters = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          ioLetters.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    );

    revealTargets.forEach(function (el) { ioReveal.observe(el); });
    revealGroupTargets.forEach(function (el) { ioGroup.observe(el); });
    revealSlideLeftTargets.forEach(function (el) { ioSlide.observe(el); });
    revealSlideRightTargets.forEach(function (el) { ioSlide.observe(el); });
    revealScaleTargets.forEach(function (el) { ioScale.observe(el); });
    revealParallaxTargets.forEach(function (el) { ioParallax.observe(el); });
    revealLinesTargets.forEach(function (el) { ioLines.observe(el); });
    revealBlurTargets.forEach(function (el) { ioBlur.observe(el); });
    revealRotateTargets.forEach(function (el) { ioRotate.observe(el); });
    revealClipTargets.forEach(function (el) { ioClip.observe(el); });
    revealStackTargets.forEach(function (el) { ioStack.observe(el); });
    revealLettersTargets.forEach(function (el) { ioLetters.observe(el); });
  }

  /* ─── Apparatus · one-shot delivery sequence ───────────── */
  var apparatus = document.getElementById("apparatus");

  function initApparatus() {
    if (!apparatus) return;
    if (reduced.matches || !("IntersectionObserver" in window)) {
      apparatus.classList.add("is-in");
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          io.disconnect();
        });
      },
      { threshold: 0.35 }
    );
    io.observe(apparatus);
  }

  /* ─── Stages · highlight the step at viewport centre ───── */
  var stages = Array.prototype.slice.call(document.querySelectorAll("[data-stage]"));

  function initStages() {
    if (!stages.length || !("IntersectionObserver" in window)) return;

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          entry.target.classList.toggle("is-current", entry.isIntersecting);
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );

    stages.forEach(function (el) { io.observe(el); });
  }

  /* ─── Boot ─────────────────────────────────────────────── */
  initTheme();
  syncScroll();
  initReveal();
  initApparatus();
  initStages();

  // Failsafe: if any reveal target never received .is-in (observer blocked,
  // element inside a clipped ancestor, etc.) it would sit at opacity 0 and
  // read as a blank page. If the observer has not yet revealed the content
  // sitting in the initial viewport, reveal it now rather than trust it.
  setTimeout(function () {
    var targets = revealTargets.concat(revealGroupTargets,
      revealSlideLeftTargets, revealSlideRightTargets, revealScaleTargets,
      revealParallaxTargets, revealLinesTargets, revealBlurTargets,
      revealRotateTargets, revealClipTargets, revealStackTargets,
      revealLettersTargets);
    var unrevealed = targets.filter(function (el) {
      if (el.classList.contains("is-in")) return false;
      var r = el.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    });
    if (unrevealed.length) showAll();
    if (apparatus) apparatus.classList.add("is-in");
  }, 2500);

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  // if the user flips reduced-motion mid-session, don't leave content invisible
  if (reduced.addEventListener) {
    reduced.addEventListener("change", function () {
      if (!reduced.matches) return;
      showAll();
      if (apparatus) apparatus.classList.add("is-in");
    });
  }

  /* ─── Parallax scroll effect for hero ───────────────────── */
  var heroMark = document.querySelector(".hero__mark");
  var heroTitle = document.querySelector(".hero__title");
  var heroLede = document.querySelector(".hero__lede");

  function onParallaxScroll() {
    if (reduced.matches) return;
    var scrolled = window.scrollY;
    var heroHeight = document.querySelector(".hero")?.offsetHeight || 0;
    if (scrolled > heroHeight) return;

    var progress = Math.min(scrolled / heroHeight, 1);
    var translateY = scrolled * 0.3;
    var scale = 1 - progress * 0.05;
    var opacity = 1 - progress * 0.4;

    if (heroMark) {
      heroMark.style.transform = "translateY(" + translateY + "px) scale(" + scale + ")";
      heroMark.style.opacity = opacity;
    }
    if (heroTitle) {
      heroTitle.style.transform = "translateY(" + (translateY * 0.5) + "px)";
      heroTitle.style.opacity = 1 - progress * 0.3;
    }
    if (heroLede) {
      heroLede.style.transform = "translateY(" + (translateY * 0.3) + "px)";
      heroLede.style.opacity = 1 - progress * 0.2;
    }
  }

  window.addEventListener("scroll", onParallaxScroll, { passive: true });

  /* ─── Boot · smooth scroll ───────────────────────────────
   * Initialised last so the reveal observers and parallax are already wired
   * before lenis takes over the scroll position.
   */
  initSmoothScroll();
})();
