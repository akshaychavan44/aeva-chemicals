/* ---------- Footer: halftone wordmark ----------
     The name is set huge along the bottom edge and printed as dots sized by
     how much letter covers each cell. Dots part around the pointer on springs,
     warming to gold as they are pushed; a click sends a ring through the word. */
  (() => {
    const root = document.querySelector(".hwf-root");
    const canvas = root?.querySelector(".hwf-canvas");
    const ctx = canvas && canvas.getContext("2d");
    if (!ctx) return;
    const css = getComputedStyle(root); // the footer's own --hwf-bg / --hwf-ink
    const hex = (v) => { const h = v.trim().replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
    const bg = css.getPropertyValue("--hwf-bg").trim();
    const inkHex = css.getPropertyValue("--hwf-ink").trim();
    const ink = hex(inkHex), warm = hex(css.getPropertyValue("--gold"));
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const WORD = "Aeva Chemicals", RADIUS = 80;
    let w = 0, h = 0, dpr = 1, px = -1e5, py = -1e5, raf = 0, visible = true, awake = true;
    let ring = { x: 0, y: 0, t: -1 };
    let dots = new Float32Array(0), count = 0, grain = null; // x, y, vx, vy, hx, hy, r per dot

    function layout() {
      const rect = root.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      // Set the word once on a 1x mask, sized to fill the width.
      const mask = document.createElement("canvas");
      mask.width = w; mask.height = h;
      const m = mask.getContext("2d", { willReadFrequently: true });
      m.font = '700 100px "Jost", system-ui, sans-serif';
      const size = (w * 1.0 / m.measureText(WORD).width) * 100;
      m.font = '700 ' + size + 'px "Jost", system-ui, sans-serif';
      const box = m.measureText(WORD);
      // Whole word sits right on the bottom edge (letters' lowest ink at the last dot row).
      m.fillText(WORD, (w - box.width) / 2, h - (box.actualBoundingBoxDescent || 0) - 1);
      const img = m.getImageData(0, 0, w, h).data;
      const gap = w < 700 ? 4 : 6;
      const cols = Math.ceil(w / gap), rows = Math.ceil(h / gap), tmp = [];
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          let sum = 0; // coverage: average alpha over a 3x3 sample of the cell
          for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
            const x = Math.min(w - 1, Math.floor(gx * gap + (sx + 0.5) * gap / 3));
            const y = Math.min(h - 1, Math.floor(gy * gap + (sy + 0.5) * gap / 3));
            sum += img[(y * w + x) * 4 + 3];
          }
          const cov = sum / (9 * 255);
          if (cov < 0.06) continue;
          const hx = gx * gap + gap / 2, hy = gy * gap + gap / 2;
          tmp.push(hx, hy, 0, 0, hx, hy, Math.sqrt(cov) * gap * 0.56); // area-true radius
        }
      }
      dots = new Float32Array(tmp);
      count = tmp.length / 7;
      // A fixed tile of print grain laid over every frame.
      grain = document.createElement("canvas");
      grain.width = grain.height = 256;
      const g = grain.getContext("2d"), id = g.createImageData(256, 256);
      for (let i = 0; i < id.data.length; i += 4) {
        id.data[i] = id.data[i + 1] = id.data[i + 2] = Math.random() * 255;
        id.data[i + 3] = Math.random() < 0.5 ? 0 : 255;
      }
      g.putImageData(id, 0, 0);
      awake = true;
    }

    function draw(now) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      const r = reduced ? 0 : RADIUS;
      const age = ring.t < 0 ? 1e9 : now - ring.t, ringR = age * 0.9;
      let moving = false;
      for (let i = 0; i < count; i++) {
        const j = i * 7;
        let x = dots[j], y = dots[j + 1], vx = dots[j + 2], vy = dots[j + 3];
        const hx = dots[j + 4], hy = dots[j + 5];
        if (!reduced) {
          if (age < 900) { // click shock ring
            const dx = hx - ring.x, dy = hy - ring.y, d = Math.hypot(dx, dy) + 0.001;
            const band = 1 - Math.min(1, Math.abs(d - ringR) / 26);
            if (band > 0) { const f = band * 3.2 * (1 - age / 900); vx += dx / d * f; vy += dy / d * f; }
          }
          const dx = x - px, dy = y - py, d2 = dx * dx + dy * dy;
          if (r > 0 && d2 < r * r) { const d = Math.sqrt(d2) + 0.001, f = (1 - d / r) * 2.6; vx += dx / d * f; vy += dy / d * f; }
          vx = (vx + (hx - x) * 0.05) * 0.84; // spring home
          vy = (vy + (hy - y) * 0.05) * 0.84;
          x += vx; y += vy;
          if (Math.abs(vx) + Math.abs(vy) > 0.02 || Math.abs(x - hx) + Math.abs(y - hy) > 0.05) moving = true;
          else { x = hx; y = hy; vx = vy = 0; }
          dots[j] = x; dots[j + 1] = y; dots[j + 2] = vx; dots[j + 3] = vy;
        }
        const k = Math.min(1, Math.hypot(x - hx, y - hy) / 28);
        ctx.fillStyle = k > 0.02
          ? "rgb(" + Math.round(ink[0] + (warm[0] - ink[0]) * k) + "," + Math.round(ink[1] + (warm[1] - ink[1]) * k) + "," + Math.round(ink[2] + (warm[2] - ink[2]) * k) + ")"
          : inkHex;
        ctx.beginPath();
        ctx.arc(x, y, dots[j + 6], 0, 6.2832);
        ctx.fill();
      }
      if (grain) {
        ctx.globalAlpha = 0.045;
        ctx.globalCompositeOperation = "overlay";
        ctx.fillStyle = ctx.createPattern(grain, "repeat");
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
      awake = moving || age < 900 || px > -1e4; // sleep once everything is home
    }

    const loop = (now) => { raf = 0; if (!visible) return; draw(now); if (awake) raf = requestAnimationFrame(loop); };
    const wake = () => { awake = true; if (!raf && visible) raf = requestAnimationFrame(loop); };
    const local = (e) => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    root.addEventListener("pointermove", (e) => { [px, py] = local(e); wake(); });
    root.addEventListener("pointerleave", () => { px = py = -1e5; wake(); });
    root.addEventListener("pointerdown", (e) => {
      if (reduced || e.target.closest("a,button")) return;
      const [x, y] = local(e);
      ring = { x, y, t: performance.now() };
      wake();
    });
    new ResizeObserver(() => { layout(); wake(); }).observe(root);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); }).observe(root);
    // Re-set the word once Jost has loaded.
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { layout(); wake(); });
  })();
