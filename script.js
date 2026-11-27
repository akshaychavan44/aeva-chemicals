/* Aeva Chemicals — landing page interactions */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Refresh opens on the hero ----------
     On a reload the browser would return to the last scroll position or to a
     #section in the address; send the visitor back to the top instead. Links and
     back/forward still land where they point. */
  if (location.hash !== "#inquiry" && performance.getEntriesByType("navigation")[0]?.type === "reload") {
    history.scrollRestoration = "manual";
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    scrollTo({ top: 0, behavior: "instant" });
  }

  /* ---------- About: the soaping bath, in a flask ----------
     A pinned glass flask. Scrolling runs the wash-off: murky dyed liquor with
     loose dye swirling in it, gold AeSop drops falling in, the liquor turning
     over as gold strands catch the dye and carry it up and out, and finally a
     clear, bright liquid with a few bubbles. Drawn in 2D, in flask units. */
  (() => {
    const section = $(".story");
    if (!section) return;
    const pin = $(".story__pin", section);
    const canvas = $(".story__canvas", section);
    const ctx = canvas.getContext("2d");
    const steps = $$(".story__steps li", section);
    const bars = $$(".story__progress i", section);
    const ease = (t) => t * t * (3 - 2 * t);
    const ramp = (a, b, v) => (v <= a ? 0 : v >= b ? 1 : ease((v - a) / (b - a)));
    const lerp = (a, b, t) => a + (b - a) * t;
    const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
    const mixc = (a, b, t, al = 1) => `rgba(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(",")},${al})`;
    const C = {
      dirtyTop: hex("#3b4a36"), dirtyDeep: hex("#0b1712"), // murky, spent dye liquor
      cleanTop: hex("#fbf3cf"), cleanDeep: hex("#e2c56a"),
      gold: hex("#e8b84b"), ink: hex("#06201a"), teal: hex("#2fae86"),
    };

    let w = 0, h = 0, dpr = 1, S = 400, fx = 0, fy = 0;
    let target = 0, shown = 0, prevShown = 0, active = -1, visible = false, raf = 0, last = 0, time = 0;
    let slosh = 0, sloshV = 0, nextDrop = 0;
    const drops = [], ripples = [], bubbles = [];
    const dye = Array.from({ length: 70 }, () => ({
      a: Math.random() * Math.PI * 2, r: 0.25 + Math.random() * 0.7, y: Math.random(),
      s: 0.6 + Math.random() * 1.6, sp: 0.4 + Math.random() * 0.8, teal: Math.random() < 0.3,
    }));

    // The flask in its own units: height 1, centred on x = 0, rim at y = 0.
    const CONE_TOP = 0.42, CONE_BOT = 0.885;
    const halfWidth = (y, k = 0) => (y < CONE_TOP ? 0.11 : lerp(0.165, 0.4, (y - CONE_TOP) / (CONE_BOT - CONE_TOP))) - k;
    function outline(k) {
      ctx.beginPath();
      ctx.moveTo(-(0.11 - k), 0.035);
      ctx.lineTo(0.11 - k, 0.035);
      ctx.lineTo(0.11 - k, 0.3);
      ctx.quadraticCurveTo(0.11 - k, 0.37, 0.165 - k, CONE_TOP);
      ctx.lineTo(0.4 - k, CONE_BOT);
      ctx.quadraticCurveTo(0.45 - k, 1 - k, 0.35 - k, 1 - k);
      ctx.lineTo(-(0.35 - k), 1 - k);
      ctx.quadraticCurveTo(-(0.45 - k), 1 - k, -(0.4 - k), CONE_BOT);
      ctx.lineTo(-(0.165 - k), CONE_TOP);
      ctx.quadraticCurveTo(-(0.11 - k), 0.37, -(0.11 - k), 0.3);
      ctx.closePath();
    }
    const streak = (x0, y0, x1, y1, width, alpha) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.3, `rgba(255,255,255,${alpha})`);
      g.addColorStop(0.7, `rgba(255,255,255,${alpha})`); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = g; ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    };

    const syncCard = (p) => {
      const step = Math.min(3, Math.floor(p * 4));
      if (step !== active) {
        active = step;
        steps.forEach((li, i) => li.classList.toggle("is-on", i === step));
      }
      bars.forEach((b, i) => b.style.setProperty("--fill", Math.min(1, Math.max(0, p * 4 - i)).toFixed(3)));
    };

    function resize() {
      const r = pin.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      if (w < 720) { // phones: the flask above the card
        S = Math.min(h * 0.44, w * 0.95);
        fx = w / 2; fy = h * 0.08 + 40;
      } else {
        S = Math.min(h * 0.68, w * 0.44);
        fx = w * 0.66; fy = h * 0.54 - S * 0.5;
      }
    }

    function measure() {
      const r = section.getBoundingClientRect();
      const run = r.height - innerHeight;
      target = run > 0 ? Math.min(1, Math.max(0, -r.top / run)) : 0;
    }

    function update(dt, p) {
      // scroll speed sloshes the liquor; a spring brings it back
      const vel = (p - prevShown) / Math.max(dt, 1e-3);
      prevShown = p;
      sloshV += (-slosh * 40 - sloshV * 5 + vel * 6) * dt;
      slosh += sloshV * dt;
      // AeSop drops while step 2 is on screen
      if (p > 0.24 && p < 0.56 && time > nextDrop) {
        drops.push({ x: (Math.random() - 0.5) * 0.08, y: -0.35, v: 0 });
        nextDrop = time + 0.75 + Math.random() * 0.5;
      }
      const L = level(p);
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.v += 2.4 * dt; d.y += d.v * dt;
        if (d.y >= L) {
          drops.splice(i, 1);
          ripples.push({ x: d.x, age: 0 });
          sloshV += 0.6;
          for (let k = 0; k < 6; k++) bubbles.push(bubble(L + 0.05 + Math.random() * 0.1, d.x));
        }
      }
      for (let i = ripples.length - 1; i >= 0; i--) if ((ripples[i].age += dt) > 1.4) ripples.splice(i, 1);
      // bubbles: a few always, many once the liquor is clean
      const want = 6 + Math.round(ramp(0.72, 0.95, p) * 26);
      if (bubbles.length < want && Math.random() < 0.3) bubbles.push(bubble(0.97, null));
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.y -= b.v * dt; b.wob += dt * 5;
        if (b.y < L + 0.01) bubbles.splice(i, 1);
      }
      for (const d of dye) d.a += d.sp * dt * (0.25 + ramp(0.3, 0.6, p) * 1.6);
    }
    const bubble = (y, x) => {
      const hw = halfWidth(y, 0.03);
      return { x: x ?? (Math.random() * 2 - 1) * hw * 0.8, y, r: 0.003 + Math.random() * 0.007, v: 0.06 + Math.random() * 0.1, wob: Math.random() * 6 };
    };
    const level = (p) => 0.6 - 0.05 * ramp(0.25, 0.55, p);

    function draw(p) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // backdrop: the page cream, a touch brighter behind the flask
      const bg = ctx.createRadialGradient(fx, fy + S * 0.55, S * 0.1, fx, fy + S * 0.55, Math.hypot(w, h) * 0.75);
      bg.addColorStop(0, "#fbfaf5"); bg.addColorStop(0.45, "#f4f1e8"); bg.addColorStop(1, "#ebe7da");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const clean = ramp(0.55, 0.92, p), goldIn = ramp(0.26, 0.5, p);
      const top = mixc(C.dirtyTop, C.cleanTop, clean), deep = mixc(C.dirtyDeep, C.cleanDeep, clean);

      // the bench: shadow and the liquor's coloured light thrown on it
      const floorY = fy + S;
      ctx.save();
      ctx.translate(fx, floorY);
      ctx.scale(1, 0.16);
      let g = ctx.createRadialGradient(0, 0, 0, 0, 0, S * 0.75);
      g.addColorStop(0, mixc(C.dirtyTop, C.cleanDeep, clean, 0.25 + clean * 0.25)); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(-S, -S, S * 2, S * 2);
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, S * 0.45);
      g.addColorStop(0, "rgba(22,33,28,.4)"); g.addColorStop(1, "rgba(22,33,28,0)");
      ctx.fillStyle = g; ctx.fillRect(-S, -S, S * 2, S * 2);
      ctx.restore();

      // flask frame: units of S, gently swaying about its base
      const sway = reduced ? 0 : Math.sin(time * 0.7) * 0.012 + slosh * 0.04;
      ctx.translate(fx, floorY);
      ctx.rotate(sway);
      ctx.translate(0, -S);
      ctx.scale(S, S);
      const L = level(p), px = 1 / S;

      // back of the glass
      outline(0);
      ctx.fillStyle = "rgba(11,68,52,.045)";
      ctx.fill();

      // ---- the liquor ----
      ctx.save();
      outline(0.012);
      ctx.clip();
      const tilt = -Math.tan(sway) - slosh * 0.5;
      const surf = (x) => {
        let y = L + x * tilt + Math.sin(x * 22 + time * 2.2) * 0.003;
        for (const r of ripples) {
          const d = Math.abs(x - r.x) - r.age * 0.35;
          y += Math.exp(-d * d * 900) * 0.012 * (1 - r.age / 1.4);
        }
        return y;
      };
      ctx.beginPath();
      ctx.moveTo(-0.5, surf(-0.5));
      for (let x = -0.48; x <= 0.5; x += 0.02) ctx.lineTo(x, surf(x));
      ctx.lineTo(0.5, 1.1); ctx.lineTo(-0.5, 1.1); ctx.closePath();
      g = ctx.createLinearGradient(0, L, 0, 1);
      g.addColorStop(0, top); g.addColorStop(1, deep);
      ctx.fillStyle = g;
      ctx.fill();
      // volume: darker towards the walls, light through the middle
      g = ctx.createLinearGradient(-0.45, 0, 0.45, 0);
      g.addColorStop(0, "rgba(0,0,0,.35)"); g.addColorStop(0.35, "rgba(255,255,255,.06)");
      g.addColorStop(0.55, "rgba(255,255,255,.1)"); g.addColorStop(1, "rgba(0,0,0,.4)");
      ctx.fillStyle = g;
      ctx.fill();

      // gold strands of AeSop turning in the liquor
      const strands = goldIn * (1 - ramp(0.8, 0.92, p));
      const lift = ramp(0.58, 0.85, p);
      if (strands > 0.01) {
        ctx.lineCap = "round";
        for (let i = 0; i < 7; i++) {
          const y = lerp(lerp(L + 0.06, 0.95, i / 6), L + 0.02, lift * (0.4 + i * 0.09));
          const rx = halfWidth(y, 0.03) * (0.7 + 0.2 * Math.sin(i * 1.7)), ry = rx * 0.16;
          const ph = time * (0.9 + i * 0.13) + i * 1.3;
          ctx.strokeStyle = mixc(C.gold, [255, 236, 170], 0.3, strands * (0.75 - i * 0.05));
          ctx.lineWidth = 2.2 * px;
          ctx.beginPath();
          ctx.ellipse(0, y, rx, ry, 0, ph, ph + 1.6 + 0.5 * Math.sin(time + i));
          ctx.stroke();
        }
      }

      // loose dye: swirls, is caught, rises and drains away
      const hold = ramp(0.45, 0.62, p), gone = ramp(0.7, 0.86, p);
      for (const d of dye) {
        const y0 = lerp(L + 0.04, 0.96, d.y);
        const y = lerp(y0, L + 0.015, lift * (0.5 + d.y * 0.5));
        const hw = halfWidth(y, 0.03);
        const r = lerp(d.r, 0.82, hold);
        const x = Math.cos(d.a) * r * hw, yy = y + Math.sin(d.a) * r * hw * 0.16;
        const front = 0.55 + 0.45 * Math.sin(d.a);
        const a = (1 - gone) * front;
        if (a < 0.02) continue;
        const s = d.s * px * (0.8 + front * 0.6) * 2.2;
        ctx.fillStyle = mixc(d.teal ? C.teal : C.ink, C.ink, 0, a * 0.85);
        ctx.beginPath(); ctx.arc(x, yy, s, 0, Math.PI * 2); ctx.fill();
        if (hold > 0.05) { // held: a gold ring of polymer round each speck
          ctx.strokeStyle = mixc(C.gold, C.gold, 0, a * hold * 0.9);
          ctx.lineWidth = 1.1 * px;
          ctx.beginPath(); ctx.arc(x, yy, s * 2, 0, Math.PI * 2); ctx.stroke();
        }
      }

      // bubbles
      for (const b of bubbles) {
        const x = b.x + Math.sin(b.wob) * 0.004;
        ctx.strokeStyle = `rgba(255,255,255,${0.35 + clean * 0.3})`;
        ctx.lineWidth = 1 * px;
        ctx.beginPath(); ctx.arc(x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,.6)";
        ctx.beginPath(); ctx.arc(x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.28, 0, Math.PI * 2); ctx.fill();
      }

      // the surface, seen from just above: a lit ellipse with a bright meniscus
      const rx = halfWidth(L, 0.012), ry = rx * 0.14;
      ctx.save();
      ctx.translate(0, surf(0));
      ctx.rotate(Math.atan(tilt));
      g = ctx.createLinearGradient(0, -ry, 0, ry);
      g.addColorStop(0, mixc(C.dirtyTop, C.cleanTop, clean, 0.9)); g.addColorStop(1, top);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.12)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.55)";
      ctx.lineWidth = 1.4 * px;
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, Math.PI, Math.PI * 2); ctx.stroke();
      for (const r of ripples) {
        const k = r.age / 1.4;
        ctx.strokeStyle = mixc(C.gold, [255, 255, 255], 0.4, 0.7 * (1 - k));
        ctx.beginPath(); ctx.ellipse(r.x, 0, 0.01 + k * rx * 0.7, (0.01 + k * rx * 0.7) * 0.16, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
      ctx.restore(); // unclip

      // AeSop drops on their way in
      for (const d of drops) {
        const r = 0.014;
        g = ctx.createRadialGradient(d.x - r * 0.3, d.y - r * 0.2, r * 0.1, d.x, d.y, r * 1.2);
        g.addColorStop(0, "#fff3c8"); g.addColorStop(0.5, "#e8b84b"); g.addColorStop(1, "#a97b1c");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y - r * 2.4);
        ctx.bezierCurveTo(d.x + r * 0.4, d.y - r * 1.2, d.x + r, d.y - r * 0.5, d.x + r, d.y);
        ctx.arc(d.x, d.y, r, 0, Math.PI);
        ctx.bezierCurveTo(d.x - r, d.y - r * 0.5, d.x - r * 0.4, d.y - r * 1.2, d.x, d.y - r * 2.4);
        ctx.fill();
      }

      // ---- the glass, in front ----
      outline(0);
      ctx.strokeStyle = "rgba(11,68,52,.55)";
      ctx.lineWidth = 2.2 * px;
      ctx.stroke();
      outline(0.012);
      ctx.strokeStyle = "rgba(11,68,52,.16)";
      ctx.lineWidth = 1.2 * px;
      ctx.stroke();
      // reflections: a sharp streak down the left of the cone, a soft one on the right, two on the neck
      streak(-0.15, 0.46, -0.355, 0.85, 5 * px, 0.55);
      streak(-0.135, 0.5, -0.31, 0.83, 14 * px, 0.08);
      streak(0.31, 0.62, 0.37, 0.84, 18 * px, 0.1);
      streak(-0.075, 0.06, -0.075, 0.33, 4 * px, 0.45);
      streak(0.08, 0.08, 0.08, 0.3, 9 * px, 0.08);
      // the base catches the light
      g = ctx.createLinearGradient(-0.35, 0, 0.35, 0);
      g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,.45)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = g; ctx.lineWidth = 2 * px;
      ctx.beginPath(); ctx.moveTo(-0.3, 0.992); ctx.lineTo(0.3, 0.992); ctx.stroke();
      // rim
      ctx.strokeStyle = "rgba(11,68,52,.55)";
      ctx.lineWidth = 2.4 * px;
      ctx.beginPath(); ctx.ellipse(0, 0.03, 0.128, 0.018, 0, 0, Math.PI * 2); ctx.stroke();
      // graduations
      ctx.strokeStyle = "rgba(11,68,52,.45)";
      ctx.fillStyle = "rgba(11,68,52,.6)";
      ctx.lineWidth = 1.2 * px;
      ctx.font = `${10 * px}px "Jost", system-ui, sans-serif`;
      ctx.textBaseline = "middle";
      [[0.56, "300"], [0.68, "200"], [0.8, "100"]].forEach(([y, label]) => {
        const xr = halfWidth(y) - 0.03;
        ctx.beginPath(); ctx.moveTo(xr - 0.06, y); ctx.lineTo(xr, y); ctx.stroke();
        ctx.fillText(label, xr - 0.06 - 26 * px, y);
      });
      ctx.fillText("ml", halfWidth(0.5) - 0.12, 0.5);
    }

    function tick(now) {
      raf = 0;
      if (!visible) return;
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      time += dt;
      shown = reduced ? target : shown + (target - shown) * (1 - Math.exp(-dt * 6));
      if (Math.abs(target - shown) < 0.0005) shown = target;
      if (!reduced) update(dt, shown);
      syncCard(shown);
      draw(shown);
      if (!reduced || shown !== target) raf = requestAnimationFrame(tick);
    }
    const wake = () => {
      if (raf || !visible) return;
      last = 0;
      raf = requestAnimationFrame(tick);
    };
    addEventListener("scroll", () => { measure(); wake(); }, { passive: true });
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) { measure(); wake(); }
    }).observe(section);
    new ResizeObserver(() => { resize(); measure(); syncCard(shown); draw(shown); wake(); }).observe(pin);

    // The company film plays in a pop-up from the story card.
    const film = $(".film");
    if (film) {
      const video = $("video", film);
      $(".story__film", section).addEventListener("click", () => {
        film.showModal();
        video.play().catch(() => {});
      });
      $(".film__close", film).addEventListener("click", () => film.close());
      film.addEventListener("click", (e) => { if (e.target === film) film.close(); });
      film.addEventListener("close", () => video.pause());
    }
  })();

  /* ---------- Roll text effect ----------
     Hover: line rolls up, a tinted copy slides in from below.
     Leave: the copy stays up and fades back to the base colour (the trail),
     then the line silently resets once both layers look identical. */
  $$(".roll").forEach((el) => {
    // Navbar labels stay still inside the dock's hover zoom and lift.
    if (el.closest(".nav__links, .nav__cta")) {
      el.classList.remove("roll");
      return;
    }
    const text = el.textContent.trim();
    el.innerHTML = `<span class="roll__in"><span>${text}</span><span aria-hidden="true">${text}</span></span>`;
    const host = el.closest(".btn") || el;
    let timer;
    host.addEventListener("mouseenter", () => {
      clearTimeout(timer);
      el.classList.remove("is-fade");
      el.classList.add("is-on");
    });
    host.addEventListener("mouseleave", () => {
      el.classList.add("is-fade");
      timer = setTimeout(() => el.classList.remove("is-on", "is-fade"), 1150);
    });
  });

  /* ---------- Split helpers ---------- */
  function splitChars(root, counter) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement.closest(".hero__rotator") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.append(" "); return; }
        const word = document.createElement("span");
        word.className = "word";
        [...part].forEach((ch) => {
          const c = document.createElement("span");
          c.className = "char";
          c.textContent = ch;
          c.style.setProperty("--i", counter.n++);
          word.append(c);
        });
        frag.append(word);
      });
      node.replaceWith(frag);
    });
  }

  function splitWords(el) {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(" "); return; }
            const w = document.createElement("span");
            w.className = "word";
            w.innerHTML = `<span style="--i:${i++}">${part}</span>`;
            frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
  }

  /* ---------- Hero: the AeSop pour, frame by frame ----------
     The hero pins inside .hero-scroll and the scroll through it picks the frame.
     Frames load coarse to fine (every 16th, then 8th, ...) so scrubbing works
     before they have all arrived; a missing frame shows its nearest loaded one.
     With reduced motion only the last frame (the filled flask) is shown. */
  (() => {
    const wrap = $(".hero-scroll");
    const canvas = $(".hero__film");
    const ctx = canvas && canvas.getContext("2d");
    if (!wrap || !ctx) return;
    const N = +canvas.dataset.count;
    const url = (i) => `${canvas.dataset.frames}${String(i + 1).padStart(3, "0")}.webp`;
    const phone = matchMedia("(max-width: 860px)");
    const imgs = new Array(N), ready = new Uint8Array(N);
    let w = 0, h = 0, cur = reduced ? N - 1 : 0, target = cur, drawn = -1, raf = 0;

    const nearest = (i) => {
      for (let d = 0; d < N; d++) {
        if (i - d >= 0 && ready[i - d]) return imgs[i - d];
        if (i + d < N && ready[i + d]) return imgs[i + d];
      }
      return null;
    };
    const draw = () => {
      const img = nearest(Math.round(cur));
      if (!img) return;
      const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      // keep the pour (right of centre in the frame) in view, like object-position
      ctx.drawImage(img, (w - dw) * (phone.matches ? 0.68 : 0.7), (h - dh) / 2, dw, dh);
      drawn = Math.round(cur);
    };
    const resize = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      w = canvas.offsetWidth; h = canvas.offsetHeight; // layout size, ignoring the intro zoom
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingQuality = "high";
      draw();
    };
    const load = (i) => {
      if (imgs[i]) return;
      const img = (imgs[i] = new Image());
      img.decoding = "async";
      img.onload = () => {
        ready[i] = 1;
        // redraw if this frame is closer to the wanted one than what is showing
        if (drawn < 0 || Math.abs(i - Math.round(cur)) < Math.abs(drawn - Math.round(cur)) || i === Math.round(cur)) draw();
      };
      img.src = url(i);
    };

    resize();
    addEventListener("resize", resize);
    phone.addEventListener("change", resize);
    if (reduced) { load(N - 1); return; }

    load(0); load(N - 1);
    // Keep the scroll animation on phones with a smaller set of decoded frames.
    const minimumStep = phone.matches || matchMedia("(pointer: coarse)").matches ? 8 : 1;
    for (let step = 16; step >= minimumStep; step /= 2) {
      for (let i = 0; i < N; i += step) load(i);
    }

    const tick = () => {
      cur += (target - cur) * 0.22; // a little easing so wheel steps glide
      if (Math.abs(target - cur) < 0.02) cur = target;
      if (Math.round(cur) !== drawn) draw();
      raf = cur === target ? 0 : requestAnimationFrame(tick);
    };
    const onScroll = () => {
      const run = wrap.offsetHeight - innerHeight;
      const p = run > 0 ? Math.min(1, Math.max(0, -wrap.getBoundingClientRect().top / run)) : 0;
      wrap.style.setProperty("--hero-p", p.toFixed(3));
      target = p * (N - 1);
      if (!raf) raf = requestAnimationFrame(tick);
    };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    onScroll();
  })();

  /* ---------- Hero title ---------- */
  const counter = { n: 0 };
  $$(".hero__title .split").forEach((s) => splitChars(s, counter));

  // rotating last word
  const rot = $(".hero__rotator");
  const track = $(".hero__rot-track");
  const items = $$(".hero__rot-track > span");
  items.forEach((s) => (s.style.width = "max-content"));
  rot.style.transition = "width .8s cubic-bezier(.7,0,.2,1)";
  rot.style.opacity = "0";
  rot.style.transform = "translateY(40%)";
  let idx = 0;
  const setRotWidth = () => (rot.style.width = items[idx].offsetWidth + "px");
  function nextWord() {
    if (idx >= items.length - 1) return;
    idx++;
    track.style.transition = "";
    track.style.transform = `translateY(${-idx * 0.98}em)`;
    setRotWidth();
    if (idx === items.length - 1) {
      // last item duplicates the first: jump back without animating
      setTimeout(() => {
        track.style.transition = "none";
        idx = 0;
        track.style.transform = "translateY(0)";
        setRotWidth();
      }, 820);
    }
  }

  const start = () => {
    setRotWidth();
    document.body.classList.add("is-ready");
    $$(".hero__title .split").forEach((s) => s.classList.add("is-ready"));
    setTimeout(() => {
      rot.style.transition += ", opacity .8s, transform .9s cubic-bezier(.16,1,.3,1)";
      rot.style.opacity = "1";
      rot.style.transform = "none";
    }, counter.n * 28 + 300);
    if (!reduced) setInterval(nextWord, 2800);
  };
  Promise.race([
    document.fonts?.ready ?? Promise.resolve(),
    new Promise(resolve => setTimeout(resolve, 1200)),
  ]).then(start);
  document.fonts?.ready.then(setRotWidth);
  addEventListener("resize", setRotWidth);

  /* ---------- Scroll reveals ---------- */
  $$(".reveal-words").forEach(splitWords);
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      io.unobserve(e.target);
    }),
    { threshold: 0.18, rootMargin: "0px 0px -6% 0px" }
  );
  $$(".reveal-up, .reveal-words").forEach((el) => io.observe(el));

  /* ---------- Nav ---------- */
  const nav = $("#nav");
  // over the pinned hero the bar stays clear; it turns to glass once the hero has scrolled away
  const heroWrap = $(".hero-scroll");
  const onScroll = () => nav.classList.toggle("is-scrolled", scrollY > (heroWrap ? heroWrap.offsetTop + heroWrap.offsetHeight - 80 : 40));
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  const button = nav.querySelector('.nav__burger');
  const close = () => {
    nav.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', 'Open menu');
  };
  button.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  nav.querySelectorAll('a[href]').forEach(link => link.addEventListener('click', close));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      close();
      button.focus();
    }
  });

  /* Dock magnification: transform links without shifting the header layout. */
  (() => {
    const desktop = matchMedia("(min-width: 861px)");
    const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
    const links = $$(".nav__links a, .nav__cta", nav);
    const items = links.map(el => ({ el, value: 0, velocity: 0, target: 0 }));
    let pointerX = null;
    let focused = null;
    let frame = 0;
    let lastTime = 0;
    const enabled = () => desktop.matches && !motionPreference.matches;

    function animate(time) {
      const dt = Math.min((time - lastTime) / 1000 || 1 / 60, .032);
      lastTime = time;
      let settling = false;
      items.forEach(item => {
        // Small integration steps keep the spring stable on slower frames.
        const steps = Math.ceil(dt / .008);
        const step = dt / steps;
        for (let i = 0; i < steps; i++) {
          item.velocity += ((item.target - item.value) * 260 - item.velocity * 24) * step;
          item.value += item.velocity * step;
        }
        if (Math.abs(item.target - item.value) < .001 && Math.abs(item.velocity) < .001) {
          item.value = item.target;
          item.velocity = 0;
        } else settling = true;
        item.el.style.setProperty("--nav-dock", item.value.toFixed(4));
      });
      frame = settling ? requestAnimationFrame(animate) : 0;
    }

    function updateTargets() {
      if (!enabled()) {
        cancelAnimationFrame(frame);
        frame = 0;
        pointerX = null;
        items.forEach(item => {
          item.value = item.velocity = item.target = 0;
          item.el.style.removeProperty("--nav-dock");
        });
        return;
      }
      const centers = links.map(el => {
        const rect = el.getBoundingClientRect();
        return rect.left + rect.width / 2;
      });
      const origin = pointerX ?? centers[links.indexOf(focused)];
      items.forEach((item, i) => {
        const proximity = Number.isFinite(origin) ? Math.max(0, 1 - Math.abs(origin - centers[i]) / 140) : 0;
        item.target = proximity * proximity * (3 - 2 * proximity);
      });
      if (!frame) {
        lastTime = performance.now();
        frame = requestAnimationFrame(animate);
      }
    }

    nav.addEventListener("pointermove", event => {
      if (!enabled() || !finePointer.matches || event.pointerType === "touch") return;
      // Keep motion local to the navigation controls, away from the logo.
      const first = links[0].getBoundingClientRect();
      const last = links[links.length - 1].getBoundingClientRect();
      pointerX = event.clientX >= first.left - 24 && event.clientX <= last.right + 24 ? event.clientX : null;
      updateTargets();
    }, { passive: true });
    nav.addEventListener("pointerleave", () => { pointerX = null; updateTargets(); });
    nav.addEventListener("focusin", event => {
      focused = links.includes(event.target) && event.target.matches(":focus-visible") ? event.target : null;
      updateTargets();
    });
    nav.addEventListener("focusout", () => { focused = null; updateTargets(); });
    addEventListener("blur", () => { pointerX = null; focused = null; updateTargets(); });
    addEventListener("resize", () => { pointerX = null; updateTargets(); }, { passive: true });
    desktop.addEventListener("change", updateTargets);
    motionPreference.addEventListener("change", updateTargets);
    finePointer.addEventListener("change", () => { pointerX = null; updateTargets(); });
  })();

  /* ---------- Industries reel ----------
     The section is pinned while you scroll through it, and the six names move up
     through the gold bar in step with the scroll, easing into each name. Each name
     appears once: they sit in a loop round the bar, so a name leaving the top fades
     out and comes back in at the bottom. Inside the tilted bar the names move along
     the page's vertical, so the text stays centred in the bar. */
  (() => {
    const mobileReel = matchMedia("(max-width: 760px)");
    const section = $("#capabilities");
    if (!section) return;
    const faded = $$(".cap-words:not(.cap-words--lit) li", section);
    const lit = $$(".cap-words--lit li", section);
    const bar = $(".cap-bar", section);
    const n = faded.length;
    section.style.setProperty("--cap-steps", n - 1);
    section.classList.add("is-pinned");
    const ease = t => t * t * (3 - 2 * t);
    // a name's place relative to the bar, in rows, wrapped into the loop: -3 (top) to 3 (bottom)
    const offset = (k, pos) => { let o = ((k - pos) % n + n) % n; if (o > n / 2) o -= n; return o; };
    const fade = d => d <= 2 ? 1 - d * .17 : Math.max(0, .66 * (3 - d));
    let row = 0, last = -1, queued = false;
    function render() {
      queued = false;
      const r = section.getBoundingClientRect();
      // On phones the section flows with the page. Advance the reel while its
      // highlighted row travels between the lower and upper viewport edges.
      const center = bar.getBoundingClientRect();
      const progress = mobileReel.matches
        ? (innerHeight * 0.84 - center.top - center.height / 2) / (innerHeight * 0.60)
        : -r.top / Math.max(1, r.height - innerHeight);
      const p = Math.min(Math.max(progress, 0), 1) * (n - 1);
      const i = Math.min(Math.floor(p), n - 2);
      const t = ease(p - i);
      const pos = i + t;
      if (Math.abs(pos - last) < .0005) return;
      last = pos;
      const deg = -2 + Math.sin(t * Math.PI) * 1.4;
      const rad = deg * Math.PI / 180, sin = Math.sin(rad), cos = Math.cos(rad);
      bar.style.transform = `rotate(${deg}deg)`;
      for (let k = 0; k < n; k++) {
        const o = offset(k, pos);
        const dy = (o - k) * row; // from the name's own place in the list to its place in the loop
        faded[k].style.transform = `translate3d(0, ${dy}px, 0)`;
        faded[k].style.opacity = fade(Math.abs(o));
        lit[k].style.transform = `translate3d(${o * row * sin}px, ${o * row * cos - k * row}px, 0)`;
      }
    }
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(render); } };
    const measure = () => { row = faded[0].getBoundingClientRect().height; last = -1; queue(); };
    addEventListener("scroll", queue, { passive: true });
    addEventListener("resize", measure, { passive: true });
    measure();
    if (document.fonts) document.fonts.ready.then(measure);
  })();

  /* ---------- Liquid formulation study ----------
     A small texture with GPU refraction, rather than a large autoplay video.
     The original image remains visible if WebGL is unavailable. */
  (() => {
    const scene = $("#liquidScene");
    const section = scene.closest("section");
    const copy = $(".split-panel__text", section);
    const cards = $(".tailor", section);
    const label = $(".liquid-scene__top", scene);
    const caption = $(".liquid-scene__bottom", scene);
    const canvas = $(".liquid-scene__canvas", scene);
    const image = $(".liquid-scene__image", scene);
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const sideBySide = matchMedia("(min-width: 861px)");
    const heading = $("#tailor-title", copy);
    // Artwork box in CSS px, relative to the scene. `swirl` is where the liquid sits inside
    // its square image (fractions), measured once the image loads.
    const art = { x: 0, y: 0, size: 0, swirl: { top: 0, bottom: 1, left: 0, right: 1 } };

    // Gap between the heading's box and the top of its capital letters (half the line's extra leading
    // plus the space above the caps), so the swirl lines up with the ink rather than the box.
    const headingInk = () => {
      const cs = getComputedStyle(heading), size = parseFloat(cs.fontSize);
      const line = parseFloat(cs.lineHeight) || size * 1.2;
      return (line - size) / 2 + size * 0.2;
    };
    // Layout position on the page, ignoring the reveal transforms.
    const pageTop = (el) => { let y = 0; for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return y; };

    // Sit the caption level with the bottom of the cards beside it, start the swirl level
    // with the top of "Tailor-made", and keep it clear of the label and the caption.
    function place() {
      const side = sideBySide.matches;
      if (side) {
        const below = pageTop(section) + section.offsetHeight - pageTop(cards) - cards.offsetHeight;
        scene.style.setProperty("--caption-bottom", Math.max(24, below) + "px");
      } else {
        scene.style.removeProperty("--caption-bottom");
      }
      const s = art.swirl;
      const clear = label.offsetTop + label.offsetHeight + 16;
      const from = side ? Math.max(clear, pageTop(heading) - pageTop(scene) + headingInk()) : clear;
      // Side by side the swirl is allowed down alongside the caption so it can fill the panel.
      const to = side ? caption.offsetTop + caption.offsetHeight * 0.3 : caption.offsetTop - 16;
      const across = side ? 0.98 : 0.92;
      art.size = Math.max(0, Math.min((scene.clientWidth * across) / (s.right - s.left), (to - from) / (s.bottom - s.top)));
      art.x = scene.clientWidth / 2 - ((s.left + s.right) / 2) * art.size;
      // Side by side the swirl's top meets the heading; stacked, it is centred between label and caption.
      const spare = side ? 0 : (to - from - (s.bottom - s.top) * art.size) / 2;
      art.y = from + spare - s.top * art.size;
      scene.style.setProperty("--art-x", art.x + "px");
      scene.style.setProperty("--art-y", art.y + "px");
      scene.style.setProperty("--art-size", art.size + "px");
      scene.classList.add("is-placed");
    }
    let resize = () => {};
    const layout = () => { place(); resize(); };
    const observer = new ResizeObserver(layout);
    [scene, ...copy.children].forEach((el) => observer.observe(el));
    sideBySide.addEventListener("change", layout);
    place();

    const options = { alpha: false, antialias: false, depth: false, powerPreference: "low-power" };
    const gl = canvas.getContext("webgl2", options) || canvas.getContext("webgl", options);
    if (!gl) return;

    function shader(type, source) {
      const value = gl.createShader(type);
      gl.shaderSource(value, source);
      gl.compileShader(value);
      if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) {
        gl.deleteShader(value);
        return null;
      }
      return value;
    }
    const vertex = shader(gl.VERTEX_SHADER, `
      attribute vec2 position;
      varying vec2 uv;
      void main() { uv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
    `);
    const fragment = shader(gl.FRAGMENT_SHADER, `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      varying vec2 uv;
      uniform sampler2D artwork;
      uniform float phase;
      uniform vec4 box; // artwork position and size, in canvas UV
      const vec3 cream = vec3(0.957, 0.945, 0.910);
      void main() {
        vec2 p = (uv - box.xy) / box.zw;
        // Gentle local refraction makes the liquid bend and droplets drift.
        p.x += 0.014 * sin(p.y * 9.0 + phase) + 0.006 * sin(p.y * 17.0 - phase * 2.0);
        p.y += 0.012 * sin(p.x * 8.0 - phase) + 0.005 * cos(p.x * 14.0 + phase * 2.0);
        // Lift the artwork's near-white (253-255) background to pure white so no box shows.
        // Sampled outside any branch so mipmap selection stays smooth at the artwork's edge.
        vec3 colour = min(texture2D(artwork, p).rgb * 1.008, 1.0);
        float inside = step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0);
        colour = mix(vec3(1.0), colour, inside);
        // Multiply onto the page cream here, so the opaque canvas fully covers the still image.
        gl_FragColor = vec4(colour * cream, 1.0);
      }
    `);
    if (!vertex || !fragment) return;
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const phase = gl.getUniformLocation(program, "phase");
    const box = gl.getUniformLocation(program, "box");
    gl.uniform1i(gl.getUniformLocation(program, "artwork"), 0);

    let loaded = false, visible = false, lost = false;
    let frame = 0, elapsed = 0, previous = 0;
    const canAnimate = () => loaded && visible && !motion.matches && !document.hidden && !lost;
    function paint() {
      if (!loaded || lost) return;
      gl.uniform1f(phase, (elapsed % 20000) * Math.PI / 10000);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    function tick(now) {
      frame = 0;
      if (!canAnimate()) { previous = 0; return; }
      // Cap at 30 fps and avoid jumps after leaving the viewport.
      if (!previous || now - previous >= 32) {
        elapsed += previous ? Math.min(now - previous, 64) : 0;
        previous = now;
        paint();
      }
      frame = requestAnimationFrame(tick);
    }
    function sync() {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      if (canAnimate()) frame = requestAnimationFrame(tick);
      else paint();
    }
    resize = () => {
      const bounds = scene.getBoundingClientRect();
      // Full device resolution keeps the fine droplets crisp on retina screens.
      const scale = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(bounds.width * scale));
      canvas.height = Math.max(1, Math.round(bounds.height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform4f(box, art.x / bounds.width, 1 - (art.y + art.size) / bounds.height, art.size / bounds.width, art.size / bounds.height);
      paint();
    };
    // Find the liquid inside its near-white square, so its visible top (not the image edge) lines up.
    function measureSwirl() {
      const n = 128, c = document.createElement("canvas");
      c.width = c.height = n;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(image, 0, 0, n, n);
      const px = g.getImageData(0, 0, n, n).data;
      let t = n, b = -1, l = n, r = -1;
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const i = (y * n + x) * 4;
          if (Math.min(px[i], px[i + 1], px[i + 2]) > 232) continue;
          t = Math.min(t, y); b = Math.max(b, y); l = Math.min(l, x); r = Math.max(r, x);
        }
      }
      if (b > t && r > l) art.swirl = { top: t / n, bottom: (b + 1) / n, left: l / n, right: (r + 1) / n };
    }
    function load() {
      if (loaded || !image.naturalWidth || lost) return;
      // WebGL2 can mipmap this non-power-of-two texture, so it stays smooth when drawn small.
      const mipmaps = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      } catch { return; }
      if (mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
      measureSwirl();
      loaded = true;
      place();
      resize();
      scene.classList.add("is-ready");
      sync();
    }
    image.addEventListener("load", load, { once: true });
    if (image.complete) load();
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(scene);
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    canvas.addEventListener("webglcontextlost", () => {
      lost = true;
      scene.classList.remove("is-ready");
      sync();
    });
  })();

  /* ---------- Ticker ----------
     A steady drift of about one letter every half second, whatever the screen size. */
  (() => {
    const track = $(".ticker__track");
    if (!track) return;
    const group = $(".ticker__group", track);
    const setSpeed = () => {
      const em = parseFloat(getComputedStyle(group).fontSize);
      track.style.setProperty("--ticker-dur", (group.offsetWidth / (em * 1.1)).toFixed(1) + "s");
    };
    setSpeed();
    addEventListener("resize", setSpeed, { passive: true });
    if (document.fonts) document.fonts.ready.then(setSpeed);
  })();

})();
