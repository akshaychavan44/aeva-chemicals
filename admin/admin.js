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

  /* ---------------- editor ---------------- */
  let saved = {};        // what is in the database, by key
  let fallback = null;   // the content built into the website, used until a section is first saved
  let current = null;    // { section, root }
  let dirty = false;
  const INQUIRIES = "inquiries", SETTINGS = "settings";
  const REPLY_FROM = "info@aevachemicals.com"; // replies to inquiries are written from this Gmail account
  let view = null;       // INQUIRIES, SETTINGS or a section key
  let inquiries = null;  // [{ received_at, details }] once loaded, newest first
  let account = "";      // signed-in email

  const status = $("#save-status"), saveBtn = $("#save"), discardBtn = $("#discard");
  const setStatus = (text, kind = "") => { status.textContent = text; status.className = kind ? `is-${kind}` : ""; };
  const markDirty = () => {
    if (!dirty) { dirty = true; saveBtn.disabled = false; discardBtn.disabled = false; }
    setStatus("Unsaved changes", "dirty");
  };
  const markClean = text => { dirty = false; saveBtn.disabled = true; discardBtn.disabled = true; setStatus(text, text.startsWith("Saved") ? "ok" : ""); };
  addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  const svg = path => {
    const span = el("span", { class: "sidenav__icon", "aria-hidden": "true" });
    span.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
    return span;
  };
  const NAV_ICON = {
    [INQUIRIES]: '<path d="M4 13h4l2 3h4l2-3h4"/><path d="M5.5 5h13L21 13v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5z"/>',
    whatwedo: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    careers: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
    [SETTINGS]: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  };
  const TITLES = { [INQUIRIES]: "Inquiries", [SETTINGS]: "Settings" };

  function renderNav() {
    const item = (key, label, sub, badge) => el("button", {
      type: "button", class: "sidenav__item", "data-key": key, "aria-current": view === key ? "page" : "false",
      onclick: () => { open(key); closeSidebar(); },
    }, svg(NAV_ICON[key]), el("span", { class: "sidenav__text" }, label, el("small", { text: sub })),
    badge ? el("span", { class: "sidenav__badge", text: badge, "aria-label": `${badge} inquiries` }) : null);
    $("#sidenav").replaceChildren(
      el("p", { class: "sidenav__label", text: "Inbox" }),
      item(INQUIRIES, "Inquiries", "Website form", inquiries && inquiries.length ? String(inquiries.length) : ""),
      el("p", { class: "sidenav__label", text: "Website content" }),
      ...SECTIONS.map(s => item(s.key, s.nav, s.sub)),
      el("p", { class: "sidenav__label", text: "Account" }),
      item(SETTINGS, "Settings", "Change password"));
  }

  // inquiries, the content editor and settings share the page; only one shows at a time
  function showView(key) {
    view = key;
    $("#inquiries-view").hidden = key !== INQUIRIES;
    $("#settings-view").hidden = key !== SETTINGS;
    $("#editor-view").hidden = key === INQUIRIES || key === SETTINGS;
    const section = SECTIONS.find(s => s.key === key);
    $("#topbar-title").textContent = TITLES[key] || (section ? section.nav : "");
    if (key !== SETTINGS) {
      try { localStorage.setItem("aeva-admin-section", key); } catch (e) { /* private mode */ }
    }
  }

  function open(key, force) {
    if (dirty && !force && !confirm("You have unsaved changes. Leave this section without saving?")) return;
    if (key === INQUIRIES || key === SETTINGS) {
      dirty = false;
      current = null;
      showView(key);
      renderNav();
      scrollTo({ top: 0 });
      if (key === INQUIRIES) loadInquiries();
      else resetPasswordForm();
      return;
    }
    const section = SECTIONS.find(s => s.key === key) || SECTIONS[0];
    showView(section.key);
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

  /* ---------------- inquiries ---------------- */
  const inqRows = $("#inq-rows"), inqCount = $("#inq-count"), inqSearch = $("#inq-search");
  const inqIndustry = $("#inq-industry"), inqCsv = $("#inq-csv"), panel = $("#inq-panel");
  const when = (iso, long) => new Date(iso).toLocaleString("en-IN", long
    ? { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const tableMessage = (text, loading) => {
    inqRows.replaceChildren(el("tr", {}, el("td", { colspan: 6, class: "inq-empty" },
      loading ? el("span", { class: "spinner", "aria-hidden": "true" }) : null, text)));
  };

  // also called once after sign-in so the sidebar badge shows the count straight away
  async function loadInquiries() {
    const showing = view === INQUIRIES;
    if (showing) {
      inqCsv.disabled = true;
      inqCount.textContent = "";
      tableMessage("Loading inquiries…", true);
    }
    const { data, error } = await request("?action=inquiries");
    if (error) { if (view === INQUIRIES) tableMessage(`Couldn’t load inquiries: ${error}`); return; }
    inquiries = data;
    const industries = [...new Set(data.map(r => r.details.industry).filter(Boolean))].sort();
    const chosen = inqIndustry.value;
    inqIndustry.replaceChildren(el("option", { value: "", text: "All industries" }),
      ...industries.map(name => el("option", { value: name, text: name })));
    inqIndustry.value = industries.includes(chosen) ? chosen : "";
    renderNav();
    if (view === INQUIRIES) renderInquiries();
  }

  function filteredInquiries() {
    const words = inqSearch.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const industry = inqIndustry.value;
    return (inquiries || []).filter(({ details: d }) => {
      if (industry && d.industry !== industry) return false;
      const text = [d.name, d.company, d.email, d.phone, d.message].join(" ").toLowerCase();
      return words.every(w => text.includes(w));
    });
  }

  function renderInquiries() {
    if (!inquiries) return;
    const rows = filteredInquiries();
    const total = inquiries.length;
    inqCount.textContent = total === 0 ? "" : rows.length === total
      ? `${total} inquir${total === 1 ? "y" : "ies"}`
      : `Showing ${rows.length} of ${total}`;
    inqCsv.disabled = rows.length === 0;
    if (!total) { tableMessage("No inquiries yet. Messages sent from the website’s inquiry form will appear here."); return; }
    if (!rows.length) { tableMessage("No inquiries match your search."); return; }
    inqRows.replaceChildren(...rows.map(row => {
      const d = row.details;
      const name = el("button", { type: "button", class: "inq-open", text: d.name || "(no name)", title: d.name });
      return el("tr", { onclick: () => openInquiry(row) },
        el("td", { class: "inq-date", text: when(row.received_at) }),
        el("td", {}, name),
        el("td", { class: "inq-muted", text: d.email, title: d.email }),
        el("td", { text: d.company || "—", title: d.company }),
        el("td", {}, d.industry ? el("span", { class: "inq-tag", text: d.industry }) : "—"),
        el("td", { class: "inq-muted", text: d.message }));
    }));
  }

  // wa.me needs the number with its country code; numbers typed without one are taken to be Indian
  function whatsappNumber(phone) {
    let digits = String(phone || "").replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    if (digits.length === 10) digits = "91" + digits;
    return digits.length >= 11 && digits.length <= 15 ? digits : "";
  }

  function openInquiry({ received_at, details: d }) {
    $("#inq-panel-name").textContent = d.name || "(no name)";
    $("#inq-panel-date").textContent = `Received ${when(received_at, true)}`;
    const rows = [["Company", d.company], ["Email", d.email], ["Phone", d.phone], ["Industry", d.industry]];
    $("#inq-panel-details").replaceChildren(...rows.flatMap(([label, value]) => [
      el("dt", { text: label }), el("dd", { text: value || "—" })]));
    $("#inq-panel-message").textContent = d.message;

    const first = (d.name || "").trim().split(/\s+/)[0] || "there";
    const greeting = `Hi ${first}, thank you for contacting Aeva Chemicals.`;
    const actions = [];
    if (d.email) {
      // opens a Gmail compose window in a new tab, from the company inbox when it is signed in to Gmail
      const compose = new URLSearchParams({
        authuser: REPLY_FROM, view: "cm", fs: "1", to: d.email,
        su: "Your inquiry to Aeva Chemicals",
        body: `${greeting}\n\n\n\n— Your message —\n${d.message}`,
      });
      actions.push(el("a", { class: "btn btn--primary btn--small", href: `https://mail.google.com/mail/?${compose}`, target: "_blank", rel: "noopener", text: "Reply in Gmail" }));
    }
    const tel = String(d.phone || "").replace(/[^\d+]/g, "");
    if (tel) actions.push(el("a", { class: "btn btn--ghost btn--small", href: `tel:${tel}`, text: "Call" }));
    const wa = whatsappNumber(d.phone);
    if (wa) actions.push(el("a", { class: "btn btn--ghost btn--small", href: `https://wa.me/${wa}?text=${encodeURIComponent(greeting)}`, target: "_blank", rel: "noopener", text: "WhatsApp" }));
    $("#inq-panel-actions").replaceChildren(...actions);
    panel.showModal();
  }

  // a value starting with = + - @ would run as a formula when the file is opened in Excel;
  // plain numbers such as "+44 20 7946 0958" are left as they are
  const csvCell = value => {
    let text = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(text) && !/^[+-]?[\d\s().-]+$/.test(text)) text = "'" + text;
    return `"${text.replace(/"/g, '""')}"`;
  };

  function downloadCsv() {
    const rows = filteredInquiries();
    const lines = [["Received", "Name", "Company", "Email", "Phone", "Industry", "Message"],
      ...rows.map(({ received_at, details: d }) => [when(received_at, true), d.name, d.company, d.email, d.phone, d.industry, d.message])];
    // the byte order mark tells Excel the file is UTF-8
    const blob = new Blob(["﻿" + lines.map(r => r.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const link = el("a", { href: URL.createObjectURL(blob), download: `aeva-inquiries-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  inqSearch.addEventListener("input", renderInquiries);
  inqIndustry.addEventListener("change", renderInquiries);
  inqCsv.addEventListener("click", downloadCsv);
  $("#inq-refresh").addEventListener("click", loadInquiries);
  $("#inq-panel-close").addEventListener("click", () => panel.close());
  panel.addEventListener("click", e => { if (e.target === panel) panel.close(); }); // click on the backdrop

  /* ---------------- top bar: account menu, settings, phone menu ---------------- */
  const profileBtn = $("#profile-btn"), profileMenu = $("#profile-menu");
  const setMenu = openMenu => {
    profileMenu.hidden = !openMenu;
    profileBtn.setAttribute("aria-expanded", String(openMenu));
    if (openMenu) $("#sign-out").focus();
  };
  profileBtn.addEventListener("click", () => setMenu(profileMenu.hidden));
  document.addEventListener("click", e => { if (!profileMenu.hidden && !e.target.closest(".profile")) setMenu(false); });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!profileMenu.hidden) { setMenu(false); profileBtn.focus(); }
    closeSidebar();
  });

  const sidebar = $("#sidebar"), backdrop = $("#sidebar-backdrop"), menuToggle = $("#menu-toggle");
  function closeSidebar() {
    sidebar.classList.remove("is-open");
    backdrop.hidden = true;
    menuToggle.setAttribute("aria-expanded", "false");
  }
  menuToggle.addEventListener("click", () => {
    const opening = !sidebar.classList.contains("is-open");
    sidebar.classList.toggle("is-open", opening);
    backdrop.hidden = !opening;
    menuToggle.setAttribute("aria-expanded", String(opening));
  });
  backdrop.addEventListener("click", closeSidebar);

  /* ---------------- settings: change password ---------------- */
  const passwordForm = $("#password-form"), passwordMsg = $("#password-message");
  function resetPasswordForm() {
    passwordForm.reset();
    $("#password-show").dispatchEvent(new Event("change"));
    say(passwordMsg, "");
  }
  $("#password-show").addEventListener("change", e => {
    passwordForm.querySelectorAll("input[type=password], input[data-secret]").forEach(input => {
      input.dataset.secret = "1";
      input.type = e.target.checked ? "text" : "password";
    });
  });
  passwordForm.addEventListener("submit", async e => {
    e.preventDefault();
    const current = passwordForm.current.value, next = passwordForm.next.value, confirmValue = passwordForm.confirm.value;
    const chars = Array.from(next).length;
    if (!current || !next) { say(passwordMsg, "Enter your current password and a new password."); return; }
    if (chars < 10 || chars > 20) { say(passwordMsg, "The new password must be 10 to 20 characters."); return; }
    if (next !== confirmValue) { say(passwordMsg, "The new passwords don’t match."); return; }
    const btn = passwordForm.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Changing…";
    const { error } = await request("", { action: "change-password", current, next });
    btn.disabled = false; btn.textContent = "Change password";
    if (error) { say(passwordMsg, error); return; }
    passwordForm.reset();
    $("#password-show").dispatchEvent(new Event("change"));
    say(passwordMsg, "Password changed. Any other device signed in to the admin has been signed out.", true);
  });

  async function startEditor(user) {
    account = user.email;
    const letter = (account.trim()[0] || "A").toUpperCase();
    $("#who").textContent = account;
    profileBtn.textContent = letter;
    $("#menu-avatar").textContent = letter;
    profileBtn.title = account;
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
    open(last || INQUIRIES, true);
    if (view !== INQUIRIES) loadInquiries(); // fills the sidebar badge
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
    setMenu(false);
    if (dirty && !confirm("You have unsaved changes. Sign out anyway?")) return;
    const { error } = await request("", { action: "logout" });
    if (error) { setStatus(error, "error"); return; }
    dirty = false;
    current = null;
    inquiries = null;
    account = "";
    resetPasswordForm();
    inqRows.replaceChildren();
    if (panel.open) panel.close();
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
