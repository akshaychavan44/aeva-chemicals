/* Editable content: loads what the admin panel saved in Supabase and rebuilds the
   product lists, product pages and job openings with the same markup as the HTML.
   If Supabase isn't set up (cms-config.js) or can't be reached, the pages keep the
   content written into their HTML. The admin panel reuses AevaCMS.render for previews. */
(() => {
  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const EMAIL = "info@aevachemicals.com";

  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const lines = v => esc(v).replace(/\n/g, "<br>");
  // only ordinary links: pages and files on the site, web addresses, email and phone
  const href = v => {
    const s = String(v ?? "").trim();
    return /^(https?:|mailto:|tel:|#|[\w./-])/i.test(s) && !/^\s*javascript:/i.test(s) ? esc(s) : "#";
  };
  const mail = (subject, to = EMAIL) => `mailto:${to}?subject=${encodeURIComponent(subject)}`;
  const pad = n => String(n).padStart(2, "0");
  const slug = v => String(v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const list = v => (Array.isArray(v) ? v : []);

  /* ---------- What we do: the six industries ---------- */
  function renderWhatWeDo(data) {
    const industries = list(data && data.industries);
    industries.forEach((ind, i) => {
      const id = ind.id;
      const tab = document.querySelector(`[data-industry-tab="${id}"]`);
      if (tab) tab.innerHTML = `<i>${pad(i + 1)}</i>${esc(ind.name)}`;
      const tile = document.querySelector(`.pr-tile[data-pick-industry="${id}"]`);
      if (tile) {
        const strong = tile.querySelector("strong"), small = tile.querySelector("small");
        if (strong) strong.textContent = ind.name;
        if (small) small.textContent = `${ind.count} product types`;
      }
      const panel = document.querySelector(`[data-industry-panel="${id}"]`);
      if (!panel) return;
      const groups = list(ind.groups);
      const split = groups.length > 1;
      let html = `<div class="pr-banner"><div class="pr-banner__copy"><p class="sp-eyebrow">Industry ${pad(i + 1)} of ${pad(industries.length)}</p><h3>${esc(ind.name)}</h3><p>${esc(ind.description)}</p></div><p class="pr-banner__count"><b>${esc(ind.count)}</b>product types</p></div>`;
      if (split) {
        html += `<div class="pr-tabs pr-tabs--small pr-subtabs" aria-label="Filter ${esc(String(ind.name).toLowerCase())} products by stage"><button class="pr-tab" type="button" aria-selected="true" data-group-tab="all">All</button>`
          + groups.map(g => `<button class="pr-tab" type="button" aria-selected="false" data-group-tab="${esc(slug(g.title))}">${esc(g.title)}</button>`).join("")
          + "</div>";
      }
      html += groups.map(g => {
        const products = list(g.products);
        const head = `<div class="pr-group__head">${g.number ? `<span class="sp-num">${esc(g.number)}</span>` : ""}<h4>${esc(g.title)}</h4><p>${esc(g.description)}</p><small>${esc(g.countLabel || `${products.length} types`)}</small></div>`;
        const items = products.map(p => `<article class="pr-product"><h5>${esc(p.name)}</h5><p>${esc(p.description)}</p><a class="sp-link" href="${esc(mail(`Enquiry: ${p.name}`))}">Enquire${ARROW}</a></article>`).join("");
        return `<div class="pr-group"${split ? ` data-group="${esc(slug(g.title))}"` : ""}>${head}<div class="pr-products">${items}</div></div>`;
      }).join("");
      const more = ind.more || {};
      if (more.text || more.linkText) {
        html += `<p class="pr-more">${esc(more.text)}${more.linkText ? ` <a class="sp-link" href="${esc(mail(`Enquiry: ${ind.name} product list`))}">${esc(more.linkText)}${ARROW}</a>` : ""}</p>`;
      }
      panel.innerHTML = html;
    });
  }

  /* ---------- Home page product cards ---------- */
  function renderHomeProducts(data, el) {
    el.innerHTML = list(data && data.cards).map(c => {
      const media = c.image ? `<figure class="product-overview__media"><img src="${href(c.image)}" alt="${esc(c.imageAlt)}" width="1254" height="1254" loading="lazy" decoding="async"></figure>` : "";
      return `<a class="product-overview__card" href="${href(c.link)}">${media}<div class="product-overview__copy"><p class="p-label">${esc(c.label)}</p><h3>${esc(c.name)}</h3><p>${esc(c.description)}</p><span class="product-overview__link">View product <span aria-hidden="true">↗</span></span></div></a>`;
    }).join("");
  }

  /* ---------- AeSop and AeKomala pages ---------- */
  function renderProductPage(d, el) {
    if (!d) return;
    const app = d.application || {}, profile = d.profile || {}, docs = d.documents || {};
    el.innerHTML = `<div class="p-breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><a href="index.html#products">What we do</a><span aria-hidden="true">/</span><span>${esc(d.name)}</span></div>
<section class="p-hero" aria-labelledby="product-title"><div class="p-hero__copy"><p class="p-label">${esc(d.label)}</p><h1 id="product-title">${esc(d.name)}</h1><p class="p-category">${esc(d.category)}</p><h2>${lines(d.headline)}</h2><p class="p-description">${esc(d.description)}</p><div class="p-actions"><a class="btn btn--primary" href="${esc(mail(`${d.name} trial sample`))}">Request a sample <span aria-hidden="true">↗</span></a><a class="p-text-link" href="#technical">View technical details <span aria-hidden="true">↓</span></a></div>${d.suppliedAs ? `<p class="p-form">SUPPLIED AS <strong>${esc(d.suppliedAs)}</strong></p>` : ""}</div>
</section>
<section class="p-benefits" aria-label="Product benefits">${list(d.benefits).map((b, i) => `<article><span class="p-index">${pad(i + 1)}</span><h3>${esc(b.title)}</h3><p>${esc(b.text)}</p></article>`).join("")}</section>
<section class="p-technical" id="technical"><div><p class="p-label">PRODUCT PROFILE</p><h2>${lines(profile.title)}</h2><p>${esc(profile.text)}</p></div><dl>${list(d.technical).map(t => `<div><dt>${esc(t.term)}</dt><dd>${esc(t.value)}</dd></div>`).join("")}</dl></section>
<section class="p-application"><div class="p-section-head"><p class="p-label">APPLICATION GUIDANCE</p><h2>${lines(app.title)}</h2></div><ol class="p-steps">${list(app.steps).map((s, i) => `<li><span class="p-index">${pad(i + 1)}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join("")}</ol><div class="p-dosage"><h3>${esc(app.dosageTitle)}</h3><table><caption class="p-sr">${esc(d.name)} dosage and application starting conditions</caption><tbody>${list(app.dosage).map(r => `<tr><th scope="row">${esc(r.label)}</th><td>${esc(r.value)}</td></tr>`).join("")}</tbody></table></div>${app.note ? `<p class="p-note">${esc(app.note)}</p>` : ""}</section>
<section class="p-documents"><div><p class="p-label">DOCUMENTATION</p><h2>${lines(docs.title)}</h2></div><div class="p-document-links">${list(docs.links).map(l => {
      const external = !/^(mailto:|tel:|#)/i.test(String(l.url || ""));
      return `<a href="${href(l.url)}"${external ? ' target="_blank" rel="noopener"' : ""}>${esc(l.label)} <span aria-hidden="true">↗</span></a>`;
    }).join("")}</div></section>`;
    if (d.name) document.title = document.title.replace(/^[^—|]+/, `${d.name} `);
  }

  /* ---------- Careers ---------- */
  function renderCareers(d, el) {
    if (!d) return;
    const email = d.email || EMAIL, intro = d.intro || {};
    const hero = el.querySelector(".careers__hero"), jobs = el.querySelector(".careers__jobs");
    if (hero) hero.innerHTML = `<p class="eyebrow">Careers</p><h1>${esc(intro.title)}</h1><p>${esc(intro.text)}</p>`;
    if (jobs) {
      const roles = list(d.roles);
      jobs.innerHTML = `<h2>Open roles</h2>`
        + (roles.length
          ? roles.map(r => `<article class="job"><div><h3>${esc(r.title)}</h3><p class="job__meta">${esc(r.meta)}</p><p>${esc(r.description)}</p></div><a class="btn btn--light" href="${esc(mail(`${r.title} application`, email))}"><span class="roll">Apply</span></a></article>`).join("")
          : `<p class="careers__empty">There are no open roles right now.</p>`)
        + `<p class="careers__note">Don't see your role? Send your CV to <a href="${esc(mail("Career inquiry", email))}">${esc(email)}</a>.</p>`;
    }
  }

  /* render whatever editable sections this page has */
  function render(content) {
    if (content.whatwedo && document.querySelector('[data-cms="whatwedo"]')) renderWhatWeDo(content.whatwedo);
    document.querySelectorAll('[data-cms="home_products"]').forEach(el => content.home_products && renderHomeProducts(content.home_products, el));
    document.querySelectorAll('[data-cms^="page_"]').forEach(el => renderProductPage(content[el.dataset.cms], el));
    document.querySelectorAll('[data-cms="careers"]').forEach(el => renderCareers(content.careers, el));
  }
  window.AevaCMS = { render };

  const cfg = window.AEVA_CMS || {};
  const ready = () => document.documentElement.classList.remove("cms-wait");
  if (!cfg.url || !cfg.anonKey || !document.querySelector("[data-cms]")) { ready(); return; }
  fetch(`${cfg.url.replace(/\/$/, "")}/rest/v1/site_content?select=key,data`, {
    headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` },
  })
    .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then(rows => {
      const content = {};
      rows.forEach(row => { content[row.key] = row.data; });
      render(content);
    })
    .catch(err => console.warn("Aeva CMS: showing the content built into the page.", err))
    .finally(ready);
})();
