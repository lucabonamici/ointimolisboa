/* =========================================================
   L'Intime — interactions & scroll animations
   Content is ALWAYS visible. GSAP is progressive enhancement only.
   ========================================================= */

(function () {
  // Real viewport height for iOS Safari — address bar makes 100vh taller than visible area
  function setVH() {
    document.documentElement.style.setProperty("--vh", (window.innerHeight * 0.01) + "px");
  }
  setVH();
  window.addEventListener("resize", setVH, { passive: true });

  // Prevent iOS Safari from restoring a previous scroll position on fresh load
  if (history.scrollRestoration) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /* ── Hamburger mobile menu ── */
  const hamburger = document.getElementById("navHamburger");
  const navLinks  = document.getElementById("navLinks");
  if (hamburger && navLinks) {
    hamburger.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("is-open");
      hamburger.classList.toggle("is-open", isOpen);
      hamburger.setAttribute("aria-expanded", String(isOpen));
      document.body.style.overflow = isOpen ? "hidden" : "";
    });
    navLinks.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        navLinks.classList.remove("is-open");
        hamburger.classList.remove("is-open");
        hamburger.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
    });
  }

  /* ── Hero video: pick mobile or desktop source, then fade in ── */
  const isMobile = window.matchMedia("(max-width: 640px)").matches;
  const heroVideo = document.querySelector(".hero-video");
  if (heroVideo) {
    heroVideo.src = isMobile ? "mobile_video.mov" : "intro.mp4";
    heroVideo.load();
    const reveal = () => heroVideo.classList.add("is-ready");
    if (heroVideo.readyState >= 2) reveal();
    else {
      heroVideo.addEventListener("loadeddata", reveal, { once: true });
      heroVideo.addEventListener("canplay",    reveal, { once: true });
    }
    const p = heroVideo.play();
    if (p && p.catch) p.catch(() => {});
  }

  /* ── Nav solidifies on scroll ── */
  const nav = document.querySelector(".nav");
  const onScroll = () => nav.classList.toggle("is-solid", window.scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ── Load event data from event.json (admin-editable) ──
     The HTML has fallback values so the page renders correctly even
     if the fetch fails. We just overwrite each [data-event-field]. */
  fetch("event.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data) return;
      document.querySelectorAll("[data-event-field]").forEach((el) => {
        const key = el.dataset.eventField;
        if (data[key] != null) el.textContent = data[key];
      });
    })
    .catch((err) => console.warn("event.json fetch failed:", err));

  /* ── Reservation modal ── */
  const reserveModal = document.getElementById("reserveModal");
  const reserveForm  = document.getElementById("reserveForm");
  const reserveError = document.getElementById("reserveError");

  const showModalView = (name) => {
    if (!reserveModal) return;
    reserveModal.querySelectorAll("[data-modal-view]").forEach((view) => {
      view.hidden = view.dataset.modalView !== name;
    });
  };

  const openModal = () => {
    if (!reserveModal) return;
    showModalView("form");
    reserveForm?.reset();
    if (reserveError) reserveError.hidden = true;
    reserveModal.classList.add("is-open");
    reserveModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    setTimeout(() => {
      reserveModal.querySelector('input[name="name"]')?.focus();
    }, 80);
  };

  const closeModal = () => {
    if (!reserveModal) return;
    reserveModal.classList.remove("is-open");
    reserveModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  };

  const bookBtn = document.getElementById("bookBtn");
  if (bookBtn) {
    bookBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openModal();
    });
  }

  reserveModal?.querySelectorAll("[data-modal-close]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && reserveModal?.classList.contains("is-open")) {
      closeModal();
    }
  });

  if (reserveForm) {
    reserveForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = reserveForm.querySelector('button[type="submit"]');
      if (reserveError) {
        reserveError.hidden = true;
        reserveError.textContent =
          "Something went wrong. Please try again or message us on Instagram.";
      }
      submitBtn.disabled = true;
      submitBtn.classList.add("is-loading");

      try {
        const fd = new FormData(reserveForm);

        const accessKey = (fd.get("access_key") || "").toString();
        if (!accessKey || accessKey === "YOUR_WEB3FORMS_ACCESS_KEY") {
          throw new Error(
            "Form not configured yet — the Web3Forms access key is missing."
          );
        }

        const message = [
          `Name: ${fd.get("name") || "-"}`,
          `Email: ${fd.get("email") || "-"}`,
          `Phone: ${fd.get("phone") || "-"}`,
          `Attendees: ${fd.get("attendees") || "-"}`,
          `Comment: ${fd.get("comment") || "-"}`,
        ].join("\n");
        fd.append("message", message);

        const res = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        console.log("Web3Forms response:", res.status, data);
        if (!res.ok || !data.success) {
          throw new Error(data.message || `Server responded ${res.status}`);
        }

        // Fire-and-forget confirmation email to the user via EmailJS.
        // The form succeeds either way; we don't block the success screen
        // on the auto-reply finishing.
        sendUserConfirmation({
          name: fd.get("name"),
          email: fd.get("email"),
          phone: fd.get("phone"),
          attendees: fd.get("attendees"),
        });

        showModalView("success");
      } catch (err) {
        console.error("Reservation submit failed:", err);
        if (reserveError) {
          reserveError.textContent = err.message || "Submission failed.";
          reserveError.hidden = false;
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove("is-loading");
      }
    });
  }

  /* ── EmailJS user confirmation ──
     Replace the three EMAILJS_* placeholders below with your own values
     from https://www.emailjs.com (Account → API Keys, Email Services,
     Email Templates). Until they're filled in, the form still works —
     this function just no-ops and logs to the console.

     The template should use these variables:
       {{name}}        — registrant's name
       {{email}}       — registrant's email (use as "To Email")
       {{attendees}}   — number of attendees
       {{event_date}}  — "14 June 2026"
       {{event_time}}  — "18h — 22h"
       {{address}}     — "Rua das Janelas Verdes 12"
  */
  const EMAILJS_PUBLIC_KEY  = "cGgFwb2C3q0HU4vuj";
  const EMAILJS_SERVICE_ID  = "service_0d6o7iq";
  const EMAILJS_TEMPLATE_ID = "template_esu7k5a";

  let emailjsReady = false;
  if (
    typeof emailjs !== "undefined" &&
    EMAILJS_PUBLIC_KEY &&
    !EMAILJS_PUBLIC_KEY.startsWith("YOUR_")
  ) {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
    emailjsReady = true;
  }

  function sendUserConfirmation({ name, email, phone, attendees }) {
    if (!emailjsReady) {
      console.warn(
        "EmailJS not configured — skipping user confirmation email."
      );
      return;
    }
    const params = {
      name: name || "",
      email: email || "",
      phone: phone || "",
      attendees: attendees || "1",
      event_date: "14 June 2026",
      event_time: "18h — 22h",
      address: "Rua das Janelas Verdes 12",
    };
    emailjs
      .send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params)
      .then((res) => console.log("EmailJS sent:", res.status, res.text))
      .catch((err) => console.error("EmailJS failed:", err));
  }

  /* ── Copy-to-clipboard for donation methods (MBWay) ── */
  document.querySelectorAll(".donation-link[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const value = btn.getAttribute("data-copy");
      try {
        await navigator.clipboard.writeText(value);
        btn.classList.add("is-copied");
        setTimeout(() => btn.classList.remove("is-copied"), 1400);
      } catch (err) {
        console.warn("Clipboard write failed:", err);
      }
    });
  });

  /* ── Memory strip: scroll-progress reveal so cards appear as the
        user scrolls down into the strip and disappear when scrolling
        back up. Each card has its own threshold for a staggered feel. ── */
  const memoryCards = document.querySelectorAll(".memory-card");
  const memoriesStrip = document.querySelector(".memories-strip");
  const memThresholds = [0.05, 0.15, 0.25, 0.35, 0.45];

  function updateMemories() {
    if (!memoriesStrip || !memoryCards.length) return;
    const rect = memoriesStrip.getBoundingClientRect();
    const vh = window.innerHeight;
    const progress = Math.max(0, Math.min(1, (vh - rect.top) / (vh + rect.height)));
    memoryCards.forEach((card, i) => {
      card.classList.toggle("is-visible", progress >= memThresholds[i]);
    });
  }

  window.addEventListener("scroll", updateMemories, { passive: true });
  window.addEventListener("resize", updateMemories, { passive: true });
  updateMemories();

  /* Autoplay each memory video when it's visible on screen */
  if (memoryCards.length && "IntersectionObserver" in window) {
    const vidObs = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        const vid = target.querySelector(".memory-video");
        if (!vid) return;
        if (isIntersecting) vid.play().catch(() => {});
        else { vid.pause(); vid.currentTime = 0; }
      });
    }, { threshold: 0.3 });
    memoryCards.forEach((card) => vidObs.observe(card));
  }

  /* Hover: unmute video and play with sound on desktop */
  memoryCards.forEach((card) => {
    const vid = card.querySelector(".memory-video");
    if (!vid) return;
    card.addEventListener("mouseenter", () => {
      vid.muted = false;
      if (vid.paused) vid.play().catch(() => {});
    });
    card.addEventListener("mouseleave", () => {
      vid.muted = true;
    });
  });

  /* ── GSAP guard: if missing or reduced motion, all content stays visible ── */
  if (reduceMotion || typeof gsap === "undefined") return;

  gsap.registerPlugin(ScrollTrigger);

  /* ──────────────────────────────────────────────────────
     IMPORTANT: Never use gsap.set() to hide content.
     All text/heading elements must remain visible if the
     ticker stalls (low-power mobile, background tab).
     Use gsap.from() which is lazy — the FROM state only
     applies on the first tick. If no tick ever fires the
     element stays at its natural CSS value (visible).
  ────────────────────────────────────────────────────── */

  /* ── Hero entrance ── */
  const eqLines = document.querySelectorAll(".logo-mark line");

  const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });

  // Equalizer bars — purely decorative, ok to animate from hidden
  heroTl.fromTo(
    eqLines,
    { scaleY: 0, transformOrigin: "center center" },
    { scaleY: 1, duration: 0.7, stagger: { each: 0.035, from: "center" }, ease: "back.out(1.4)" }
  );

  // Text — from() is lazy: if ticker stalls before first tick, element is visible
  heroTl
    .from(".logo-text",       { opacity: 0, y: 16, duration: 0.8, clearProps: "all" }, "-=0.25")
    .from(".logo-sub",        { opacity: 0, y: 10, duration: 0.6, clearProps: "all" }, "-=0.45")
    .from(".hero-handwritten",{ opacity: 0, y: 12, duration: 0.8, clearProps: "all" }, "-=0.3");

  // Equalizer idle motion kicks in after entrance
  heroTl.add(() => {
    eqLines.forEach((line, i) => {
      gsap.to(line, {
        scaleY: () => 0.55 + Math.random() * 0.65,
        duration: 0.7 + Math.random() * 0.6,
        repeat: -1, yoyo: true,
        ease: "sine.inOut",
        delay: i * 0.025,
      });
    });
  });

  /* Safety net — if ticker stalled and from() left elements invisible, reveal after 2.5s */
  setTimeout(() => {
    [".logo-text", ".logo-sub", ".hero-handwritten"].forEach((sel) => {
      const el = document.querySelector(sel);
      if (el && parseFloat(window.getComputedStyle(el).opacity) < 0.5) {
        gsap.set(el, { opacity: 1, y: 0, clearProps: "all" });
      }
    });
  }, 2500);

  /* ── Hero parallax ── */
  gsap.to(".hero-content", {
    yPercent: -10, opacity: 0.45, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.6 },
  });
  /* Video parallax on desktop only — on mobile the portrait video fills the
     wrapper exactly and any shift would expose the background at the edges. */
  if (!isMobile) {
    gsap.to(".hero-video-wrap", {
      yPercent: 8, scale: 1.04, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.6 },
    });
  }

  /* ── About: subtle slide only — no opacity gating ── */
  // Opacity is NOT touched here so text is always readable
  gsap.from(".about-text .eyebrow", {
    y: 18, duration: 0.8, ease: "power2.out",
    scrollTrigger: { trigger: ".about-text", start: "top 82%" },
  });
  gsap.from(".about-text h2", {
    y: 24, duration: 0.95, ease: "power2.out",
    scrollTrigger: { trigger: ".about-text", start: "top 78%" },
  });
  gsap.from(".about-text .lede", {
    y: 16, duration: 0.8, stagger: 0.1, ease: "power2.out",
    scrollTrigger: { trigger: ".about-text", start: "top 72%" },
  });

  /* ── Doodle draw-on (decorative SVGs — safe to animate from hidden) ── */
  const prepareStrokes = (root) => {
    root.querySelectorAll("path, line, circle, ellipse").forEach((el) => {
      let len = 200;
      try { len = el.getTotalLength ? el.getTotalLength() : len; } catch (_) {}
      if (!len || !isFinite(len)) len = 200;
      el.style.strokeDasharray  = len;
      el.style.strokeDashoffset = len;
    });
  };

  const drawOnScroll = (selector, opts = {}) => {
    const root = document.querySelector(selector);
    if (!root) return;
    prepareStrokes(root);
    gsap.to(root.querySelectorAll("path, line, circle, ellipse"), {
      strokeDashoffset: 0,
      ease: "none",
      stagger: opts.stagger || 0.05,
      scrollTrigger: {
        trigger: opts.trigger || root,
        start:   opts.start  || "top 90%",
        end:     opts.end    || "top 35%",
        scrub:   opts.scrub  != null ? opts.scrub : 0.8,
      },
    });
  };

  /* On phones (<=480px) the CSS resets stroke-dashoffset to 0 so doodles
     show as static drawings — skip the draw animation to avoid re-hiding them. */
  const isPhone = window.innerWidth <= 480;

  if (!isPhone) {
    drawOnScroll(".doodle-lamp",   { trigger: ".about", start: "top 75%", end: "center 40%", stagger: 0.05 });
    drawOnScroll(".doodle-guitar", { trigger: ".about", start: "top 65%", end: "center 30%", stagger: 0.04 });
    drawOnScroll(".doodle-notes",  { trigger: ".about", start: "top 55%", end: "center 20%", stagger: 0.06 });
  }

  /* Doodle idle animations — run on all screen sizes */
  ScrollTrigger.create({ trigger: ".doodle-lamp", start: "top 80%", once: true,
    onEnter: () => gsap.to(".doodle-lamp", { rotation: 3, transformOrigin: "70px 0px", duration: 3.6, repeat: -1, yoyo: true, ease: "sine.inOut" }),
  });
  ScrollTrigger.create({ trigger: ".doodle-guitar", start: "top 80%", once: true,
    onEnter: () => gsap.to(".doodle-guitar", { y: -10, rotation: -1.5, duration: 4, repeat: -1, yoyo: true, ease: "sine.inOut" }),
  });
  ScrollTrigger.create({ trigger: ".doodle-notes", start: "top 80%", once: true,
    onEnter: () => gsap.to(".doodle-notes", { x: 6, y: -6, duration: 5, repeat: -1, yoyo: true, ease: "sine.inOut" }),
  });

  /* Doodle parallax */
  gsap.to(".doodle-lamp",   { yPercent: -22, ease: "none", scrollTrigger: { trigger: ".about", start: "top bottom", end: "bottom top", scrub: 0.8 } });
  gsap.to(".doodle-guitar", { yPercent:  16, ease: "none", scrollTrigger: { trigger: ".about", start: "top bottom", end: "bottom top", scrub: 0.8 } });
  gsap.to(".doodle-notes",  { yPercent: -10, xPercent: 5,  ease: "none", scrollTrigger: { trigger: ".about", start: "top bottom", end: "bottom top", scrub: 0.8 } });

  /* ── Event section: slide only ── */
  gsap.from(".event .eyebrow, .event h2", {
    y: 20, duration: 0.8, stagger: 0.08, ease: "power2.out",
    scrollTrigger: { trigger: ".event", start: "top 78%" },
  });

  // Back card fades in slightly off-angle before main card
  gsap.from(".event-card-back", {
    opacity: 0, duration: 0.9, ease: "power2.out",
    scrollTrigger: { trigger: ".event-stack", start: "top 85%" },
  });

  gsap.from(".event-stack", {
    y: 30, duration: 1, ease: "power3.out",
    scrollTrigger: { trigger: ".event-stack", start: "top 85%" },
  });

  /* ── Book section ── */
  gsap.from(".book .eyebrow, .book h2, .book-lede", {
    y: 18, duration: 0.8, stagger: 0.08, ease: "power2.out",
    scrollTrigger: { trigger: ".book", start: "top 78%" },
  });
  gsap.from(".book-btn", {
    y: 14, duration: 0.8, ease: "power2.out",
    scrollTrigger: { trigger: ".book-btn", start: "top 88%" },
  });

  /* Section arrow: hand-drawn down arrow bridging Event → Book */
  drawOnScroll(".section-arrow", { start: "top 95%", end: "top 30%", stagger: 0.06 });
  /* Continuous gentle bounce — invites the eye toward the booking section. */
  ScrollTrigger.create({
    trigger: ".section-arrow",
    start: "top 90%",
    once: true,
    onEnter: () =>
      gsap.to(".section-arrow", {
        y: 12,
        duration: 1.4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      }),
  });

  /* Chair: draw on scroll (same guard — phones see it as a static drawing) */
  if (!isPhone) {
    drawOnScroll(".doodle-chair", { start: "top 95%", end: "top 45%", stagger: 0.04 });
  }
  ScrollTrigger.create({ trigger: ".doodle-chair", start: "top 85%", once: true,
    onEnter: () => gsap.to(".doodle-chair", { y: -6, rotation: 1.5, transformOrigin: "center bottom", duration: 4.2, repeat: -1, yoyo: true, ease: "sine.inOut" }),
  });

  /* ── Footer ── */
  gsap.from(".footer-content > *", {
    y: 14, duration: 0.8, stagger: 0.1, ease: "power2.out",
    scrollTrigger: { trigger: ".footer", start: "top 90%" },
  });

})();
