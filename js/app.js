(() => {
  const $ = s => document.querySelector(s);
  const form = $("#save-form"), input = $("#target-url"), shell = $("#input-shell");
  const button = $("#submit-button"), label = button.querySelector(".button-label");
  const errorEl = $("#form-error"), consoleEl = $("#console"), indicator = $("#live-indicator");
  const formBadge = $("#form-badge"), outputState = $("#output-state"), resultArea = $("#result-area");
  const durationValue = $("#duration-value");
  const IDLE_LABEL = "Mulai pengarsipan";

  let busy = false, durationTimer = 0, startedAt = 0, controller = null, pending = null, skeleton = null, activeObjectUrl = null;

  const fmtTime = iso => {
    const d = iso ? new Date(iso) : new Date();
    const t = Number.isNaN(d.getTime()) ? new Date() : d;
    return t.toLocaleTimeString("id-ID", { hour12: false }).replace(/\./g, ":") + "." + String(t.getMilliseconds()).padStart(3, "0");
  };
  const fmtDuration = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`;
  const elapsed = () => Math.max(0, (Date.now() - startedAt) / 1000);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

  function setBadge(node, state, text) { node.className = "badge" + (state ? " " + state : ""); node.replaceChildren(document.createElement("i"), document.createTextNode(text)); }

  /* ---------------- Live Output ---------------- */
  const ICONS = { info: "›", ok: "✓", error: "✕", warn: "!" };
  function dropSkeleton() { skeleton?.remove(); skeleton = null; }
  function addLine(message, level = "info", iso, client = false) {
    $("#console-empty")?.remove();
    if (!client) dropSkeleton();          // log pertama dari server = data nyata sudah tersedia
    const row = el("div", `console-line ${level}${client ? " client" : ""}`);
    row.append(el("span", "console-time", fmtTime(iso)), el("span", "console-icon", ICONS[level] || "›"), el("span", "console-text", message));
    const anchor = skeleton || pending;
    if (anchor) consoleEl.insertBefore(row, anchor); else consoleEl.append(row);
    consoleEl.scrollTop = consoleEl.scrollHeight; // auto-scroll
  }
  function showWaiting() {
    skeleton = el("div", "console-skel"); skeleton.setAttribute("aria-hidden", "true");
    [72, 54, 63].forEach(w => { const s = el("div", "sk"); s.style.width = w + "%"; skeleton.append(s); });
    consoleEl.append(skeleton);
    pending = el("div", "console-pending", "Menunggu aktivitas berikutnya…"); consoleEl.append(pending);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }
  function clearWaiting() { dropSkeleton(); pending?.remove(); pending = null; }

  function tick() { durationValue.textContent = fmtDuration(elapsed()); }

  function setBusy(value) {
    busy = value;
    button.classList.toggle("busy", value);
    button.setAttribute("aria-busy", String(value));
    if (value) {
      button.disabled = true; label.textContent = "Sedang memproses";
      setBadge(indicator, "busy", "Memproses"); setBadge(formBadge, "busy", "Berjalan"); outputState.textContent = "Permintaan berjalan";
      showWaiting();
      durationTimer = window.setInterval(tick, 100);
    } else {
      window.clearInterval(durationTimer); clearWaiting(); tick();
      button.disabled = false; label.textContent = IDLE_LABEL;
    }
  }

  /* ---------------- hasil: loading / sukses / gagal ---------------- */
  function safeHttps(value) {
    try { const u = new URL(value); return u.protocol === "https:" && u.hostname && !u.username && !u.password ? u : null; } catch { return null; }
  }
  function showResultSkeleton() {
    resultArea.className = "result-area"; resultArea.hidden = false; resultArea.setAttribute("aria-busy", "true");
    const wrap = el("div", "result-skel"); wrap.setAttribute("aria-hidden", "true");
    ["t", "r", "r", "r", "b"].forEach(c => wrap.append(el("div", `sk ${c}`)));
    resultArea.replaceChildren(wrap);
  }
  function clearResult() { resultArea.hidden = true; resultArea.replaceChildren(); resultArea.removeAttribute("aria-busy"); }

  function renderZipResult(blob, response, seconds) {
    if (!(blob instanceof Blob) || blob.size < 4) throw new Error("File ZIP yang diterima kosong atau tidak valid.");
    if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = URL.createObjectURL(blob);
    const filename = (response.headers.get("x-file-name") || "website-FreeAPI.zip").replace(/[\r\n"\\/]/g, "-").slice(0, 150);
    const source = response.headers.get("x-source-url") || input.value;
    const meta = el("dl", "result-meta");
    const row = (k, v, code) => { const dt = el("dt", "", k), dd = el("dd"); dd.append(code ? el("code", "", v) : document.createTextNode(v)); meta.append(dt, dd); };
    row("Sumber", source, true);
    row("Nama file", filename);
    row("Ukuran ZIP", `${(blob.size / 1024 / 1024).toFixed(2)} MB`);
    row("Durasi", `${seconds.toFixed(1)} detik`);
    const a = el("a", "btn btn-primary"); a.href = activeObjectUrl; a.download = filename;
    a.append("Unduh file ZIP ", Object.assign(el("span", "arrow", "↓"), { ariaHidden: "true" }));
    const actions = el("div", "result-actions"); actions.append(a);
    resultArea.className = "result-area success"; resultArea.removeAttribute("aria-busy");
    resultArea.replaceChildren(el("strong", "", "Arsip website berhasil dibuat"), meta, actions); resultArea.hidden = false;
  }

  function renderFailure(message) {
    resultArea.className = "result-area error"; resultArea.removeAttribute("aria-busy");
    resultArea.replaceChildren(el("strong", "", "Pengarsipan gagal"), el("p", "", message)); resultArea.hidden = false;
  }

  function markDone() { outputState.textContent = "Arsip siap"; setBadge(indicator, "ok", "Selesai"); setBadge(formBadge, "ok", "Selesai"); }
  function fail(message) {
    setBadge(indicator, "error", "Gagal"); setBadge(formBadge, "error", "Gagal"); outputState.textContent = "Permintaan gagal";
    errorEl.textContent = message; renderFailure(message);
  }

  /* ---------------- kirim permintaan ---------------- */
  function validUrl(v) {
    try { const u = new URL(v); return ["http:", "https:"].includes(u.protocol) && !!u.hostname && !u.username && !u.password; } catch { return false; }
  }

  async function* readEvents(response) {
    const reader = response.body.getReader(); const dec = new TextDecoder(); let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (line) { try { yield JSON.parse(line); } catch { /* abaikan baris rusak */ } }
      }
    }
    if (buf.trim()) { try { yield JSON.parse(buf.trim()); } catch { /* ignore */ } }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;                      // pencegah klik ganda selama satu request berjalan
    errorEl.textContent = ""; shell.classList.remove("invalid"); clearResult();
    const url = input.value.trim();
    if (!validUrl(url)) {
      errorEl.textContent = "Masukkan URL lengkap yang valid, diawali https:// atau http://.";
      shell.classList.add("invalid"); input.focus(); return;
    }
    consoleEl.replaceChildren(); durationValue.textContent = "00:00.0"; startedAt = Date.now();
    controller = new AbortController();
    setBusy(true); showResultSkeleton();
    addLine("Mengirim permintaan ke server WHYZZZ…", "info", null, true);

    let progressTimer = null;
    try {
      addLine("Menghubungi layanan pengarsipan…", "info", null, true);
      progressTimer = window.setInterval(() => {
        const seconds = Math.floor(elapsed());
        if (seconds > 0 && seconds % 8 === 0) addLine(`Pengarsipan masih berjalan… ${seconds} detik`, "info", null, true);
      }, 1000);
      const response = await fetch("/api/save", {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json", Accept: "application/zip, application/json" },
        body: JSON.stringify({ url, website: form.elements.website.value })
      });
      const type = response.headers.get("content-type") || "";
      window.clearInterval(progressTimer); progressTimer = null;
      if (response.ok && type.toLowerCase().includes("application/zip")) {
        addLine("Respons ZIP diterima. Mengunduh data arsip…", "info", null, true);
        const blob = await response.blob();
        clearWaiting(); renderZipResult(blob, response, elapsed()); markDone();
        window.keyyssToast("Arsip ZIP berhasil dibuat.", "ok");
      } else {
        const data = await response.json().catch(() => ({}));
        if (Array.isArray(data.logs)) data.logs.forEach(l => addLine(l.message, l.level, l.ts));
        clearWaiting();
        const msg = data.message || (response.status === 404
          ? "Endpoint /api/save tidak ditemukan di server (HTTP 404). Fungsi API belum ter-deploy atau path-nya salah."
          : `Server mengembalikan HTTP ${response.status}. Periksa log backend.`);
        if (!Array.isArray(data.logs)) addLine(msg, "error");
        fail(msg);
      }
    } catch (err) {
      window.clearInterval(progressTimer);
      clearWaiting();
      if (err.name !== "AbortError") { addLine(err.message && !/fetch/i.test(err.message) ? err.message : "Tidak dapat menghubungi server. Periksa koneksi internet Anda.", "error"); fail("Permintaan gagal dikirim. Silakan coba kembali."); }
    } finally { controller = null; setBusy(false); }
  });

  input.addEventListener("input", () => { shell.classList.remove("invalid"); if (errorEl.textContent) errorEl.textContent = ""; });
  window.addEventListener("pagehide", () => { controller?.abort(); window.clearInterval(durationTimer); if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl); });
})();
