/* Perlindungan dasar sisi klien. PENGHALANG, bukan jaminan: siapa pun yang memakai browser dapat melewatinya,
   dan tidak ada skrip yang dapat mencegah screenshot OS/perangkat. Tidak mengganggu input, tombol, kode, atau keyboard biasa. */
(() => {
  const editable = el => !!el && !!el.closest && !!el.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']");
  const allowed = el => editable(el) || !!el.closest?.("code, pre, .selectable, a, button, summary");

  // Klik kanan: diblokir pada area biasa; tetap tersedia di input, kode, tautan, dan tombol.
  document.addEventListener("contextmenu", e => { if (!allowed(e.target)) e.preventDefault(); });

  // Salin/potong: hanya diblokir bila seleksi berada di area .protect (konten marketing), bukan di input/kode.
  const guardClipboard = e => {
    const sel = window.getSelection && window.getSelection();
    const node = sel && sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
    if (!node || editable(node) || node.closest("code, pre, .selectable")) return;
    if (node.closest(".protect")) e.preventDefault();
  };
  document.addEventListener("copy", guardClipboard);
  document.addEventListener("cut", guardClipboard);

  // Drag gambar (mis. logo, QR) tidak diperlukan.
  document.addEventListener("dragstart", e => { if (e.target && e.target.tagName === "IMG") e.preventDefault(); });

  // Pintasan umum untuk melihat sumber/menyimpan halaman. Tidak berlaku saat mengetik di input.
  document.addEventListener("keydown", e => {
    if (editable(e.target)) return;
    const k = String(e.key || "").toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    const devtools = k === "f12" || (mod && e.shiftKey && ["i", "j", "c"].includes(k)) || (e.metaKey && e.altKey && ["i", "j", "c", "u"].includes(k));
    const source = mod && !e.shiftKey && ["u", "s"].includes(k);
    if (devtools || source) e.preventDefault();
  });
})();
