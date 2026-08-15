/* ==========================================================================
   体験2: 土を払う（旧人）
   ==========================================================================
   「弔う」を体験させるのではなく「発掘する」を体験させている。
   ネアンデルタール人が意図的に埋葬したかは今も論争中であり、
   埋葬を確定事項として演出すると誤った理解を与えるため。
   掘り出したうえで「これは埋葬か、自然にそうなったのか」を考えさせる。

   土は四角い升目ではなく、1枚の絵として描いてから、なぞった所を
   ぼかしながら消している（destination-out）。本物の刷毛に近い見え方になる。
   骨と土は動かないので、それぞれ別の画用紙に一度だけ描いて使いまわす。 */

import { seeded, roughBlob, tapered, grain, offscreen } from '../paint.js';

const S = {
  cols: 18, rows: 13, grid: [], cleared: 0, total: 0,
  soil: null, body: null, key: '', strokes: [], last: null
};

const area = env => ({ x: env.W * 0.08, y: env.H * 0.30, w: env.W * 0.84, h: env.H * 0.36 });

export const dig = {
  gauge: 'ほり出したところ',

  start(ui, env) {
    S.grid = [];
    for (let r = 0; r < S.rows; r++)
      for (let c = 0; c < S.cols; c++) S.grid.push({ c, r, on: true });
    S.total = S.grid.length;
    S.cleared = 0;
    S.strokes = [];
    S.last = null;
    S.key = '';                       // 土を作り直させる
    build(env);
    ui.gauge('0%', 0, false);
  },

  down(p, env, ui) { brushAt(p, env, ui); },
  move(p, env, ui) { brushAt(p, env, ui); },

  draw(ctx, env) {
    build(env);
    const a = area(env);

    ctx.save();                                   // 掘り穴の影
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(a.x + a.w / 2, a.y + a.h * 0.55, a.w * 0.50, a.h * 0.50, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.drawImage(S.body, a.x, a.y, a.w, a.h);    // 骨
    ctx.drawImage(S.soil, a.x, a.y, a.w, a.h);    // かぶさっている土

    // 穴のふち。土のふち自体をぼかしたので、線は輪郭ではなく影の名残り程度に弱める
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(a.x + a.w / 2, a.y + a.h * 0.55, a.w * 0.50, a.h * 0.50, 0, 0, Math.PI * 2);
    ctx.stroke();

    scaleBar(ctx, a.x + a.w * 0.06, a.y + a.h * 1.06, a.w * 0.26);
  }
};

/* なぞった所の土を消す。進み具合は目に見えない升目で数える */
function brushAt(p, env, ui) {
  const a = area(env);
  const R = Math.max(22, env.W * 0.075);
  if (p.x < a.x - R || p.x > a.x + a.w + R || p.y < a.y - R || p.y > a.y + a.h + R) return;

  if (!S.last || Math.hypot(p.x - S.last.x, p.y - S.last.y) > R * 0.30) {
    S.last = { x: p.x, y: p.y };
    S.strokes.push({ x: (p.x - a.x) / a.w, y: (p.y - a.y) / a.h, r: R / a.w });
    erase(S.soil, (p.x - a.x) / a.w, (p.y - a.y) / a.h, R / a.w);
  }

  const cw = a.w / S.cols, ch = a.h / S.rows;
  let changed = false;
  S.grid.forEach(cell => {
    if (!cell.on) return;
    const x = a.x + cell.c * cw + cw / 2;
    const y = a.y + cell.r * ch + ch / 2;
    if (Math.hypot(p.x - x, p.y - y) < R) { cell.on = false; changed = true; }
  });
  if (!changed) return;

  S.cleared = S.grid.filter(c => !c.on).length;
  const pct = Math.round((S.cleared / S.total) * 100);
  ui.gauge(pct + '%', pct, false);
  if (S.cleared / S.total >= 0.86) setTimeout(() => ui.finish(), 700);
}

function erase(canvas, nx, ny, nr) {
  const g = canvas.getContext('2d');
  const x = nx * canvas.width, y = ny * canvas.height, r = nr * canvas.width;
  g.save();
  g.globalCompositeOperation = 'destination-out';
  const gr = g.createRadialGradient(x, y, r * 0.2, x, y, r);
  gr.addColorStop(0, 'rgba(0,0,0,1)');
  gr.addColorStop(0.65, 'rgba(0,0,0,0.9)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function build(env) {
  const a = area(env);
  const key = `${Math.round(a.w)}x${Math.round(a.h)}x${env.dpr}`;
  if (S.key === key) return;
  S.key = key;
  const w = Math.round(a.w * env.dpr), h = Math.round(a.h * env.dpr);
  S.body = buildBody(w, h, env.dpr, a);
  S.soil = buildSoil(w, h, env.dpr, a);
  S.strokes.forEach(s => erase(S.soil, s.x, s.y, s.r));   // 画面が変わっても掘った所は残す
}

/* --------------------------------------------------------------------------
   かぶさっている土。地層・小石・土のかたまりを描いておく
   -------------------------------------------------------------------------- */
function buildSoil(w, h, dpr, a) {
  return offscreen(w, h, g => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rand = seeded(6161);
    const W = a.w, H = a.h;

    const base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#6a5540');
    base.addColorStop(1, '#4a3a2a');
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);

    // 地層。掘るほど古い層が出てくることを色の帯で表す
    [['#7b6146', 0.18], ['#6d573e', 0.42], ['#5f4b35', 0.66], ['#54412d', 0.86]].forEach(([col, ty]) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, H * ty);
      for (let x = 0; x <= W; x += W / 14) {
        g.lineTo(x, H * ty + Math.sin(x / W * 7 + ty * 9) * H * 0.02);
      }
      g.lineTo(W, H);
      g.lineTo(0, H);
      g.closePath();
      g.fill();
    });

    for (let i = 0; i < 150; i++) {                 // 小石
      const x = rand() * W, y = rand() * H, r = 1.5 + rand() * 4.5;
      g.fillStyle = `rgba(${(150 + rand() * 60) | 0},${(138 + rand() * 50) | 0},${(120 + rand() * 44) | 0},${0.35 + rand() * 0.4})`;
      roughBlob(g, x, y, r, r * 0.7, 0.5, rand, 7);
      g.fill();
    }

    for (let i = 0; i < 90; i++) {                  // 土のかたまり（明暗をつけて凹凸に）
      const x = rand() * W, y = rand() * H, r = 4 + rand() * 12;
      roughBlob(g, x, y, r, r * 0.62, 0.5, rand, 9);
      g.fillStyle = `rgba(255,222,178,${0.04 + rand() * 0.06})`;
      g.fill();
      roughBlob(g, x + r * 0.2, y + r * 0.25, r * 0.9, r * 0.5, 0.5, rand, 9);
      g.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.08})`;
      g.fill();
    }

    grain(g, 0, 0, W, H, 2600, rand, 2);

    const edge = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.30,
                                        W / 2, H * 0.55, Math.max(W, H) * 0.62);
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = edge;
    g.fillRect(0, 0, W, H);

    /* ふちを消して、掘り場が長方形に見えないようにする。
       絵を画面ぜんたいに広げたぶん まわりの床が広くなり、
       四角い土のふちが床の上に貼った紙のように見えていた。
       たてよこの比に合わせて つぶした円で抜くと、掘った穴らしくなる。 */
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.translate(W / 2, H * 0.55);
    g.scale(1, H / W);
    const fade = g.createRadialGradient(0, 0, W * 0.30, 0, 0, W * 0.50);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = fade;
    g.fillRect(-W, -W, W * 2, W * 2);
    g.restore();
  });
}

/* --------------------------------------------------------------------------
   土の下の骨。ひざを抱えた姿勢（屈葬）を、真上から見た形で描く
   -------------------------------------------------------------------------- */
function buildBody(w, h, dpr, a) {
  return offscreen(w, h, g => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rand = seeded(3131);
    const W = a.w, H = a.h;
    const u = W;                                    // 長さの基準は穴のはば
    const ox = W * 0.5, oy = H * 0.55;

    // 墓穴らしき土の色ちがい。「掘った穴か、自然のくぼみか」が論点なので、
    // 輪郭ははっきりさせず、うっすら濃いだけにしてある
    g.fillStyle = 'rgba(52,38,24,0.55)';
    roughBlob(g, ox, oy, u * 0.40, H * 0.40, 0.14, seeded(77), 16);
    g.fill();
    grain(g, ox - u * 0.42, oy - H * 0.42, u * 0.84, H * 0.84, 500, rand, 2);

    g.save();
    g.translate(ox, oy);

    const ivory = g.createLinearGradient(0, -u * 0.14, 0, u * 0.20);
    ivory.addColorStop(0, '#f2ebd7');
    ivory.addColorStop(0.55, '#ded3b8');
    ivory.addColorStop(1, '#b8ab8d');

    g.shadowColor = 'rgba(0,0,0,0.45)';
    g.shadowBlur = u * 0.012;
    g.shadowOffsetY = u * 0.006;
    g.fillStyle = ivory;
    g.strokeStyle = 'rgba(72,58,40,0.40)';
    g.lineWidth = Math.max(0.6, u * 0.0022);

    const B = (x1, y1, x2, y2, w1, w2) => {         // 関節でふくらむ長い骨
      tapered(g, x1 * u, y1 * u, x2 * u, y2 * u, w1 * u, w2 * u);
      g.fill(); g.stroke();
      [[x1, y1, w1], [x2, y2, w2]].forEach(([x, y, r]) => {
        g.beginPath(); g.arc(x * u, y * u, r * u * 1.3, 0, Math.PI * 2); g.fill(); g.stroke();
      });
    };

    // 背骨（1つずつ積む）
    const spine = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      spine.push([-0.245 + t * 0.35, 0.004 + Math.sin(t * 2.2) * 0.012]);
    }
    spine.forEach(([x, y], i) => {
      const r = u * (0.011 + (i / 16) * 0.006);
      g.beginPath();
      g.ellipse(x * u, y * u, r, r * 0.78, 0, 0, Math.PI * 2);
      g.fill(); g.stroke();
    });

    // ろっ骨。背骨から左右に弓なりに出る
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const [vx, vy] = spine[2 + i];
      const len = 0.075 * (1 - Math.abs(t - 0.35) * 0.55);
      [-1, 1].forEach(s => {
        g.beginPath();
        g.moveTo(vx * u, vy * u);
        g.quadraticCurveTo((vx + 0.035) * u, (vy + s * len * 1.25) * u,
                           (vx + 0.075) * u, (vy + s * len) * u);
        g.lineWidth = Math.max(1.4, u * 0.0075);
        g.strokeStyle = '#e4dabf';
        g.stroke();
        g.lineWidth = Math.max(0.5, u * 0.0018);
        g.strokeStyle = 'rgba(72,58,40,0.35)';
        g.stroke();
      });
    }
    g.lineWidth = Math.max(0.6, u * 0.0022);
    g.strokeStyle = 'rgba(72,58,40,0.40)';

    // 肩・うで（胸の前で組まれている）
    [-1, 1].forEach(s => {
      roughBlob(g, -0.175 * u, s * 0.070 * u, u * 0.040, u * 0.026, 0.3, seeded(50 + s), 9);
      g.fill(); g.stroke();
      B(-0.165, s * 0.075, -0.045, s * 0.115, 0.016, 0.012);
      B(-0.045, s * 0.115, -0.175, s * 0.130, 0.012, 0.010);
      for (let i = 0; i < 4; i++) {                 // 手の指
        g.beginPath();
        g.ellipse((-0.195 - i * 0.012) * u, (s * 0.130 + (i - 1.5) * 0.010) * u,
                  u * 0.013, u * 0.005, 0.2 * s, 0, Math.PI * 2);
        g.fill(); g.stroke();
      }
    });

    // こつばん。横向きに寝ているので、板は1枚だけ見える。
    // ふとももの骨がはまる くぼみまで描くと、頭と見まちがえられない
    roughBlob(g, 0.105 * u, 0.020 * u, u * 0.064, u * 0.056, 0.28, seeded(60), 12);
    g.fill(); g.stroke();
    g.save();
    g.shadowColor = 'transparent';
    g.fillStyle = 'rgba(46,34,21,0.60)';
    g.beginPath();
    g.ellipse(0.092 * u, 0.008 * u, u * 0.028, u * 0.021, 0.25, 0, Math.PI * 2);   // 骨盤の穴
    g.fill();
    g.fillStyle = 'rgba(66,50,32,0.45)';
    g.beginPath();
    g.arc(0.128 * u, 0.050 * u, u * 0.016, 0, Math.PI * 2);                        // 関節のくぼみ
    g.fill();
    g.restore();

    // あし（ひざを胸の方へ折りたたんだ姿勢）
    [[0.030, 1], [-0.012, 1]].forEach(([d, s], k) => {
      B(0.115, s * (0.050 + d * 0.4), 0.275 + d, s * (0.115 + d * 0.5), 0.020, 0.015);
      B(0.275 + d, s * (0.115 + d * 0.5), 0.120 + d, s * (0.170 + d * 0.4), 0.015, 0.011);
      B(0.283 + d, s * (0.126 + d * 0.5), 0.132 + d, s * (0.182 + d * 0.4), 0.008, 0.006);
      for (let i = 0; i < 5; i++) {                 // 足の骨
        g.beginPath();
        g.ellipse((0.100 + d - i * 0.011) * u, (s * (0.176 + d * 0.4) + (i - 2) * 0.009) * u,
                  u * 0.012, u * 0.0045, 0.1, 0, Math.PI * 2);
        g.fill(); g.stroke();
      }
    });

    // 頭。ネアンデルタール人は前後に長く、まゆの上の骨が太い
    g.save();
    g.translate(-0.305 * u, -0.010 * u);
    g.rotate(-0.20);
    g.beginPath();
    g.ellipse(0, 0, u * 0.070, u * 0.052, 0, 0, Math.PI * 2);
    g.fill(); g.stroke();
    g.beginPath();                                   // 後頭部のふくらみ
    g.ellipse(u * 0.052, u * 0.006, u * 0.028, u * 0.032, 0, 0, Math.PI * 2);
    g.fill(); g.stroke();

    g.shadowColor = 'transparent';
    g.fillStyle = '#cdc0a2';                         // 太いまゆの骨
    g.beginPath();
    g.ellipse(-u * 0.040, -u * 0.012, u * 0.036, u * 0.014, -0.25, 0, Math.PI * 2);
    g.fill(); g.stroke();

    g.fillStyle = '#2b241a';                         // 目のあな
    g.beginPath();
    g.ellipse(-u * 0.042, u * 0.010, u * 0.018, u * 0.015, -0.1, 0, Math.PI * 2);
    g.fill();
    g.beginPath();                                   // 鼻のあな
    g.moveTo(-u * 0.062, u * 0.030);
    g.lineTo(-u * 0.046, u * 0.026);
    g.lineTo(-u * 0.056, u * 0.046);
    g.closePath();
    g.fill();

    g.fillStyle = ivory;                             // 上のあごと歯
    g.beginPath();
    g.ellipse(-u * 0.040, u * 0.043, u * 0.030, u * 0.016, -0.1, 0, Math.PI * 2);
    g.fill(); g.stroke();
    g.fillStyle = '#fbf6e6';
    for (let i = 0; i < 6; i++) {
      g.fillRect((-0.062 + i * 0.010) * u, u * 0.050, u * 0.008, u * 0.010);
    }
    g.fillStyle = ivory;                             // 下あご
    g.beginPath();
    g.ellipse(-u * 0.036, u * 0.066, u * 0.034, u * 0.014, -0.05, 0, Math.PI * 2);
    g.fill(); g.stroke();
    g.restore();

    g.restore();

    // 骨に残った土。掘りたてらしくする
    g.globalAlpha = 0.5;
    grain(g, W * 0.10, H * 0.20, W * 0.80, H * 0.62, 700, rand, 2);
    g.globalAlpha = 1;
  });
}

/* 遺跡の写真に必ず写っている白黒の物さし */
function scaleBar(ctx, x, y, w) {
  const h = Math.max(5, w * 0.09);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i % 2 ? '#111' : '#f2f2f2';
    ctx.fillRect(x + (i * w) / 5, y, w / 5, h);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}
