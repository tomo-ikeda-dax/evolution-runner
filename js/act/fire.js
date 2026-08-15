/* ==========================================================================
   体験1: 火を絶やさない（原人）
   ==========================================================================
   「火をおこす」ではなく「火を守る」。
   原人が自ら発火させられた証拠はなく、山火事などで得た火を持ち帰って
   維持していたと考えられているため、操作もそれに合わせている。

   炎は多角形ではなく粒（パーティクル）を重ねて描いている。
   下ほど白く上ほど赤いという本物の炎の色の並びを、粒の年齢で表している。

   火の位置は地面の線（H*0.72）より手前の H*0.78 に置いてある。
   焚き火を地平線の上にちょこんと置くと、遠くの出来事に見えてしまう。
   下パネルの上端がちょうど H*0.784 なので、これ以上さげると
   炎がパネルの膜の下に埋まる。かまどの石の下半分だけが膜にかかる位置。

   大きさも見直した。以前は炎ぜんたいで画面のおよそ3%しか占めておらず、
   粒の色の移りかわりも薪の炭化も、その大きさでは見えなかった。 */

import { seeded, roughBlob, tapered, softSprite, blob, blobXY, glow } from '../paint.js';
import { heatShimmer } from '../scenes.js';

const S = {
  fuel: 62, held: 0, goal: 600, char: 0,
  flames: [], smoke: [], sparks: [],
  stones: null, logs: null, embers: null, key: ''
};

const SP = {
  white:  () => softSprite('255,248,214'),
  orange: () => softSprite('255,172,54'),
  red:    () => softSprite('255,88,18'),
  dark:   () => softSprite('132,26,6'),
  blue:   () => softSprite('126,192,255'),
  smoke:  () => softSprite('120,116,112'),
  spark:  () => softSprite('255,214,140')
};

const cxOf   = env => env.W * 0.5;
const baseOf = env => env.H * 0.78 - 6;

export const fire = {
  gauge: '火のいきおい',

  start(ui, env) {
    S.fuel = 62; S.held = 0; S.char = 0;
    S.flames = []; S.smoke = []; S.sparks = [];
    if (env) env.firelight = S.fuel / 100;
  },

  /* タップ＝薪をくべる。火が強くなり、火の粉が舞い上がる */
  down(p, env) {
    S.fuel = Math.min(100, S.fuel + 17);
    const u = env.H / 700;
    for (let i = 0; i < 18; i++) {
      S.sparks.push({
        x: cxOf(env) + (Math.random() - 0.5) * env.W * 0.20,
        y: baseOf(env) - Math.random() * env.H * 0.03,
        vx: (Math.random() - 0.5) * 1.6 * u,
        vy: -(1.4 + Math.random() * 2.6) * u,
        life: 0, max: 46 + Math.random() * 34
      });
    }
  },

  update(ui, env) {
    S.fuel -= 0.30;
    if (S.fuel <= 0) { S.fuel = 0; S.held = Math.max(0, S.held - 3); }
    else { S.held++; S.char = Math.min(1, S.char + 0.0014); }   // 薪が炭になっていく

    const power = S.fuel / 100;
    const u = env.H / 700;
    env.firelight = power;                      // 森ぜんたいの明るさに使われる

    /* 粒は「小さく・多く・薄く」。
       大きい粒を狭い範囲に重ねると、加算合成で中心が白く飽和して
       電球のような球になり、色の移りかわりも薪も見えなくなる。
       粒より広く散らすのが、炎らしい ぎざぎざの輪郭を出すこつ。 */
    for (let i = 0; i < Math.round(2 + power * 4); i++) {   // 炎の粒
      S.flames.push({
        x: (Math.random() - 0.5) * env.W * 0.16,
        y: 0,
        vx: (Math.random() - 0.5) * 0.4 * u,
        vy: -(1.75 + Math.random() * 1.5) * (0.55 + power * 0.7) * u,
        r: env.H * (0.026 + Math.random() * 0.024),
        life: 0, max: 44 + Math.random() * 32,
        ph: Math.random() * 6.28
      });
    }
    if (power > 0.15 && env.frame % 7 === 0) {              // 煙
      S.smoke.push({
        x: (Math.random() - 0.5) * env.W * 0.09,
        y: -env.H * 0.14,
        vx: (Math.random() - 0.5) * 0.3 * u,
        vy: -(0.5 + Math.random() * 0.4) * u,
        r: env.H * (0.026 + Math.random() * 0.026),
        life: 0, max: 130 + Math.random() * 70,
        ph: Math.random() * 6.28
      });
    }

    step(S.flames, p => { p.vy -= 0.012 * u; p.x += Math.sin(p.life * 0.09 + p.ph) * 0.5 * u; });
    step(S.smoke,  p => { p.x += Math.sin(p.life * 0.02 + p.ph) * 0.7 * u; p.r += 0.14 * u; });
    step(S.sparks, p => { p.vy += 0.035 * u; });

    const pct = Math.round(S.fuel);
    ui.gauge(pct + '%', pct, pct < 25);
    ui.prompt(S.fuel < 22 ? '火が消えそう！ <em>タップして えだを入れて</em>。' : null);
    if (S.held >= S.goal) ui.finish();
  },

  draw(ctx, env) {
    const cx = cxOf(env), base = baseOf(env);
    const power = S.fuel / 100;
    const lit = power * (0.85 + Math.sin(env.frame * 0.19) * 0.09 + Math.sin(env.frame * 0.41) * 0.06);
    const u = env.H / 700;
    build(env);

    // 炎の上の空気のゆらぎ。背景を貼り直すので、いちばん先に描く
    heatShimmer(ctx, env, cx,
                base - env.H * 0.47, base - env.H * 0.30,
                env.W * 0.32, 3.4 * power * u);

    /* 地面と空気に広がる火あかり。
       ここを強くしすぎると、根もとが白く飛んで炎の形が消える。
       明るさは炎の粒そのものに持たせ、これは あくまで まわりへの回り込み。 */
    ctx.save();
    ctx.translate(cx, base + env.H * 0.012);
    ctx.scale(1, 0.30);
    glow(ctx, 0, 0, env.W * 1.05, '255,146,50', 0.08 + lit * 0.22);
    ctx.restore();
    glow(ctx, cx, base - env.H * 0.035, env.W * 0.72, '255,132,40', 0.05 + lit * 0.15);

    S.stones.forEach(s => { if (s.back) stone(ctx, s, cx, base, lit); });
    S.logs.forEach(l => log(ctx, l, cx, base, lit, S.char));

    ctx.globalCompositeOperation = 'lighter';
    S.embers.forEach((e, i) => {                  // 熾き火
      const f = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(env.frame * 0.11 + i * 1.9));
      blob(ctx, SP.orange(), cx + e.x, base + e.y, e.r * 2.6, 0.5 * f * power);
    });

    /* 薪が接している所の青い炎。
       ここは酸素が足りていて完全燃焼している。橙一色の炎に
       この小さな青が入るだけで、絵ではなく燃焼に見える。 */
    S.logs.forEach((l, i) => {
      const f = 0.55 + 0.45 * Math.sin(env.frame * 0.17 + i * 2.1);
      blobXY(ctx, SP.blue(), cx + l.x2, base + l.y2 + env.H * 0.009,
             env.H * 0.015 * power, env.H * 0.024 * power, 0.30 * power * f);
    });

    S.flames.forEach(p => {                       // 炎。年齢で色が白→橙→赤→暗赤に移る
      const t = p.life / p.max;
      // 白いままの区間を短くする。長いと炎ぜんたいが白飛びして色が出ない
      const sp = t < 0.15 ? SP.white() : t < 0.42 ? SP.orange() : t < 0.72 ? SP.red() : SP.dark();
      const r = p.r * (0.55 + t * 0.85) * (1 - t * 0.2);
      // のぼる速さのぶんだけ縦に伸ばす。まるいままだと綿あめに見える
      const stretch = 1 + Math.min(1.3, Math.abs(p.vy) / u * 0.42);
      blobXY(ctx, sp, cx + p.x, base + p.y, r, r * stretch,
             (1 - t) * 0.22 * (0.35 + power * 0.65));
    });

    S.sparks.forEach(p => {                       // 舞い上がる火の粉
      blob(ctx, SP.spark(), p.x, p.y, 2.4 * u, Math.max(0, 1 - p.life / p.max) * 0.85);
    });
    ctx.globalCompositeOperation = 'source-over';

    S.smoke.forEach(p => {                        // 煙
      const t = p.life / p.max;
      blob(ctx, SP.smoke(), cx + p.x, base + p.y, p.r * (1 + t * 1.6),
           Math.sin(Math.PI * t) * 0.10 * power);
    });

    S.stones.forEach(s => { if (!s.back) stone(ctx, s, cx, base, lit); });
  }
};

function step(list, extra) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life++;
    p.x += p.vx; p.y += p.vy;
    extra(p);
    if (p.life > p.max) list.splice(i, 1);
  }
}

/* 石・薪・熾き火の位置は動かない。画面の大きさが変わったときだけ決め直す */
function build(env) {
  const key = `${Math.round(env.W)}x${Math.round(env.H)}`;
  if (S.key === key) return;
  S.key = key;
  const rand = seeded(4242);
  // かまどを大きく取る。手前に下ろしたぶん、近づいて見える大きさに合わせる。
  // 帯の幅のおよそ3分の2。ここまで寄せて はじめて石の陰影が意味を持つ
  const rx = env.W * 0.33, ry = env.H * 0.034;

  S.stones = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + 0.2;
    S.stones.push({
      x: Math.cos(a) * rx,
      y: Math.sin(a) * ry,
      r: env.W * (0.030 + rand() * 0.020),
      seed: 100 + i,
      back: Math.sin(a) < 0
    });
  }

  S.logs = [
    { x1: -env.W * 0.26, y1: env.H * 0.016, x2:  env.W * 0.06, y2: -env.H * 0.040, w1: env.W * 0.038, w2: env.W * 0.025, seed: 21 },
    { x1:  env.W * 0.27, y1: env.H * 0.014, x2: -env.W * 0.05, y2: -env.H * 0.038, w1: env.W * 0.035, w2: env.W * 0.023, seed: 22 },
    { x1: -env.W * 0.04, y1: env.H * 0.026, x2:  env.W * 0.03, y2: -env.H * 0.056, w1: env.W * 0.030, w2: env.W * 0.019, seed: 23 }
  ];

  S.embers = [];
  for (let i = 0; i < 22; i++) {
    S.embers.push({
      x: (rand() - 0.5) * env.W * 0.30,
      y: (rand() - 0.4) * env.H * 0.018,
      r: env.W * (0.008 + rand() * 0.010)
    });
  }
}

/* かまどを囲む石。火に向いた面だけ明るくすると立体に見える */
function stone(ctx, s, cx, base, lit) {
  const x = cx + s.x, y = base + s.y;
  ctx.fillStyle = '#332e29';
  roughBlob(ctx, x, y, s.r, s.r * 0.72, 0.32, seeded(s.seed), 10);
  ctx.fill();
  ctx.fillStyle = `rgba(255,140,50,${0.05 + lit * 0.30})`;
  roughBlob(ctx, x + (s.x < 0 ? s.r * 0.28 : -s.r * 0.28), y - s.r * 0.10,
            s.r * 0.62, s.r * 0.44, 0.32, seeded(s.seed + 7), 9);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  roughBlob(ctx, x, y + s.r * 0.44, s.r * 0.85, s.r * 0.22, 0.3, seeded(s.seed + 13), 8);
  ctx.fill();
}

/* 組んだ薪。中心に向いた先が燃えている。
   char は炭になった度合い（0〜1）。木は燃えるほど黒くなり、
   表面が炭になって割れ、その割れ目から中の熾きが橙に覗く。
   ずっと同じ色の棒が刺さっているだけだと、燃えている感じが出ない。 */
function log(ctx, l, cx, base, lit, char) {
  const x1 = cx + l.x1, y1 = base + l.y1;
  const x2 = cx + l.x2, y2 = base + l.y2;

  const v = 1 - char * 0.74;                      // 炭化で暗くなる
  ctx.fillStyle = `rgb(${(58 * v) | 0},${(42 * v) | 0},${(28 * v) | 0})`;
  tapered(ctx, x1, y1, x2, y2, l.w1, l.w2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {                 // 樹皮のすじ
    ctx.beginPath();
    ctx.moveTo(x1, y1 + i * l.w1 * 0.45);
    ctx.lineTo(x2, y2 + i * l.w2 * 0.45);
    ctx.stroke();
  }

  if (char > 0.06) {                              // 炭のひび割れから覗く熾き
    const rand = seeded(l.seed);
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const t = 0.30 + rand() * 0.62;             // 先に近いほど よく焼けている
      const px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t;
      const w = l.w1 + (l.w2 - l.w1) * t;
      ctx.strokeStyle = `rgba(255,${(96 + lit * 70) | 0},24,${(0.12 + lit * 0.5) * char * t})`;
      ctx.lineWidth = Math.max(1, w * 0.22);
      ctx.beginPath();
      ctx.moveTo(px, py - w * 0.4);
      ctx.lineTo(px + (rand() - 0.5) * w * 0.9, py + w * 0.4);
      ctx.stroke();
    }
  }

  ctx.fillStyle = `rgba(255,120,30,${0.20 + lit * 0.6})`;
  ctx.beginPath();
  ctx.arc(x2, y2, l.w2 * 1.15, 0, Math.PI * 2);
  ctx.fill();
}
