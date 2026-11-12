/* Perilaku UI bersama (beranda & docs): fallback logo, navbar mobile + link aktif, reveal, ripple, toast, modal. Tanpa inline script (CSP). */
(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  document.documentElement.classList.remove("no-js");

  /* ---- fallback logo ---- */
  document.querySelectorAll(".brand-mark img").forEach(img => {
    const fallback = () => { img.hidden = true; const f = img.parentElement.querySelector(".brand-fallback"); if (f) f.hidden = false; };
    if (img.complete && img.naturalWidth === 0) fallback(); else img.addEventListener("error", fallback, { once: true });
  });

  /* ---- navbar mobile ---- */
  const toggle = document.getElementById("nav-toggle");
  const links = document.getElementById("nav-links");
  if (toggle && links) {
    const set = open => { links.classList.toggle("open", open); toggle.setAttribute("aria-expanded", String(open)); };
    toggle.addEventListener("click", () => set(!links.classList.contains("open")));
    links.addEventListener("click", e => { if (e.target.closest("a")) set(false); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") set(false); });
    document.addEventListener("click", e => { if (!e.target.closest(".navbar")) set(false); });
  }

  /* ---- link navigasi aktif mengikuti section (hanya beranda) ---- */
  const navAnchors = [...document.querySelectorAll('.nav-links a[href^="#"]')];
  if (navAnchors.length && "IntersectionObserver" in window) {
    const map = new Map(navAnchors.map(a => [a.getAttribute("href").slice(1), a]));
    const seen = new Map();
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => seen.set(en.target.id, en.isIntersecting ? en.boundingClientRect.top : null));
      const top = [...seen].filter(([, t]) => t !== null).sort((a, b) => a[1] - b[1])[0];
      navAnchors.forEach(a => a.classList.remove("active"));
      if (top && map.has(top[0])) map.get(top[0]).classList.add("active");
    }, { rootMargin: "-20% 0px -65% 0px" });
    map.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }

  /* ---- scroll reveal (hanya beberapa blok) ---- */
  const items = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduce.matches) {
    const io = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { threshold: .12 });
    items.forEach(el => io.observe(el));
  } else items.forEach(el => el.classList.add("in"));

  /* ---- ripple pada tombol ---- */
  document.addEventListener("pointerdown", e => {
    if (reduce.matches) return;
    const el = e.target.closest(".btn, .copy-btn, .lang-tab");
    if (!el || el.disabled) return;
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const dot = document.createElement("span");
    dot.className = "ripple";
    dot.style.width = dot.style.height = size + "px";
    dot.style.left = (e.clientX - rect.left - size / 2) + "px";
    dot.style.top = (e.clientY - rect.top - size / 2) + "px";
    el.append(dot);
    dot.addEventListener("animationend", () => dot.remove(), { once: true });
  }, { passive: true });

  /* ---- toast ---- */
  window.keyyssToast = (message, type = "info", ms = 2600) => {
    const host = document.getElementById("toasts"); if (!host) return;
    while (host.children.length >= 3) host.firstElementChild.remove();
    const t = document.createElement("div"); t.className = `toast ${type}`;
    const dot = document.createElement("i"); const txt = document.createElement("span"); txt.textContent = message;
    t.append(dot, txt); host.append(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 220); }, ms);
  };

  /* ---- salin ke clipboard (Clipboard API, fallback execCommand) ---- */
  window.keyyssCopy = async text => {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
      const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.className = "honeypot";
      document.body.append(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok;
    } catch { return false; }
  };

  /* ---- modal QRIS ---- */
  const dialog = document.getElementById("qr-dialog");
  if (dialog && typeof dialog.showModal === "function") {
    let opener = null;
    const close = () => {
      if (!dialog.open) return;
      if (reduce.matches) { dialog.close(); return; }
      dialog.classList.add("closing");
      dialog.addEventListener("animationend", () => { dialog.classList.remove("closing"); dialog.close(); }, { once: true });
    };
    const open = e => { opener = e.currentTarget; dialog.showModal(); };
    document.getElementById("qr-open")?.addEventListener("click", open);
    document.getElementById("qr-thumb")?.addEventListener("click", open);
    document.getElementById("qr-close")?.addEventListener("click", close);
    dialog.addEventListener("click", e => { if (e.target === dialog) close(); });
    dialog.addEventListener("cancel", e => { e.preventDefault(); close(); });
    dialog.addEventListener("close", () => opener?.focus());
  }
})();
