/* ==========================================================================
   描画の共通部品
   ==========================================================================
   すべての場面で使う「ゆらぎ」「ざらつき」「光」をここにまとめている。
   乱数は種つき（seeded）にしてある。毎コマ違う値が出ると絵がちらつくため、
   背景のように動かないものは同じ種から描き、一度だけ作って使いまわす。 */

/* 同じ種を渡せば必ず同じ並びの数が出る乱数 */
export function seeded(seed) {
  let s = (seed || 1) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* 岩・石ころ・葉のかたまりなど「まるいが整っていない」輪郭。
   頂点を乱してから中点で曲線をつなぐので、角ばらずに歪む。 */
export function roughBlob(ctx, cx, cy, rx, ry, wobble, rand, n = 12) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (rand() - 0.5) * wobble;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  ctx.beginPath();
  ctx.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  ctx.closePath();
}

/* 先が細くなる棒。骨・木の幹・枝に使う。両端は丸くする。 */
export function tapered(ctx, x1, y1, x2, y2, w1, w2) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const nx = Math.cos(a + Math.PI / 2), ny = Math.sin(a + Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(x1 + nx * w1, y1 + ny * w1);
  ctx.lineTo(x2 + nx * w2, y2 + ny * w2);
  ctx.arc(x2, y2, w2, a + Math.PI / 2, a - Math.PI / 2, true);
  ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
  ctx.arc(x1, y1, w1, a - Math.PI / 2, a + Math.PI / 2, true);
  ctx.closePath();
}

/* ざらつき。岩肌・土・骨の上に薄くのせると、のっぺり感が消える。 */
export function grain(ctx, x, y, w, h, amount, rand, size = 2) {
  for (let i = 0; i < amount; i++) {
    const light = rand() > 0.5;
    ctx.fillStyle = light
      ? `rgba(255,255,255,${0.02 + rand() * 0.06})`
      : `rgba(0,0,0,${0.03 + rand() * 0.08})`;
    ctx.fillRect(x + rand() * w, y + rand() * h, size, size);
  }
}

/* 光の玉。火・太陽・洞くつの入口など、光源のまわりの明るさ。

   以前は毎コマ createRadialGradient を呼んでいた。絵を画面ぜんたいに
   広げたことで半径が900pxを超え、これが1コマに何回も走って
   描画が数fpsまで落ちた（炎のコマが進まず、火が短く見える原因だった）。
   形は色ごとに1枚だけ焼いておき、あとは拡大して貼るだけにする。 */
const glowCache = {};
function glowSprite(rgb) {
  if (glowCache[rgb]) return glowCache[rgb];
  const c = offscreen(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, `rgba(${rgb},1)`);
    gr.addColorStop(0.45, `rgba(${rgb},0.34)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
  glowCache[rgb] = c;
  return c;
}

export function glow(ctx, x, y, r, rgb, alpha) {
  if (r <= 0 || alpha <= 0) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(glowSprite(rgb), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

/* 画面のふちを暗くする。中央のものに目が行くようになる。
   明るさの中心は「文字と操作の帯」の中央に置き、暗くする範囲は画面全体に広げる。
   外側の半径を画面の対角に合わせてあるので、横長のPCでも左右が
   潰れず、広げた森がちゃんと見えたまま四隅だけが落ちる。

   中身は画面の大きさが変わらないかぎり同じなので、1枚焼いて使いまわす。 */
let vig = null;
export function vignette(ctx, env, strength = 0.5) {
  const key = `${Math.round(env.VW)}x${Math.round(env.VH)}|${Math.round(env.W)}|${strength}`;
  if (!vig || vig.key !== key) {
    vig = {
      key,
      canvas: offscreen(env.VW, env.VH, (g, w, h) => {
        const cx = env.W / 2 - env.x0, cy = env.H / 2 - env.y0;
        const inner = Math.min(env.W, env.H) * 0.30;
        const outer = Math.hypot(w, h) * 0.62;
        const gr = g.createRadialGradient(cx, cy, inner, cx, cy, outer);
        gr.addColorStop(0, 'rgba(0,0,0,0)');
        gr.addColorStop(1, `rgba(0,0,0,${strength})`);
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
      })
    };
  }
  ctx.drawImage(vig.canvas, env.x0, env.y0, env.VW, env.VH);
}

/* 別の画用紙に描いて絵として持っておく。
   背景や土のように「一度描けば済むもの」を毎コマ描き直すと重くなるため。 */
export function offscreen(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d');
  if (paint) paint(g, c.width, c.height);
  return c;
}

/* ふちがぼやけた丸の絵。火の粉・炎・煙は、これを色ちがいで重ねて作る。
   毎コマ createRadialGradient を呼ぶと重いので、最初に1枚だけ作って使いまわす。 */
const spriteCache = {};
export function softSprite(rgb, size = 64) {
  if (spriteCache[rgb]) return spriteCache[rgb];
  const c = offscreen(size, size, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, `rgba(${rgb},1)`);
    gr.addColorStop(0.35, `rgba(${rgb},0.6)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
  spriteCache[rgb] = c;
  return c;
}

/* 中心が明るいスプライトを、指定した大きさで置く */
export function blob(ctx, sprite, x, y, r, alpha) {
  if (alpha <= 0 || r <= 0) return;
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

/* たてよこの半径を別々に指定できる版。
   炎の粒に使う。本物の炎は上へ引き伸ばされていて、まるくない。
   粒を大きくするだけだと「ぼやけた橙のかたまり」になるので、
   のぼる速さのぶんだけ縦に伸ばして向きを出す。 */
export function blobXY(ctx, sprite, x, y, rx, ry, alpha) {
  if (alpha <= 0 || rx <= 0 || ry <= 0) return;
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite, x - rx, y - ry, rx * 2, ry * 2);
  ctx.globalAlpha = 1;
}
