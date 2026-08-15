/* ==========================================================================
   体験3: 線を引く（新人）
   ==========================================================================
   ブロンボス洞窟で見つかった約7万3千年前の石片には、表面を磨いたうえで
   オーカーのクレヨンで格子模様が描かれていた。その行為をなぞる。
   線の本数は再現であり、実物の正確な本数を主張するものではない。

   線は1本のきれいな直線ではなく、細かい粒を並べて描いている。
   クレヨンでこすりつけた顔料は、こう見えるため。 */

import { seeded, roughBlob, grain, glow, offscreen } from '../paint.js';

const S = { lines: [], done: 0, stone: null, key: '' };

export const trace = {
  gauge: 'ひいた線',

  start(ui, env) {
    // 石片の中央に、斜めに交差する格子模様を置く（画面比で持つ）
    const cx = 0.5, cy = 0.47, w = 0.25, h = 0.105;
    S.lines = [];
    for (let i = 0; i < 4; i++) {                 // 右上がりの線
      const t = i / 3;
      S.lines.push(line(cx - w + t * w * 0.7, cy + h, cx - w * 0.3 + t * w * 0.7, cy - h, i));
    }
    for (let i = 0; i < 3; i++) {                 // 交差する線
      const t = i / 2;
      S.lines.push(line(cx - w, cy - h * 0.55 + t * h * 0.9, cx + w, cy - h * 0.2 + t * h * 0.9, 10 + i));
    }
    S.done = 0;
    gauge(ui);
  },

  down(p, env, ui) { rub(p, env, ui); },
  move(p, env, ui) { rub(p, env, ui); },

  draw(ctx, env) {
    build(env);
    ctx.drawImage(S.stone, 0, 0, env.W, env.H);

    S.lines.forEach(L => {
      const x1 = L.x1 * env.W, y1 = L.y1 * env.H;
      const x2 = L.x2 * env.W, y2 = L.y2 * env.H;

      ctx.lineCap = 'round';                      // 下書きのすじ（浅い彫りあと）
      ctx.strokeStyle = 'rgba(58,44,32,0.40)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,215,0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x1, y1 - 1.5); ctx.lineTo(x2, y2 - 1.5); ctx.stroke();

      const upto = L.pts.filter(p => p.hit).length / L.pts.length;
      if (upto > 0) ochre(ctx, L, x1, y1, x2, y2, upto);
    });
  }
};

function line(x1, y1, x2, y2, seed) {
  const pts = [];
  for (let i = 0; i <= 14; i++) pts.push({ t: i / 14, hit: false });
  return { x1, y1, x2, y2, pts, complete: false, seed: 900 + seed };
}

function rub(p, env, ui) {
  const R = Math.max(20, env.W * 0.055);
  S.lines.forEach(L => {
    if (L.complete) return;
    L.pts.forEach(q => {
      if (q.hit) return;
      const x = (L.x1 + (L.x2 - L.x1) * q.t) * env.W;
      const y = (L.y1 + (L.y2 - L.y1) * q.t) * env.H;
      if (Math.hypot(p.x - x, p.y - y) < R) q.hit = true;
    });
    if (L.pts.filter(q => q.hit).length / L.pts.length >= 0.8) L.complete = true;
  });
  const done = S.lines.filter(L => L.complete).length;
  if (done !== S.done) { S.done = done; gauge(ui); }
  if (done === S.lines.length) setTimeout(() => ui.finish(), 600);
}

function gauge(ui) {
  const n = S.lines.length || 1;
  ui.gauge(`${S.done} / ${n} 本`, (S.done / n) * 100, false);
}

/* こすりつけた顔料。粒をばらしてのせると、絵の具の粉らしくなる */
function ochre(ctx, L, x1, y1, x2, y2, upto) {
  const rand = seeded(L.seed);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
  const n = 46;

  ctx.strokeStyle = `rgba(118,58,40,${L.complete ? 0.26 : 0.17})`;   // 粉のにじみ
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 + (x2 - x1) * upto, y1 + (y2 - y1) * upto);
  ctx.stroke();

  for (let i = 0; i < n; i++) {
    const t = i / n;
    const off = (rand() - 0.5) * 5;
    const r = 1.3 + rand() * 2.4;
    const shade = rand();
    if (t > upto) break;
    ctx.fillStyle = shade > 0.72 ? 'rgba(166,90,60,0.92)'    // オーカーは土の赤。
                  : shade > 0.35 ? 'rgba(132,58,36,0.94)'    // 鮮やかにしすぎると
                                 : 'rgba(94,40,26,0.94)';    // 現代の絵の具に見えてしまう
    ctx.beginPath();
    ctx.arc(x1 + (x2 - x1) * t + nx * off, y1 + (y2 - y1) * t + ny * off, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* --------------------------------------------------------------------------
   石片（シルクリート）。磨いた面・欠けたふち・落ちる影を描いておく
   -------------------------------------------------------------------------- */
function build(env) {
  const key = `${Math.round(env.W)}x${Math.round(env.H)}x${env.dpr}`;
  if (S.key === key) return;
  S.key = key;
  S.stone = offscreen(env.W * env.dpr, env.H * env.dpr, g => {
    g.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
    const rand = seeded(8080);
    const W = env.W, H = env.H;
    const cx = W * 0.5, cy = H * 0.47;
    const sw = W * 0.74, sh = H * 0.30;

    g.fillStyle = 'rgba(0,0,0,0.45)';             // 岩だなに落ちる影
    g.beginPath();
    g.ellipse(cx + sw * 0.03, cy + sh * 0.52, sw * 0.46, sh * 0.16, 0, 0, Math.PI * 2);
    g.fill();

    const shape = () => {
      g.beginPath();
      g.moveTo(cx - sw / 2, cy - sh * 0.36);
      g.lineTo(cx - sw * 0.36, cy - sh / 2);
      g.lineTo(cx + sw * 0.40, cy - sh * 0.42);
      g.lineTo(cx + sw / 2, cy + sh * 0.30);
      g.lineTo(cx + sw * 0.30, cy + sh / 2);
      g.lineTo(cx - sw * 0.42, cy + sh * 0.40);
      g.closePath();
    };

    const body = g.createLinearGradient(cx - sw / 2, cy - sh / 2, cx + sw / 2, cy + sh / 2);
    body.addColorStop(0, '#8b7c68');                   // シルクリートは灰色というより
    body.addColorStop(0.5, '#75674f');                 // 茶色みのある石
    body.addColorStop(1, '#57493a');
    shape();
    g.fillStyle = body;
    g.fill();

    g.save();                                      // 表面の模様とざらつきは石の内側だけに
    shape();
    g.clip();
    for (let i = 0; i < 60; i++) {                 // まだらな地
      const x = cx + (rand() - 0.5) * sw, y = cy + (rand() - 0.5) * sh;
      const r = sw * (0.02 + rand() * 0.06);
      roughBlob(g, x, y, r, r * 0.6, 0.5, rand, 9);
      g.fillStyle = rand() > 0.5
        ? `rgba(255,246,230,${0.03 + rand() * 0.05})`
        : `rgba(40,30,22,${0.04 + rand() * 0.06})`;
      g.fill();
    }
    // 磨いた面。ここだけつやがある
    const polish = g.createLinearGradient(cx - sw * 0.3, cy - sh * 0.35, cx + sw * 0.2, cy + sh * 0.3);
    polish.addColorStop(0, 'rgba(255,252,244,0.22)');
    polish.addColorStop(0.55, 'rgba(255,250,240,0.07)');
    polish.addColorStop(1, 'rgba(255,250,240,0)');
    g.fillStyle = polish;
    roughBlob(g, cx - sw * 0.02, cy - sh * 0.02, sw * 0.40, sh * 0.34, 0.18, seeded(31), 14);
    g.fill();
    grain(g, cx - sw / 2, cy - sh / 2, sw, sh, 2200, rand, 2);

    g.strokeStyle = 'rgba(255,252,244,0.28)';      // 上のふちの光
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(cx - sw * 0.46, cy - sh * 0.34);
    g.lineTo(cx - sw * 0.34, cy - sh * 0.46);
    g.lineTo(cx + sw * 0.38, cy - sh * 0.40);
    g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.35)';            // 下のふちの影
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx + sw * 0.48, cy + sh * 0.26);
    g.lineTo(cx + sw * 0.28, cy + sh * 0.47);
    g.lineTo(cx - sw * 0.40, cy + sh * 0.38);
    g.stroke();
    g.restore();

    glow(g, cx - sw * 0.2, cy - sh * 0.3, sw * 0.5, '255,180,110', 0.10);
  });
}
