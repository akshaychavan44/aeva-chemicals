(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const show = id => {
    document.querySelectorAll(".screen").forEach(s => { s.hidden = s.id !== id; });
  };

  async function request(query = "", body) {
    try {
      const response = await fetch("../api/cms" + query, body ? {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      } : {});
      const result = await response.json();
      if (!response.ok) return { error: result.error || "The request failed." };
      return { data: result };
    } catch {
      return { error: "The admin API is unavailable. Open this page on the Vercel deployment." };
    }
  }

  /* ---------------- what can be edited ---------------- */
  const T = (key, label, extra = {}) => ({ key, label, type: "text", ...extra });
  const A = (key, label, extra = {}) => ({ key, label, type: "textarea", rows: 3, ...extra });

  const SECTIONS = [
    { key: "whatwedo", nav: "Products", sub: "What we do page", page: "../products.html#range",
      intro: "The six industries on the What we do page. Add, change or remove product groups and products, and update the product counts.",
      schema: { type: "object", fields: [
        { key: "industries", label: "Industries", type: "list", fixed: true, itemTitle: "name", item: [
          T("name", "Industry name"),
          { key: "count", label: "Number of product types", type: "number", help: "Shown on the industry tile and banner." },
          A("description", "Short description", { rows: 2 }),
          { key: "groups", label: "Product groups", type: "list", singular: "group", itemTitle: "title",
            help: "One group shows as a single list. With two or more groups, visitors get filter buttons such as Pre-treatment and Dyeing.",
            item: [
              T("title", "Group name"),
              T("number", "Stage number", { help: "Optional, for example 02." }),
              A("description", "Group description", { rows: 2 }),
              T("countLabel", "Count label", { help: "Optional. Leave empty to show the number of products, for example “9 types”." }),
              { key: "products", label: "Products", type: "list", singular: "product", itemTitle: "name",
                item: [T("name", "Product name"), A("description", "What it does", { rows: 2 })] },
            ] },
          { key: "more", label: "Note under the list", type: "object", fields: [
            A("text", "Note", { rows: 2 }),
            T("linkText", "Email link text", { help: "Opens an email to info@aevachemicals.com. Leave empty for no link." }),
          ] },
        ] },
      ] } },
    { key: "home_products", nav: "Home page cards", sub: "Product cards", page: "../index.html#products",
      intro: "The product cards in “Our product range” on the home page.",
      schema: { type: "object", fields: [
        { key: "cards", label: "Cards", type: "list", singular: "card", itemTitle: "name", item: [
          T("name", "Product name"),
          T("label", "Label above the name", { help: "For example: Low-temperature soaping agent" }),
          A("description", "Description"),
          T("link", "Card link", { help: "The page the card opens, for example aesop.html" }),
          { key: "image", label: "Photo", type: "image" },
          T("imageAlt", "Photo description", { help: "Describes the photo for screen readers and search engines." }),
        ] },
      ] } },
    { key: "careers", nav: "Careers", sub: "Job openings", page: "../careers.html",
      intro: "The introduction and open roles on the Careers page.",
      schema: { type: "object", fields: [
        { key: "intro", label: "Page introduction", type: "object", fields: [T("title", "Heading"), A("text", "Introduction")] },
        T("email", "Applications email", { type: "email", help: "Apply buttons open an email to this address." }),
        { key: "roles", label: "Open roles", type: "list", singular: "role", itemTitle: "title",
          help: "With no roles, the page says “There are no open roles right now.”",
          item: [T("title", "Job title"), T("meta", "Team and location", { help: "For example: Lab · Mumbai" }), A("description", "Short description")] },
      ] } },
  ];

  /* ---------------- form builder ---------------- */
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    });
    kids.flat().forEach(k => k != null && n.append(k));
    return n;
  };
  let uid = 0;
  const ICON = {
    up: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    down: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    remove: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 7h14M10 11v6M14 11v6M7 7l1 12h8l1-12M9 7V4h6v3"/></svg>',
  };
  const iconBtn = (name, label, onclick, danger) => {
    const b = el("button", { type: "button", class: `icon-btn${danger ? " icon-btn--danger" : ""}`, "aria-label": label, title: label, onclick });
    b.innerHTML = ICON[name];
    return b;
  };

  const blank = fields => Object.fromEntries(fields.flatMap(f => {
    if (f.flat) return Object.entries(blank(f.fields));
    if (f.type === "list") return [[f.key, []]];
    if (f.type === "object") return [[f.key, blank(f.fields)]];
    if (f.type === "number") return [[f.key, 0]];
    return [[f.key, ""]];
  }));

  // returns { node, get } for a field; get() gives back the edited value
  function build(field, value, changed) {
    const help = field.help ? el("small", { text: field.help }) : null;

    if (field.type === "object") {
      const src = value && typeof value === "object" ? value : {};
      const parts = field.fields.map(f => ({ f, b: build(f, f.flat ? src : src[f.key], changed) }));
      const nodes = parts.map(p => p.b.node);
      const node = field.label && !field.root
        ? el("fieldset", { class: "group" }, el("legend", { text: field.label }), help, nodes)
        : el("div", { class: "group-plain" }, nodes);
      if (field.root) node.style.display = "contents";
      return {
        node,
        get: () => {
          // keep anything the form doesn't show (for example an industry's id); a flat group only returns its own fields
          const out = field.flat ? {} : { ...src };
          parts.forEach(({ f, b }) => { if (f.flat) Object.assign(out, b.get()); else out[f.key] = b.get(); });
          return out;
        },
      };
    }

    if (field.type === "list") return buildList(field, Array.isArray(value) ? value : [], changed);

    if (field.type === "image") return buildImage(field, value || "", changed);

    const id = `f${++uid}`;
    const input = field.type === "textarea"
      ? el("textarea", { id, rows: field.rows || 3 })
      : el("input", { id, type: field.type === "number" ? "number" : (field.type === "email" ? "email" : "text"), min: field.type === "number" ? 0 : null });
    input.value = value ?? "";
    input.addEventListener("input", changed);
    return {
      node: el("label", { class: "field", for: id }, el("span", { text: field.label }), input, help),
      get: () => (field.type === "number" ? Number(input.value) || 0 : input.value.trim()),
      input,
    };
  }

  function buildList(field, values, changed) {
    const items = [];
    const box = el("div", { class: "list__items" });
    const empty = el("p", { class: "list__empty", text: `No ${field.singular || "item"}s yet.` });
    const count = el("small");
    const refresh = () => {
      empty.hidden = items.length > 0;
      count.textContent = `${items.length} ${field.singular || "item"}${items.length === 1 ? "" : "s"}`;
      items.forEach((it, i) => {
        if (!it.up) return;
        it.up.disabled = i === 0;
        it.down.disabled = i === items.length - 1;
      });
    };
    const addItem = (value, open) => {
      const body = build({ type: "object", fields: field.item, root: true }, value, changed);
      const title = el("span", { class: "item__title" });
      const titleInput = () => body.get()[field.itemTitle];
      const setTitle = () => {
        const t = String(titleInput() || "").trim();
        title.textContent = t || `New ${field.singular || "item"}`;
        title.classList.toggle("is-empty", !t);
      };
      const it = { body };
      const tools = el("span", { class: "item__tools" });
      if (!field.fixed) {
        it.up = iconBtn("up", "Move up", e => { e.preventDefault(); move(it, -1); });
        it.down = iconBtn("down", "Move down", e => { e.preventDefault(); move(it, 1); });
        tools.append(it.up, it.down, iconBtn("remove", `Remove this ${field.singular || "item"}`, e => {
          e.preventDefault();
          const name = String(titleInput() || "").trim();
          if (!confirm(`Remove ${name ? `“${name}”` : `this ${field.singular || "item"}`}?`)) return;
          items.splice(items.indexOf(it), 1);
          it.node.remove();
          refresh(); changed();
        }, true));
      }
      it.node = el("details", { class: "item", open: open || null },
        el("summary", {}, title, tools),
        el("div", { class: "item__body" }, body.node));
      it.node.addEventListener("input", setTitle);
      setTitle();
      items.push(it);
      box.append(it.node);
      return it;
    };
    const move = (it, dir) => {
      const i = items.indexOf(it), j = i + dir;
      if (j < 0 || j >= items.length) return;
      items.splice(i, 1); items.splice(j, 0, it);
      if (dir < 0) box.insertBefore(it.node, items[j + 1].node);
      else box.insertBefore(it.node, items[j - 1].node.nextSibling);
      refresh(); changed();
    };
    values.forEach(v => addItem(v, false));
    const add = field.fixed ? null : el("button", { type: "button", class: "btn btn--ghost btn--small add-btn", text: `+ Add ${field.singular || "item"}`, onclick: () => {
      const it = addItem(blank(field.item), true);
      refresh(); changed();
      const first = it.node.querySelector("input, textarea");
      if (first) first.focus();
    } });
    refresh();
    return {
      node: el("div", { class: "group list" },
        el("div", { class: "list__head" }, el("span", { class: "group__title", text: field.label }), count),
        field.help ? el("small", { class: "muted", text: field.help }) : null,
        box, empty, add),
      get: () => items.map(it => it.body.get()),
    };
  }

  function buildImage(field, value, changed) {
    const id = `f${++uid}`;
    const input = el("input", { id, type: "text", placeholder: "assets/your-photo.webp or https://…" });
    input.value = value;
    const preview = el("div", { class: "image-field__preview", role: "img", "aria-label": "Photo preview" });
    const status = el("small");
    const resolve = v => (/^(https?:|\/)/i.test(v) ? v : `../${v}`);
    const paint = () => { preview.style.backgroundImage = input.value ? `url("${resolve(input.value).replace(/"/g, "%22")}")` : "none"; };
    input.addEventListener("input", () => { paint(); changed(); });
    const file = el("input", { type: "file", accept: "image/jpeg,image/png,image/webp", hidden: true });
    file.addEventListener("change", async () => {
      const f = file.files[0];
      file.value = "";
      if (!f) return;
      if (f.size > 3 * 1024 * 1024) { status.textContent = "Please choose a photo up to 3 MB."; return; }
      status.textContent = "Uploading…";
      const reader = new FileReader();
      reader.onerror = () => { status.textContent = "Couldn’t read the photo."; };
      reader.onload = async () => {
        const { data, error } = await request("", { action: "upload", image: reader.result.split(",")[1] });
        if (error) { status.textContent = `Upload failed: ${error}`; return; }
        input.value = data.url;
        status.textContent = "Uploaded. Save changes to show it on the website.";
        paint(); changed();
      };
      reader.readAsDataURL(f);
    });
    paint();
    return {
      node: el("div", { class: "field" }, el("span", { text: field.label }),
        el("div", { class: "image-field" }, preview,
          el("div", { class: "image-field__controls" },
            el("div", { class: "image-field__row" },
              el("button", { type: "button", class: "btn btn--ghost btn--small", text: "Upload a photo", onclick: () => file.click() }),
              el("small", { class: "muted", text: "JPG, PNG or WebP, up to 3 MB. A square photo fits best." })),
            input, status, file))),
      get: () => input.value.trim(),
    };
  }

  /* ---------------- editor ---------------- */
  let saved = {};        // what is in the database, by key
  let fallback = null;   // the content built into the website, used until a section is first saved
  let current = null;    // { section, root }
  let dirty = false;

  const status = $("#save-status"), saveBtn = $("#save"), discardBtn = $("#discard");
  const setStatus = (text, kind = "") => { status.textContent = text; status.className = kind ? `is-${kind}` : ""; };
  const markDirty = () => {
    if (!dirty) { dirty = true; saveBtn.disabled = false; discardBtn.disabled = false; }
    setStatus("Unsaved changes", "dirty");
  };
  const markClean = text => { dirty = false; saveBtn.disabled = true; discardBtn.disabled = true; setStatus(text, text.startsWith("Saved") ? "ok" : ""); };
  addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  function renderNav() {
    const nav = $("#sidenav");
    nav.replaceChildren(...SECTIONS.map(s => el("button", {
      type: "button", "data-key": s.key, "aria-current": current && current.section.key === s.key ? "true" : "false",
      onclick: () => open(s.key),
    }, s.nav, el("small", { text: s.sub }))));
  }

  function open(key, force) {
    if (dirty && !force && !confirm("You have unsaved changes. Leave this section without saving?")) return;
    const section = SECTIONS.find(s => s.key === key) || SECTIONS[0];
    const data = saved[section.key] ?? (fallback && fallback[section.key]) ?? blank(section.schema.fields);
    const root = build({ ...section.schema, root: true }, structuredClone(data), markDirty);
    current = { section, root };
    $("#section-title").textContent = section.nav;
    $("#section-intro").textContent = section.intro;
    $("#section-view").href = section.page;
    const notice = $("#section-notice");
    notice.hidden = section.key in saved;
    notice.textContent = "This section hasn’t been saved here yet, so you’re seeing the content built into the website. Your first save takes over from it.";
    $("#editor-form").replaceChildren(root.node);
    renderNav();
    markClean(section.key in saved ? "All changes saved" : "No changes yet");
    try { localStorage.setItem("aeva-admin-section", section.key); } catch (e) { /* private mode */ }
    scrollTo({ top: 0 });
  }

  async function save() {
    if (!current) return;
    const { section, root } = current;
    const data = root.get();
    saveBtn.disabled = true;
    setStatus("Saving…");
    const { error } = await request("", { action: "save", key: section.key, data });
    if (error) {
      saveBtn.disabled = false;
      setStatus(`Not saved: ${error}`, "error");
      return;
    }
    saved[section.key] = data;
    $("#section-notice").hidden = true;
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    markClean(`Saved at ${time}. Refresh the website to see it.`);
  }

  saveBtn.addEventListener("click", save);
  discardBtn.addEventListener("click", () => { if (confirm("Undo all changes since your last save?")) open(current.section.key, true); });
  addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s" && current) { e.preventDefault(); if (dirty) save(); }
  });

  async function startEditor(user) {
    $("#who").textContent = user.email;
    show("screen-editor");
    setStatus("Loading…");
    const [{ data: rows, error }, base] = await Promise.all([
      request(),
      fetch("../data/content.json", { cache: "no-store" }).then(r => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    if (error) { setStatus(`Couldn’t load the content: ${error}`, "error"); return; }
    saved = Object.fromEntries(rows.map(r => [r.key, r.data]));
    fallback = base;
    let last = null;
    try { last = localStorage.getItem("aeva-admin-section"); } catch (e) { /* private mode */ }
    open(last || SECTIONS[0].key, true);
  }

  /* ---------------- sign in ---------------- */
  const loginForm = $("#login-form"), loginMsg = $("#login-message");
  const passwordField = $("#login-password"), passwordToggle = $("#password-toggle");

  function setPasswordVisible(visible) {
    passwordField.type = visible ? "text" : "password";
    passwordToggle.textContent = visible ? "Hide password" : "Show password";
  }

  passwordToggle.addEventListener("click", () => setPasswordVisible(passwordField.type === "password"));

  const say = (node, text, ok) => { node.textContent = text; node.hidden = !text; node.classList.toggle("is-ok", !!ok); };

  loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    const email = loginForm.email.value.trim(), password = passwordField.value;
    setPasswordVisible(false);
    if (!email || !password) { say(loginMsg, "Enter your email and password."); return; }
    const btn = loginForm.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Signing in…";
    const { data, error } = await request("", { action: "login", email, password });
    btn.disabled = false; btn.textContent = "Sign in";
    if (error) { say(loginMsg, error); return; }
    say(loginMsg, "");
    passwordField.value = "";
    startEditor(data.user);
  });

  $("#sign-out").addEventListener("click", async () => {
    if (dirty && !confirm("You have unsaved changes. Sign out anyway?")) return;
    const { error } = await request("", { action: "logout" });
    if (error) { setStatus(error, "error"); return; }
    dirty = false;
    current = null;
    show("screen-login");
  });

  request("?action=session").then(({ data, error }) => {
    if (error || !data?.configured) {
      if (error) $("#setup-message").textContent = error;
      show("screen-setup");
    } else if (data.user) startEditor(data.user);
    else show("screen-login");
  });
})();
