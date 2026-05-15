/* =========================================================
   L'Intime — scroll animations
   ========================================================= */

(function () {
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // ----- Hero video: fade in once it can play -----
  const heroVideoEl = document.querySelector(".hero-video");
  if (heroVideoEl) {
    const reveal = () => heroVideoEl.classList.add("is-ready");
    if (heroVideoEl.readyState >= 2) {
      reveal();
    } else {
      heroVideoEl.addEventListener("loadeddata", reveal, { once: true });
      heroVideoEl.addEventListener("canplay", reveal, { once: true });
    }
    // try to play (some browsers need a nudge)
    const tryPlay = heroVideoEl.play();
    if (tryPlay && typeof tryPlay.catch === "function") {
      tryPlay.catch(() => {
        // autoplay blocked — leave the gradient fallback visible
      });
    }
  }

  // ----- Nav goes solid after scroll -----
  const nav = document.querySelector(".nav");
  const onScroll = () => {
    if (window.scrollY > 40) nav.classList.add("is-solid");
    else nav.classList.remove("is-solid");
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ----- Book button: placeholder click feedback -----
  const bookBtn = document.getElementById("bookBtn");
  if (bookBtn) {
    bookBtn.addEventListener("click", (e) => {
      e.preventDefault();
      bookBtn.querySelector("span").textContent = "Booking opens soon";
      bookBtn.style.pointerEvents = "none";
      setTimeout(() => {
        bookBtn.querySelector("span").textContent = "Reserve your seat";
        bookBtn.style.pointerEvents = "";
      }, 2400);
    });
  }

  if (reduceMotion || typeof gsap === "undefined") return;

  gsap.registerPlugin(ScrollTrigger);

  /* -----------------------------------------------------
     Prepare stroke-based draw-on for every SVG doodle.
     We measure each path/line/circle/ellipse and set its
     dasharray to its own length, dashoffset to that length,
     then animate dashoffset to 0 on scroll.
     ----------------------------------------------------- */
  const prepareStrokes = (root) => {
    const els = root.querySelectorAll("path, line, circle, ellipse");
    els.forEach((el) => {
      let len = 0;
      try {
        len = el.getTotalLength
          ? el.getTotalLength()
          : el.getBoundingClientRect().width * 2;
      } catch (_) {
        len = 200;
      }
      if (!len || !isFinite(len)) len = 200;
      el.style.strokeDasharray = len;
      el.style.strokeDashoffset = len;
      el._drawLen = len;
    });
  };

  const drawOnScroll = (selector, opts = {}) => {
    const root = document.querySelector(selector);
    if (!root) return;
    prepareStrokes(root);
    const els = root.querySelectorAll("path, line, circle, ellipse");
    // Scroll-linked: the drawing is *driven* by scroll position,
    // so each pixel of scroll continues the line.
    gsap.to(els, {
      strokeDashoffset: 0,
      ease: "none",
      stagger: opts.stagger || 0.06,
      scrollTrigger: {
        trigger: opts.trigger || root,
        start: opts.start || "top 90%",
        end: opts.end || "top 35%",
        scrub: opts.scrub != null ? opts.scrub : 0.8,
      },
    });
  };

  /* ----- Hero entrance ----- */
  const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });

  // Animate equalizer bars: each line scales vertically from 0 then settles.
  const eqLines = document.querySelectorAll(".logo-mark line");
  gsap.set(eqLines, { transformOrigin: "center center", scaleY: 0 });
  heroTl.to(eqLines, {
    scaleY: 1,
    duration: 0.8,
    stagger: { each: 0.04, from: "center" },
    ease: "back.out(1.6)",
  });

  // Logo text + sub
  gsap.set([".logo-text", ".logo-sub", ".hero-handwritten"], {
    opacity: 0,
    y: 18,
  });
  heroTl
    .to(".logo-text", { opacity: 1, y: 0, duration: 0.9 }, "-=0.3")
    .to(".logo-sub", { opacity: 1, y: 0, duration: 0.7 }, "-=0.5")
    .to(".hero-handwritten", { opacity: 0.95, y: 0, duration: 0.9 }, "-=0.3");

  // Equalizer idle motion after entrance
  heroTl.add(() => {
    eqLines.forEach((line, i) => {
      gsap.to(line, {
        scaleY: () => 0.6 + Math.random() * 0.6,
        duration: 0.8 + Math.random() * 0.6,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: i * 0.03,
      });
    });
  });

  /* ----- Hero parallax on scroll ----- */
  gsap.to(".hero-content", {
    yPercent: -12,
    opacity: 0.4,
    ease: "none",
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      scrub: 0.6,
    },
  });

  gsap.to(".hero-video", {
    yPercent: 8,
    scale: 1.04,
    ease: "none",
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      scrub: 0.6,
    },
  });

  /* ----- About text reveal ----- */
  gsap.from(".about-text > *", {
    opacity: 0,
    y: 28,
    duration: 1,
    stagger: 0.12,
    ease: "power2.out",
    scrollTrigger: {
      trigger: ".about",
      start: "top 70%",
    },
  });

  /* ----- Doodles: draw on scroll (linked to scroll position) ----- */
  // Use the whole .about section as the trigger so all three doodles
  // share the same scroll window and draw together as the user
  // scrolls through this section.
  drawOnScroll(".doodle-lamp", {
    trigger: ".about",
    start: "top 75%",
    end: "center 40%",
    stagger: 0.05,
  });
  drawOnScroll(".doodle-guitar", {
    trigger: ".about",
    start: "top 65%",
    end: "center 30%",
    stagger: 0.04,
  });
  drawOnScroll(".doodle-notes", {
    trigger: ".about",
    start: "top 55%",
    end: "center 20%",
    stagger: 0.06,
  });

  /* ----- Doodle idle motion: sway & float ----- */
  // Lamp sways gently around its cord pivot
  ScrollTrigger.create({
    trigger: ".doodle-lamp",
    start: "top 80%",
    once: true,
    onEnter: () => {
      gsap.to(".doodle-lamp", {
        rotation: 3,
        transformOrigin: "70px 0px",
        duration: 3.6,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    },
  });

  // Guitar floats vertically
  ScrollTrigger.create({
    trigger: ".doodle-guitar",
    start: "top 80%",
    once: true,
    onEnter: () => {
      gsap.to(".doodle-guitar", {
        y: -10,
        rotation: -1.5,
        duration: 4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    },
  });

  // Notes drift
  ScrollTrigger.create({
    trigger: ".doodle-notes",
    start: "top 80%",
    once: true,
    onEnter: () => {
      gsap.to(".doodle-notes", {
        x: 6,
        y: -6,
        duration: 5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    },
  });

  // Parallax drift on the whole doodle column while scrolling through "about"
  gsap.to(".doodle-lamp", {
    yPercent: -25,
    ease: "none",
    scrollTrigger: {
      trigger: ".about",
      start: "top bottom",
      end: "bottom top",
      scrub: 0.8,
    },
  });
  gsap.to(".doodle-guitar", {
    yPercent: 18,
    ease: "none",
    scrollTrigger: {
      trigger: ".about",
      start: "top bottom",
      end: "bottom top",
      scrub: 0.8,
    },
  });
  gsap.to(".doodle-notes", {
    yPercent: -12,
    xPercent: 6,
    ease: "none",
    scrollTrigger: {
      trigger: ".about",
      start: "top bottom",
      end: "bottom top",
      scrub: 0.8,
    },
  });

  /* ----- Event card reveal ----- */
  gsap.from(".event .eyebrow, .event h2", {
    opacity: 0,
    y: 24,
    duration: 0.9,
    stagger: 0.1,
    ease: "power2.out",
    scrollTrigger: { trigger: ".event", start: "top 70%" },
  });

  gsap.from(".event-card", {
    opacity: 0,
    y: 40,
    duration: 1.1,
    ease: "power3.out",
    scrollTrigger: { trigger: ".event-card", start: "top 80%" },
  });

  gsap.from(".event-date-block > *", {
    opacity: 0,
    y: 16,
    duration: 0.7,
    stagger: 0.08,
    ease: "power2.out",
    scrollTrigger: { trigger: ".event-card", start: "top 75%" },
    delay: 0.3,
  });

  gsap.from(".event-meta > *", {
    opacity: 0,
    x: 24,
    duration: 0.8,
    stagger: 0.08,
    ease: "power2.out",
    scrollTrigger: { trigger: ".event-card", start: "top 75%" },
    delay: 0.4,
  });

  /* ----- Book section ----- */
  gsap.from(".book .eyebrow, .book h2, .book-lede", {
    opacity: 0,
    y: 24,
    duration: 0.9,
    stagger: 0.1,
    ease: "power2.out",
    scrollTrigger: { trigger: ".book", start: "top 70%" },
  });

  // Chair draws on scroll, linked to its own position
  drawOnScroll(".doodle-chair", {
    start: "top 95%",
    end: "top 40%",
    stagger: 0.04,
  });

  // Chair gentle bob
  ScrollTrigger.create({
    trigger: ".doodle-chair",
    start: "top 85%",
    once: true,
    onEnter: () => {
      gsap.to(".doodle-chair", {
        y: -6,
        rotation: 1.5,
        transformOrigin: "center bottom",
        duration: 4.2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    },
  });

  gsap.from(".book-btn", {
    opacity: 0,
    y: 16,
    duration: 0.9,
    ease: "power2.out",
    scrollTrigger: { trigger: ".book-btn", start: "top 85%" },
    delay: 0.2,
  });

  gsap.from(".book-foot", {
    opacity: 0,
    y: 12,
    duration: 0.8,
    ease: "power2.out",
    scrollTrigger: { trigger: ".book-foot", start: "top 90%" },
  });

  /* ----- Footer reveal ----- */
  gsap.from(".footer-content > *", {
    opacity: 0,
    y: 16,
    duration: 0.8,
    stagger: 0.12,
    ease: "power2.out",
    scrollTrigger: { trigger: ".footer", start: "top 90%" },
  });
})();
