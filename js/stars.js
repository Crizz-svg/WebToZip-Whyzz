/* Latar langit: bintang berkedip pelan, debu halus, dan bintang jatuh sesekali.
   Ringan: satu canvas, requestAnimationFrame, jeda saat tab tersembunyi, jumlah partikel dikurangi di perangkat lemah/mobile. */
(() => {
  const canvas = document.getElementById("sky");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const lowPower = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.connection && navigator.connection.saveData);
  const rand = (a, b) => a + Math.random() * (b - a);
  let w = 0, h = 0, dpr = 1, stars = [], dust = [], meteors = [], raf = 0, last = 0, skip = false, nextMeteor = 0, small = false;

  function spawnStar(initial) {
    const depth = Math.random();
    return {
      x: rand(0, w), y: initial ? rand(0, h) : rand(-20, -2),
      r: 0.35 + depth * 1.15, vy: 4 + depth * 18, vx: rand(-3, 3) * (0.3 + depth),
      a: 0.25 + depth * 0.6, tw: rand(0.6, 2.4), ph: rand(0, 6.28),
      tint: Math.random() < 0.2 ? "190,200,255" : "255,255,255"
    };
  }
  function spawnDust(initial) {
    return { x: rand(0, w), y: initial ? rand(0, h) : h + 10, r: rand(1.2, 2.6), vy: -rand(3, 8), vx: rand(-5, 5), a: rand(0.04, 0.1), ph: rand(0, 6.28) };
  }
  function spawnMeteor() {
    const angle = rand(0.95, 1.25);                   // arah jatuh diagonal ke kanan-bawah (radian dari sumbu X)
    const speed = rand(420, 640);
    return { x: rand(w * 0.1, w * 1.05), y: rand(-40, h * 0.25), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, len: rand(70, 130), life: 0, max: rand(0.9, 1.5) };
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = window.innerWidth; h = window.innerHeight; small = w < 700;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const weak = lowPower || small;
    const nStars = Math.min(weak ? 60 : 130, Math.round(w * h / (weak ? 9500 : 11000)));
    stars = Array.from({ length: nStars }, () => spawnStar(true));
    dust = Array.from({ length: lowPower ? 5 : (small ? 7 : 14) }, () => spawnDust(true));
    meteors = [];
    if (reduce.matches) draw(0);
  }
  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    for (const d of dust) {
      const al = d.a * (0.6 + 0.4 * Math.sin(t * 0.0006 + d.ph));
      const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 6);
      g.addColorStop(0, `rgba(160,170,255,${al})`); g.addColorStop(1, "rgba(160,170,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 6, 0, 6.2832); ctx.fill();
    }
    for (const s of stars) {
      const tw = reduce.matches ? 1 : 0.55 + 0.45 * Math.sin(t * 0.001 * s.tw + s.ph);
      ctx.fillStyle = `rgba(${s.tint},${(s.a * tw).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill();
    }
    ctx.lineCap = "round";
    for (const m of meteors) {
      const k = m.life / m.max, fade = Math.sin(Math.min(1, k) * Math.PI); // muncul, melaju, hilang
      const sp = Math.hypot(m.vx, m.vy), tx = m.x - (m.vx / sp) * m.len, ty = m.y - (m.vy / sp) * m.len;
      const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
      g.addColorStop(0, `rgba(235,240,255,${(0.85 * fade).toFixed(3)})`); g.addColorStop(1, "rgba(150,165,255,0)");
      ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
    }
  }
  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (lowPower) { skip = !skip; if (skip) return; }
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i]; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.y > h + 4 || s.x < -10 || s.x > w + 10) stars[i] = spawnStar(false);
    }
    for (let i = 0; i < dust.length; i++) {
      const d = dust[i]; d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.y < -20 || d.x < -20 || d.x > w + 20) dust[i] = spawnDust(false);
    }
    if (t > nextMeteor && meteors.length < (small || lowPower ? 1 : 2)) { meteors.push(spawnMeteor()); nextMeteor = t + rand(3500, 9000); }
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i]; m.x += m.vx * dt; m.y += m.vy * dt; m.life += dt;
      if (m.life > m.max || m.y > h + 60) meteors.splice(i, 1);
    }
    draw(t);
  }
  function start() { if (!raf && !reduce.matches && !document.hidden) { last = performance.now(); nextMeteor = last + rand(1500, 4000); raf = requestAnimationFrame(frame); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  let resizeTimer = 0;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 180); }, { passive: true });
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  window.addEventListener("pagehide", stop);
  const onMotion = () => { stop(); resize(); start(); };
  reduce.addEventListener ? reduce.addEventListener("change", onMotion) : reduce.addListener(onMotion);
  resize(); start();
})();
