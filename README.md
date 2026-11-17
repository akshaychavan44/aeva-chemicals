# Aeva Chemicals — website

Marketing site for Aeva Chemicals, makers of textile auxiliaries for reactive dyeing: AeSop (low-temperature soaping agent) and AeKomala (cationic softener).

Plain static site, no build step.

| File | What it is |
| --- | --- |
| `index.html`, `styles.css`, `script.js` | Home page: preloader, hero (AeSop pour scrubbed on scroll from `assets/hero-frames/`), Tailor-made (WebGL liquid), capabilities, products, About (scroll-driven flask), halftone footer |
| `aesop.html`, `aekomala.html` | Product pages, styled by `product-pages.css` with `product-pages.js` for the menu |
| `assets/` | Company film, formulation artwork, product brochures and SDS |

When you change a CSS or JS file, bump its `?v=` in the HTML so browsers pick up the new copy.

## Run locally

```bash
pnpm dev        # or: node dev.js
```

Opens on http://localhost:5288 (set `PORT` to change it; a busy port moves to the next one).
