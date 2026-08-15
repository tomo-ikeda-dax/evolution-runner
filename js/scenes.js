/* ==========================================================================
   時代ごとの背景
   ==========================================================================
   背景は動かないので、画面の大きさが変わったときだけ1枚の絵として描き、
   あとは毎コマそれを貼るだけにしている（毎回描き直すとスマホで重いため）。
   ゆれる光・舞うほこりなど、動くものだけ上から重ねる。

   絵は「文字と操作の帯（9:16）」ではなく、画面ぜんたいに描く。
   各シーンは env から2種類の情報を受け取る。

     W / H        帯の大きさ。地平線の高さなど、たての位置ぎめはこれを使う。
                  火の位置（H*0.86）と地面の高さが合わなくなるため、
                  ここを画面の高さに変えてはいけない。
     x0,y0,x1,y1  実際に塗ってよい範囲。横長のPCでは x0 が大きなマイナス。
                  空・地面・木は、この範囲いっぱいに広げる。

   個数（星・木・小石など）は帯を基準にした密度から出しているので、
   画面が広がったぶんだけ自動的に増える。 */

import { seeded, roughBlob, tapered, grain, glow, softSprite, blob, offscreen } from './paint.js';

let baked = null;   // { key, canvas }

export function drawScene(ctx, env, chapter) {
  const key = `${chapter.scene}|${Math.round(env.VW)}x${Math.round(env.VH)}`
            + `|${Math.round(env.W)}x${Math.round(env.H)}|${env.bgDpr}`;
  if (!baked || baked.key !== key) baked = { key, canvas: bake(chapter.scene, env) };
  ctx.drawImage(baked.canvas, env.x0, env.y0, env.VW, env.VH);
  const anim = ANIM[chapter.scene];
  if (anim) anim(ctx, env);
}

/* 背景は前景より粗く焼く。画面ぜんたいを dpr=2 で焼くと、
   横長のPCでは前の4〜5倍の面積になって目に見えて重くなるため。
   ぼかしの多い絵なので、1.5倍から引き伸ばしても粗さは分からない。 */
function bake(scene, env) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(env.VW * env.bgDpr));
  c.height = Math.max(1, Math.round(env.VH * env.bgDpr));
  const g = c.getContext('2d');
  // 焼いた絵の左上＝ビューポートの左上。帯の座標のまま描けるよう原点をずらす
  g.setTransform(env.bgDpr, 0, 0, env.bgDpr,
                 -env.x0 * env.bgDpr, -env.y0 * env.bgDpr);
  (BUILD[scene] || BUILD.forest)(g, env);
  return c;
}

/* 各シーンが使う寸法をまとめて取り出す。
   k は「帯の何倍の幅を塗るか」。個数をこれで割り増しして密度を保つ。 */
function dims(env) {
  const { W, H, x0, y0, x1, y1 } = env;
  return { W, H, x0, y0, x1, y1, VW: x1 - x0, VH: y1 - y0, k: (x1 - x0) / W };
}

const many = (n, k) => Math.max(1, Math.round(n * k));

/* --------------------------------------------------------------------------
   夜の森（原人）── たき火のまわり。光源は火だけなので、全体を暗く保つ
   -------------------------------------------------------------------------- */
function tree(g, x, baseY, h, col, rand) {
  const w = Math.max(2, h * 0.045);
  const lean = (rand() - 0.5) * h * 0.10;
  g.fillStyle = col;
  tapered(g, x, baseY, x + lean, baseY - h, w, w * 0.3);
  g.fill();
  for (let i = 0; i < 5; i++) {                       // 枝
    const t = 0.40 + i * 0.12;
    const bx = x + lean * t, by = baseY - h * t;
    const dir = i % 2 ? 1 : -1;
    tapered(g, bx, by, bx + dir * h * (0.26 - t * 0.12), by - h * 0.13, w * 0.45, w * 0.12);
    g.fill();
  }
  for (let i = 0; i < 6; i++) {                       // 葉のかたまり
    roughBlob(g, x + lean + (rand() - 0.5) * h * 0.40, baseY - h * (0.70 + rand() * 0.30),
              h * (0.13 + rand() * 0.07), h * (0.09 + rand() * 0.05), 0.55, rand, 9);
    g.fill();
  }
}

function forest(g, env) {
  const { W, H, x0, y0, x1, y1, VW, k } = dims(env);
  const rand = seeded(9101);
  const gy = H * 0.72;                                // 地面の高さは帯の基準のまま

  const sky = g.createLinearGradient(0, y0, 0, gy);
  sky.addColorStop(0, '#060a14');
  sky.addColorStop(0.55, '#0c1523');
  sky.addColorStop(1, '#141d28');
  g.fillStyle = sky;
  g.fillRect(x0, y0, VW, gy - y0);

  for (let i = 0; i < many(80, k); i++) {             // 星
    g.fillStyle = `rgba(255,255,255,${0.08 + rand() * 0.32})`;
    g.fillRect(x0 + rand() * VW, y0 + rand() * (gy - y0) * 0.62, 1.4, 1.4);
  }

  // 奥の林。奥ほど暗く、あいだにもやを入れて奥行きを出す
  const far = many(15, k);
  for (let i = 0; i < far; i++) {
    tree(g, x0 + ((i + 0.5) / far) * VW + (rand() - 0.5) * W * 0.06, gy + H * 0.01,
         H * (0.22 + rand() * 0.12), '#0a1017', rand);
  }
  g.fillStyle = 'rgba(22,34,46,0.55)';
  g.fillRect(x0, y0, VW, gy + 2 - y0);

  const mid = many(9, k);
  for (let i = 0; i < mid; i++) {
    tree(g, x0 + ((i + 0.5) / mid) * VW + (rand() - 0.5) * W * 0.08, gy + H * 0.015,
         H * (0.32 + rand() * 0.16), '#070c12', rand);
  }
  g.fillStyle = 'rgba(16,26,36,0.42)';
  g.fillRect(x0, y0, VW, gy + 2 - y0);

  // 手前の大木は画面の左右のはしに置いて、絵ぜんたいを縁どる。
  // まん中は火のために空けておく（帯の中には立てない）
  [-0.02, 0.12, 0.88, 1.02].forEach(fx => {
    tree(g, x0 + VW * fx, gy + H * 0.03, H * (0.55 + rand() * 0.18), '#03060a', rand);
  });

  // 地面。まっすぐな線で切ると床のように見えるので、ふちを波打たせる
  const ground = g.createLinearGradient(0, gy - 12, 0, y1);
  ground.addColorStop(0, '#241a12');
  ground.addColorStop(1, '#0d0906');
  g.fillStyle = ground;
  g.beginPath();
  g.moveTo(x0, y1);
  g.lineTo(x0, gy - 6);
  for (let x = x0; x <= x1; x += VW / many(40, k)) {
    g.lineTo(x, gy - 8 + Math.sin(x / W * 9) * 4 + Math.sin(x / W * 23) * 2.5);
  }
  g.lineTo(x1, y1);
  g.closePath();
  g.fill();
  grain(g, x0, gy - 12, VW, y1 - gy + 12, many(900, k), rand, 2);

  for (let i = 0; i < many(26, k); i++) {             // ふちの草むら
    const x = x0 + rand() * VW, h = 4 + rand() * 9;
    g.strokeStyle = `rgba(26,22,14,${0.6 + rand() * 0.35})`;
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(x, gy - 4);
    g.quadraticCurveTo(x + 2, gy - 4 - h * 0.7, x + (rand() - 0.5) * 8, gy - 4 - h);
    g.stroke();
  }

  for (let i = 0; i < many(22, k); i++) {             // 落ちている石と枝
    const x = x0 + rand() * VW, y = gy + rand() * (y1 - gy) * 0.95, r = 3 + rand() * 8;
    g.fillStyle = `rgba(${(58 + rand() * 26) | 0},${(50 + rand() * 20) | 0},${(42 + rand() * 16) | 0},0.9)`;
    roughBlob(g, x, y, r, r * 0.62, 0.5, rand, 8);
    g.fill();
  }
}

/* --------------------------------------------------------------------------
   氷河期の洞くつ（旧人）── 天井の穴から冷たい光が差しこむ発掘現場
   -------------------------------------------------------------------------- */
function ice(g, env) {
  const { W, H, x0, y0, y1, VW, VH, k } = dims(env);
  const rand = seeded(3377);
  const fy = H * 0.22;                                 // ここから下が地面

  const base = g.createLinearGradient(0, y0, 0, y1);
  base.addColorStop(0, '#080d16');
  base.addColorStop(0.35, '#111a26');
  base.addColorStop(1, '#1d1c1c');
  g.fillStyle = base;
  g.fillRect(x0, y0, VW, VH);

  for (let i = 0; i < many(60, k); i++) {              // 岩肌のでこぼこ
    const x = x0 + rand() * VW, y = y0 + rand() * (fy - y0) * 1.6, r = 10 + rand() * 44;
    roughBlob(g, x - r * 0.1, y - r * 0.12, r, r * (0.45 + rand() * 0.4), 0.45, rand, 10);
    g.fillStyle = `rgba(200,225,255,${0.012 + rand() * 0.022})`;
    g.fill();
    roughBlob(g, x + r * 0.14, y + r * 0.18, r * 0.92, r * 0.48, 0.45, rand, 10);
    g.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.09})`;
    g.fill();
  }

  // 天井の穴と、そこから落ちる光の筋。
  // 穴は掘っている場所の真上にあってほしいので、帯の座標のまま置く
  const ox = W * 0.66, oy = H * 0.035, orx = W * 0.17;
  const shaft = g.createLinearGradient(0, oy, 0, y1);
  shaft.addColorStop(0, 'rgba(196,228,255,0.20)');
  shaft.addColorStop(0.55, 'rgba(176,214,250,0.07)');
  shaft.addColorStop(1, 'rgba(160,200,240,0)');
  g.fillStyle = shaft;
  g.beginPath();
  g.moveTo(ox - orx, oy);
  g.lineTo(ox + orx, oy);
  g.lineTo(ox + orx * 2.3, y1);
  g.lineTo(ox - orx * 2.8, y1);
  g.closePath();
  g.fill();

  g.fillStyle = '#9fc4e4';                             // 外の空。まぶしすぎない明るさに
  roughBlob(g, ox, oy, orx, H * 0.030, 0.5, rand, 13);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  roughBlob(g, ox - orx * 0.2, oy - H * 0.004, orx * 0.6, H * 0.016, 0.5, seeded(91), 11);
  g.fill();
  glow(g, ox, oy, W * 0.45, '190,225,255', 0.13);

  for (let i = 0; i < 14; i++) {                       // つらら
    const x = ox - orx + rand() * orx * 2;
    const len = H * (0.02 + rand() * 0.055);
    g.fillStyle = `rgba(186,214,238,${0.45 + rand() * 0.3})`;
    g.beginPath();
    g.moveTo(x - 3.5, oy + H * 0.02);
    g.lineTo(x + 3.5, oy + H * 0.02);
    g.lineTo(x, oy + H * 0.02 + len);
    g.closePath();
    g.fill();
  }

  // 発掘している地面
  const floor = g.createLinearGradient(0, fy, 0, y1);
  floor.addColorStop(0, '#3b3227');
  floor.addColorStop(0.5, '#4a3d2e');
  floor.addColorStop(1, '#2b241b');
  g.fillStyle = floor;
  g.fillRect(x0, fy, VW, y1 - fy);
  grain(g, x0, fy, VW, y1 - fy, many(1600, k), rand, 2);

  for (let i = 0; i < many(40, k); i++) {              // 地面の小石
    const x = x0 + rand() * VW, y = fy + rand() * (y1 - fy), r = 2 + rand() * 5;
    g.fillStyle = `rgba(${(120 + rand() * 40) | 0},${(110 + rand() * 34) | 0},${(96 + rand() * 30) | 0},0.55)`;
    roughBlob(g, x, y, r, r * 0.7, 0.5, rand, 7);
    g.fill();
  }

  // 発掘現場らしく、糸を張った方眼と道具を置く
  g.strokeStyle = 'rgba(255,240,200,0.16)';
  g.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const x = W * (0.04 + i * 0.23);
    g.beginPath(); g.moveTo(x, fy + H * 0.02); g.lineTo(x, H * 0.94); g.stroke();
  }
  for (let i = 0; i <= 3; i++) {
    const y = fy + H * 0.02 + i * H * 0.24;
    g.beginPath(); g.moveTo(W * 0.04, y); g.lineTo(W * 0.96, y); g.stroke();
  }

  trowel(g, W * 0.13, H * 0.87, H * 0.075, -0.5);      // 移植ごて
  brush(g, W * 0.86, H * 0.90, H * 0.065, 0.4);        // はけ
}

function trowel(g, x, y, s, rot) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = '#6b4a2a';                             // 柄
  g.fillRect(-s * 0.09, -s * 0.95, s * 0.18, s * 0.5);
  g.fillStyle = '#b9c0c8';                             // 金属の刃
  g.beginPath();
  g.moveTo(-s * 0.22, -s * 0.45);
  g.lineTo(s * 0.22, -s * 0.45);
  g.lineTo(0, s * 0.5);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.28)';
  g.beginPath();
  g.moveTo(-s * 0.14, -s * 0.42);
  g.lineTo(0, -s * 0.42);
  g.lineTo(0, s * 0.35);
  g.closePath();
  g.fill();
  g.restore();
}

function brush(g, x, y, s, rot) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = '#7a5230';
  g.fillRect(-s * 0.1, -s, s * 0.2, s * 1.1);
  g.fillStyle = '#c9a06a';
  g.beginPath();
  g.moveTo(-s * 0.16, s * 0.1);
  g.lineTo(s * 0.16, s * 0.1);
  g.lineTo(s * 0.1, s * 0.6);
  g.lineTo(-s * 0.1, s * 0.6);
  g.closePath();
  g.fill();
  g.restore();
}

/* --------------------------------------------------------------------------
   洞くつの中（新人）── たき火に照らされた岩の壁と、作業する岩だな
   -------------------------------------------------------------------------- */
function cave(g, env) {
  const { W, H, x0, y0, x1, y1, VW, VH, k } = dims(env);
  const rand = seeded(5521);
  const ly = H * 0.62;                                 // 岩だなの高さ

  const base = g.createLinearGradient(0, y0, 0, y1);
  base.addColorStop(0, '#100904');
  base.addColorStop(0.45, '#2b1a0d');
  base.addColorStop(1, '#160d06');
  g.fillStyle = base;
  g.fillRect(x0, y0, VW, VH);

  for (let i = 0; i < many(190, k); i++) {             // 岩のこぶ。明暗で凹凸を出す
    const x = x0 + rand() * VW, y = y0 + rand() * (ly - y0), r = 6 + rand() * 26;
    roughBlob(g, x - r * 0.12, y - r * 0.14, r, r * (0.45 + rand() * 0.4), 0.5, rand, 9);
    g.fillStyle = `rgba(255,196,130,${0.010 + rand() * 0.020})`;
    g.fill();
    roughBlob(g, x + r * 0.16, y + r * 0.2, r * 0.9, r * 0.46, 0.5, rand, 9);
    g.fillStyle = `rgba(0,0,0,${0.04 + rand() * 0.07})`;
    g.fill();
  }

  g.strokeStyle = 'rgba(0,0,0,0.4)';                   // ひび
  for (let i = 0; i < many(14, k); i++) {
    const x = x0 + rand() * VW, y = y0 + rand() * (ly - y0);
    g.lineWidth = 0.8 + rand() * 1.6;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + (rand() - 0.5) * W * 0.2, y + H * 0.06,
                       x + (rand() - 0.5) * W * 0.3, y + H * 0.13);
    g.stroke();
  }

  // 手前の岩だな
  const shelf = g.createLinearGradient(0, ly - H * 0.02, 0, y1);
  shelf.addColorStop(0, '#5a4229');
  shelf.addColorStop(0.2, '#3f2d1b');
  shelf.addColorStop(1, '#1c1209');
  g.fillStyle = shelf;
  g.beginPath();
  g.moveTo(x0, ly + H * 0.02);
  for (let x = x0; x <= x1; x += VW / many(10, k)) {
    g.lineTo(x, ly + Math.sin(x / W * 5) * H * 0.012);
  }
  g.lineTo(x1, y1);
  g.lineTo(x0, y1);
  g.closePath();
  g.fill();
  grain(g, x0, ly - H * 0.03, VW, y1 - ly + H * 0.03, many(900, k), rand, 2);

  // たき火のあかり。半径を画面幅にも合わせて、広げた壁の端まで届かせる
  glow(g, W * 0.5, H * 0.52, Math.max(W * 0.85, VW * 0.55), '255,150,60', 0.10);
}

/* --------------------------------------------------------------------------
   夜明けの畑（農耕）── 遠くに丘と川、手前に耕したうね
   -------------------------------------------------------------------------- */
function field(g, env) {
  const { W, H, x0, y0, x1, y1, VW, k } = dims(env);
  const rand = seeded(7714);
  const hz = H * 0.44;                                 // 地平線

  const sky = g.createLinearGradient(0, y0, 0, hz);
  sky.addColorStop(0, '#101a3e');
  sky.addColorStop(0.5, '#5c4064');
  sky.addColorStop(0.82, '#c46a4a');
  sky.addColorStop(1, '#f0a45c');
  g.fillStyle = sky;
  g.fillRect(x0, y0, VW, hz - y0);

  const sx = W * 0.70, sy = hz - H * 0.105;      // 丘に隠れない高さに置く
  glow(g, sx, sy, H * 0.30, '255,196,120', 0.55);
  g.fillStyle = '#ffe6bb';
  g.beginPath();
  g.arc(sx, sy, H * 0.026, 0, Math.PI * 2);
  g.fill();

  for (let i = 0; i < many(9, k); i++) {               // 横に流れる雲
    const y = y0 + (hz - y0) * (0.12 + rand() * 0.62);
    const w = W * (0.2 + rand() * 0.45), h = H * (0.008 + rand() * 0.014);
    g.fillStyle = `rgba(255,${(190 + rand() * 40) | 0},${(160 + rand() * 50) | 0},${0.10 + rand() * 0.16})`;
    roughBlob(g, x0 + rand() * VW, y, w / 2, h, 0.35, rand, 12);
    g.fill();
  }

  [['#2b2c46', 0.042, 7], ['#3a3350', 0.024, 11]].forEach(([col, amp, n]) => {
    const steps = many(n, k);
    g.fillStyle = col;                                 // 遠くの丘
    g.beginPath();
    g.moveTo(x0, hz);
    for (let i = 0; i <= steps; i++) {
      const x = x0 + (i / steps) * VW;
      g.lineTo(x, hz - H * amp * (0.4 + Math.abs(Math.sin(i * 1.7)) * 0.8));
    }
    g.lineTo(x1, hz);
    g.closePath();
    g.fill();
  });

  g.fillStyle = '#8a6a46';                             // 地平線の下地。
  g.fillRect(x0, hz - 1, VW, H * 0.06);                // ここが抜けると黒い帯になる

  g.fillStyle = 'rgba(240,214,186,0.35)';              // 遠くの川
  g.beginPath();
  g.moveTo(x0, hz + H * 0.010);
  g.lineTo(x1, hz + H * 0.004);
  g.lineTo(x1, hz + H * 0.022);
  g.lineTo(x0, hz + H * 0.030);
  g.closePath();
  g.fill();

  const soil = g.createLinearGradient(0, hz, 0, y1);
  soil.addColorStop(0, '#7a5f3d');
  soil.addColorStop(0.25, '#6b5231');
  soil.addColorStop(1, '#3d2c19');
  g.fillStyle = soil;
  g.fillRect(x0, hz + H * 0.022, VW, y1 - hz);

  // うね。地平線の一点に集めると遠近が出る。
  // 遠いほど細く薄くしないと、板を並べたように見えてしまう。
  // 本数は画面の広さから決める。足りないと畑の左右が更地になる
  const vx = W * 0.5, vy = hz + H * 0.03;
  const pitch = W * 0.17;
  const span = Math.ceil(Math.max(vx - x0, x1 - vx) / pitch) + 2;
  for (let n = -span; n <= span; n++) {
    const bx = vx + n * pitch;
    const wob = 1 + (n % 3) * 0.12;
    const mid = y => hz + (y1 - hz) * y;
    for (let pass = 0; pass < 2; pass++) {
      g.strokeStyle = pass ? 'rgba(255,224,178,0.09)' : 'rgba(0,0,0,0.22)';
      g.lineWidth = (pass ? 2 : 3.4) * wob;
      g.beginPath();
      g.moveTo(bx + pass * 6, y1);
      g.quadraticCurveTo((bx + vx) / 2 + pass * 4, mid(0.42), vx + n * W * 0.010 + pass, vy);
      g.stroke();
    }
  }
  const haze = g.createLinearGradient(0, hz, 0, hz + (H - hz) * 0.45);
  haze.addColorStop(0, 'rgba(224,168,110,0.55)');       // 遠くをかすませて奥行きを出す
  haze.addColorStop(1, 'rgba(224,168,110,0)');
  g.fillStyle = haze;
  g.fillRect(x0, hz + H * 0.02, VW, (H - hz) * 0.45);

  grain(g, x0, hz, VW, y1 - hz, many(1500, k), rand, 2);

  for (let i = 0; i < many(60, k); i++) {              // 土のかたまり
    const t = rand();
    const y = hz + H * 0.05 + t * t * (y1 - hz) * 0.95;
    const r = 2 + t * 9;
    const x = x0 + rand() * VW;
    g.fillStyle = `rgba(${(96 + rand() * 30) | 0},${(76 + rand() * 24) | 0},${(50 + rand() * 20) | 0},0.85)`;
    roughBlob(g, x, y, r, r * 0.6, 0.5, rand, 8);
    g.fill();
    g.fillStyle = 'rgba(255,214,160,0.10)';
    roughBlob(g, x - r * 0.2, y - r * 0.25, r * 0.6, r * 0.3, 0.5, rand, 7);
    g.fill();
  }
}

/* --------------------------------------------------------------------------
   この先（未来）── 事実がないので、星空と人の影だけにしている
   -------------------------------------------------------------------------- */
function future(g, env) {
  const { W, H, x0, y0, x1, y1, VW, VH, k } = dims(env);
  const rand = seeded(2468);
  const sky = g.createLinearGradient(0, y0, 0, y1);
  sky.addColorStop(0, '#01030a');
  sky.addColorStop(0.55, '#080f24');
  sky.addColorStop(1, '#111a33');
  g.fillStyle = sky;
  g.fillRect(x0, y0, VW, VH);

  g.save();                                            // 天の川
  g.translate(W * 0.5, H * 0.34);
  g.rotate(-0.42);
  const band = g.createLinearGradient(0, -H * 0.12, 0, H * 0.12);
  band.addColorStop(0, 'rgba(120,150,220,0)');
  band.addColorStop(0.5, 'rgba(150,175,235,0.10)');
  band.addColorStop(1, 'rgba(120,150,220,0)');
  g.fillStyle = band;
  const reach = Math.hypot(VW, VH);                    // 回してもはみ出さない長さ
  g.fillRect(-reach, -H * 0.12, reach * 2, H * 0.24);
  g.restore();

  /* 地平線。以前は H*0.86 にあり、空を見上げる人の下半分が
     下パネルに隠れていた。パネルを透かしたことで隠れなくなったかわりに
     文字と重なるようになったので、人がまるごと見える高さまで上げる。 */
  const hy = H * 0.74;
  for (let i = 0; i < many(260, k); i++) {
    const x = x0 + rand() * VW, y = y0 + rand() * (hy - y0);
    const s = rand();
    g.fillStyle = `rgba(${s > 0.9 ? '190,210,255' : '255,255,255'},${0.12 + s * 0.55})`;
    g.fillRect(x, y, s > 0.93 ? 2.2 : 1.3, s > 0.93 ? 2.2 : 1.3);
  }

  g.fillStyle = '#02040a';
  g.beginPath();
  g.moveTo(x0, y1);
  g.lineTo(x0, hy + H * 0.02);
  for (let x = x0; x <= x1; x += VW / many(60, k)) {
    g.lineTo(x, hy + Math.sin(x / W * 6) * H * 0.012);
  }
  g.lineTo(x1, y1);
  g.closePath();
  g.fill();

  // 空を見上げて立っている人。この先を見ているのは、いつも人のほう
  const px = W * 0.46, py = hy - H * 0.004, ph = H * 0.135;
  g.fillStyle = '#01030a';
  tapered(g, px - ph * 0.05, py, px - ph * 0.055, py - ph * 0.42, ph * 0.055, ph * 0.045);  // 足
  g.fill();
  tapered(g, px + ph * 0.05, py, px + ph * 0.065, py - ph * 0.42, ph * 0.055, ph * 0.045);
  g.fill();
  tapered(g, px, py - ph * 0.38, px + ph * 0.02, py - ph * 0.80, ph * 0.115, ph * 0.135);   // 胴
  g.fill();
  tapered(g, px - ph * 0.11, py - ph * 0.76, px - ph * 0.17, py - ph * 0.40, ph * 0.042, ph * 0.032); // うで
  g.fill();
  tapered(g, px + ph * 0.13, py - ph * 0.76, px + ph * 0.19, py - ph * 0.42, ph * 0.042, ph * 0.032);
  g.fill();
  tapered(g, px + ph * 0.02, py - ph * 0.80, px + ph * 0.05, py - ph * 0.90, ph * 0.05, ph * 0.05);   // 首
  g.fill();
  g.beginPath();                                       // 頭。少し上を向いている
  g.ellipse(px + ph * 0.075, py - ph * 0.99, ph * 0.10, ph * 0.115, 0.35, 0, Math.PI * 2);
  g.fill();
}

const BUILD = { forest, ice, cave, field, future };

/* --------------------------------------------------------------------------
   動くもの（背景の上に毎コマ重ねる）
   -------------------------------------------------------------------------- */
let motes = null;

const ANIM = {
  /* 光の筋のなかを舞うほこり。発掘現場の空気感を出す。
     光の筋は帯の中にあるので、ほこりもそのまわりに置く */
  ice(ctx, env) {
    if (!motes || motes.W !== env.W || motes.y0 !== env.y0) {
      const rand = seeded(818);
      motes = { W: env.W, y0: env.y0, list: [] };
      for (let i = 0; i < 34; i++) {
        motes.list.push({
          x: env.W * (0.30 + rand() * 0.62),
          y: env.y0 + rand() * (env.y1 - env.y0),
          r: 0.8 + rand() * 1.8,
          sp: 0.10 + rand() * 0.30,
          ph: rand() * 6.28
        });
      }
    }
    const sp = softSprite('220,240,255');
    motes.list.forEach(m => {
      m.y += m.sp;
      if (m.y > env.y1) { m.y = env.y0 - 4; }
      const x = m.x + Math.sin(env.frame * 0.012 + m.ph) * env.W * 0.02;
      blob(ctx, sp, x, m.y, m.r * 2.4, 0.34);
    });
  },

  /* たき火のゆらぎ。壁の明るさが呼吸するように変わる */
  cave(ctx, env) {
    const f = 0.72 + Math.sin(env.frame * 0.07) * 0.10 + Math.sin(env.frame * 0.23) * 0.05;
    glow(ctx, env.W * 0.5, env.H * 0.58,
         Math.max(env.W * 0.95, env.VW * 0.60), '255,146,54', 0.13 * f);
  },

  /* 星のまたたき */
  future(ctx, env) {
    const rand = seeded(1357);
    const n = many(26, (env.x1 - env.x0) / env.W);
    for (let i = 0; i < n; i++) {
      const x = env.x0 + rand() * (env.x1 - env.x0);
      const y = env.y0 + rand() * (env.H * 0.74 - env.y0);
      const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(env.frame * 0.05 + i * 1.7));
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(x, y, 1.6, 1.6);
    }
  }
};

/* ==========================================================================
   いちばん手前の草木
   ==========================================================================
   遠くの木を細かく描いても、その距離では葉の1枚も見えない。
   植物を「本物らしく」見せる近道は、精度を上げることではなく、
   1枚を大きく手前に置いて葉脈とふちのギザギザが見える距離まで寄せること。

   火より手前に立つので、背景ではなく体験の描画のあとに重ねる。 */

export function drawForeground(ctx, env, chapter) {
  const fg = FOREGROUND[chapter.scene];
  if (fg) fg(ctx, env);
}

/* 陽炎。炎の上の空気がゆらいで、その向こうの景色がよじれて見える。
   焼いた背景から帯状に切り出して、横にずらしながら貼り直している。
   炎そのものより先に描く必要があるので、fire.js の draw の先頭から呼ぶ。 */
export function heatShimmer(ctx, env, cx, yTop, yBot, halfW, amp) {
  if (!baked || amp < 0.3 || yBot <= yTop || halfW <= 0) return;
  const s = env.bgDpr;
  const bands = 10, cols = 5;                     // 貼り直す枚数。増やすと目に見えて重い
  const bh = (yBot - yTop) / bands;
  const cw = (halfW * 2) / cols;

  for (let i = 0; i < bands; i++) {
    const sy = yBot - (i + 1) * bh;               // 下（炎ぎわ）から上へ
    const t = i / bands;
    const fall = (1 - t) * (1 - t);               // 上へ行くほど弱まる
    for (let j = 0; j < cols; j++) {
      const sx = cx - halfW + j * cw;
      /* 左右のはしではずらさない。一様にずらすと、貼り直した長方形の
         ふちが継ぎ目になって「四角い窓」に見えてしまう */
      const edge = Math.sin(Math.PI * (j / (cols - 1)));
      const dx = Math.sin(env.frame * 0.075 + i * 0.85 + j * 0.4) * amp * fall * edge;
      ctx.drawImage(
        baked.canvas,
        (sx - env.x0) * s, (sy - env.y0) * s, cw * s + 1, bh * s + 1,
        sx + dx, sy, cw + 1, bh + 1
      );
    }
  }
}

/* 葉1枚。基部は細く、中ほどでいちばん広がり、先がとがる。
   ふちは1つおきに内側へ寄せて切れこみにしている。 */
function leaf(ctx, x, y, len, ang, lit, seed) {
  const rand = seeded(seed);
  const w = len * 0.26;
  const prof = t => Math.sin(Math.PI * Math.pow(t, 0.62)) * w;
  const n = 14;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    ctx.lineTo(prof(t) * (i % 2 ? 0.84 : 1), -len * t);
  }
  for (let i = n; i >= 1; i--) {
    const t = i / n;
    ctx.lineTo(-prof(t) * (i % 2 ? 1 : 0.84), -len * t);
  }
  ctx.closePath();

  // 火に近い根もとが明るく、先へ行くほど闇にとける
  const body = ctx.createLinearGradient(0, 0, 0, -len);
  body.addColorStop(0, `rgb(${(16 + lit * 78) | 0},${(22 + lit * 44) | 0},${(14 + lit * 16) | 0})`);
  body.addColorStop(1, '#05080a');
  ctx.fillStyle = body;
  ctx.fill();

  ctx.save();
  ctx.clip();                                   // 葉脈は葉の内側だけに
  // 夜の葉なので、葉脈は「見えるか見えないか」でよい。
  // はっきり描くと枯れ葉の標本のようになり、暗い森から浮いてしまう
  ctx.strokeStyle = `rgba(${(96 + lit * 60) | 0},${(84 + lit * 34) | 0},52,${0.05 + lit * 0.11})`;
  ctx.lineWidth = Math.max(0.8, len * 0.012);
  ctx.beginPath();                              // 主脈
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -len);
  ctx.stroke();
  ctx.lineWidth = Math.max(0.5, len * 0.006);
  for (let i = 1; i <= 7; i++) {                // 側脈
    const t = i / 8;
    const yy = -len * t;
    [-1, 1].forEach(d => {
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.quadraticCurveTo(d * prof(t) * 0.45, yy - len * 0.02,
                           d * prof(t) * 0.95, yy - len * (0.055 + rand() * 0.02));
      ctx.stroke();
    });
  }
  ctx.restore();

  // 火に向いたふちだけ光る。これがないと ただの黒い影に見える
  ctx.strokeStyle = `rgba(255,150,60,${0.05 + lit * 0.20})`;
  ctx.lineWidth = Math.max(1, len * 0.010);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    ctx.lineTo(prof(t) * (i % 2 ? 0.84 : 1), -len * t);
  }
  ctx.stroke();
  ctx.restore();
}

/* 葉は毎コマ描くと重い（1枚あたり clip とグラデーションと30本ほどの線）。
   火あかりで見え方が変わるので、「暗いとき」と「明るいとき」の2枚を
   焼いておき、火の勢いで重ねる濃さだけ変える。 */
let leafLayer = null;

function buildLeafLayer(env) {
  const { W, H, x0, y0, x1, y1, VW, VH } = dims(env);
  const key = `${Math.round(VW)}x${Math.round(VH)}|${Math.round(W)}`;
  if (leafLayer && leafLayer.key === key) return leafLayer;

  const rand = seeded(4815162342);
  const anchors = [
    { x: x0 + VW * 0.015, y: y1 + H * 0.02, a:  0.42, len: 0.36 },
    { x: x0 + VW * 0.085, y: y1 + H * 0.06, a:  0.86, len: 0.28 },
    { x: x1 - VW * 0.015, y: y1 + H * 0.02, a: -0.42, len: 0.36 },
    { x: x1 - VW * 0.085, y: y1 + H * 0.06, a: -0.86, len: 0.28 }
  ];

  // 画面が広いほど、余った左右に葉を足して密度を保つ
  const extra = Math.max(0, Math.round((VW / W - 1) * 3));
  for (let i = 0; i < extra; i++) {
    const side = i % 2 ? 1 : -1;
    const t = 0.15 + (i / (extra + 1)) * 0.18;
    anchors.push({
      x: side < 0 ? x0 + VW * t : x1 - VW * t,
      y: y1 + H * (0.03 + rand() * 0.05),
      a: side * (0.62 + rand() * 0.45),
      len: 0.22 + rand() * 0.10
    });
  }

  const paint = lit => g => {
    g.translate(-x0, -y0);                       // 焼く絵の左上＝ビューポートの左上
    anchors.forEach((p, i) => {
      if (p.x > W * 0.15 && p.x < W * 0.85) return;   // 火の前には置かない
      leaf(g, p.x, p.y, H * p.len, p.a, lit, 300 + i * 17);
    });
  };

  leafLayer = { key, dark: offscreen(VW, VH, paint(0)), lit: offscreen(VW, VH, paint(1)) };
  return leafLayer;
}

const FOREGROUND = {
  /* 夜の森。画面の下の左右から、大きな葉が数枚さしかかる。
     まん中は火のために必ず空ける（葉で火を隠しては意味がない）。 */
  forest(ctx, env) {
    const { W, H, x0, y0, VW, VH } = dims(env);
    const lit = Math.min(1, env.firelight);

    /* たき火が森ぜんたいを照らす。
       焼いた背景は暗いままなので、火あかりを毎コマ上から重ねる。
       炎そのものより後に重ねているのは、陽炎が背景を貼り直すため。
       先に重ねると、そこだけ四角く暗く抜けてしまう。
       火が弱ると森が闇に沈むので、「消えそう」がゲージでなく絵で分かる。 */
    if (lit > 0.01) {
      const flick = 0.86 + Math.sin(env.frame * 0.09) * 0.09
                         + Math.sin(env.frame * 0.27) * 0.05;
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, W * 0.5, H * 0.80,
           Math.max(W * 1.5, VW * 0.72), '255,138,48', 0.085 * lit * flick);
      ctx.globalCompositeOperation = 'source-over';
    }

    // 焼いておいた葉を貼る。ゆれは絵ぜんたいを1〜2pxずらすだけで足りる
    const L = buildLeafLayer(env);
    const sway = Math.sin(env.frame * 0.013) * 1.6;
    ctx.drawImage(L.dark, x0 + sway, y0, VW, VH);
    if (lit > 0.01) {
      ctx.globalAlpha = lit;
      ctx.drawImage(L.lit, x0 + sway, y0, VW, VH);
      ctx.globalAlpha = 1;
    }
  },

  /* 夜明けの畑。手前に大麦を2株だけ大きく立てる。
     奥のうねは線で表しているので、近景に1株あるだけで「畑」になる。 */
  field(ctx, env) {
    const { H, x0, x1, y1, VW } = dims(env);
    [[x0 + VW * 0.10, 0.30, -0.06], [x1 - VW * 0.12, 0.26, 0.08]].forEach((p, i) => {
      const [x, hf, tilt] = p;
      const h = H * hf;
      const sway = Math.sin(env.frame * 0.017 + i * 2.3) * 0.035;
      bigStalk(ctx, x, y1 + H * 0.02, h, tilt + sway, 500 + i * 31);
    });
  }
};

/* 手前の大麦1株。夜明けの空に対する逆光なので、色より形で見せる */
function bigStalk(ctx, x, base, h, tilt, seed) {
  const rand = seeded(seed);
  ctx.save();
  ctx.translate(x, base);
  ctx.rotate(tilt);

  ctx.strokeStyle = '#2a2416';                     // 茎
  ctx.lineWidth = Math.max(2, h * 0.016);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(h * 0.05, -h * 0.55, h * 0.02, -h);
  ctx.stroke();

  ctx.fillStyle = '#2f2818';                       // 葉
  [-1, 1].forEach((d, i) => {
    const by = -h * (0.24 + i * 0.20);
    ctx.beginPath();
    ctx.moveTo(0, by);
    ctx.quadraticCurveTo(d * h * 0.26, by - h * 0.15, d * h * 0.40, by + h * 0.02);
    ctx.quadraticCurveTo(d * h * 0.22, by - h * 0.03, 0, by + h * 0.03);
    ctx.closePath();
    ctx.fill();
  });

  const tipY = -h, gw = h * 0.028, gh = h * 0.040;
  ctx.strokeStyle = 'rgba(58,50,30,0.85)';         // のぎ
  ctx.lineWidth = Math.max(1, h * 0.006);
  for (let i = 0; i < 5; i++) {
    const yy = tipY + i * gh * 0.95;
    [-1, 1].forEach(d => {
      ctx.beginPath();
      ctx.moveTo(h * 0.02 + d * gw * 0.6, yy);
      ctx.lineTo(h * 0.02 + d * gw * 2.4, yy - h * (0.26 + rand() * 0.12));
      ctx.stroke();
    });
  }
  for (let i = 0; i < 5; i++) {                    // つぶ
    const yy = tipY + i * gh * 0.95;
    [-1, 1].forEach(d => {
      ctx.fillStyle = '#3a3120';
      ctx.beginPath();
      ctx.ellipse(h * 0.02 + d * gw * 0.62, yy, gw, gh, d * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,206,140,0.20)';    // 朝日のふちどり
      ctx.beginPath();
      ctx.ellipse(h * 0.02 + d * gw * 0.62 - gw * 0.3, yy - gh * 0.22,
                  gw * 0.34, gh * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.restore();
}
