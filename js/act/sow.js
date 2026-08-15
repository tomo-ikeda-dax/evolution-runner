/* ==========================================================================
   体験4: 種をまく（農耕）
   ==========================================================================
   「まいたら収穫」で終わらせず、世代を重ねて粒が大きくなる形にしている。
   農耕はある日始まったのではなく1000年単位で進んだ移行であり、
   一度の収穫で完成する演出は誤解を与えるため。

   穂は長いのぎ（芒）のあるオオムギの形にしている。
   世代が進むほど粒が大きく、色も青い麦から黄金色に変わる。 */

import { seeded } from '../paint.js';

const S = { seeds: [], gen: 0, goal: 4, perGen: 6 };

/* まく場所は地面の線（H*0.44）よりずっと手前。
   奥に小さくまくと粒の大きさの変化が見えないので、株が見える距離まで下ろす */
const groundY = env => env.H * 0.78;

export const sow = {
  gauge: '何代目',

  start(ui) {
    S.seeds = [];
    S.gen = 0;
    gauge(ui);
  },

  down(p, env, ui) {
    const gy = groundY(env);
    if (p.y < gy - env.H * 0.24 || p.y > gy + env.H * 0.10) return;
    S.seeds.push({ x: p.x, grow: 0, gen: S.gen, ph: Math.random() * 6.28, seed: (S.seeds.length * 37) | 0 });

    if (S.seeds.filter(s => s.gen === S.gen).length >= S.perGen) {
      S.gen++;
      gauge(ui);
      if (S.gen >= S.goal) { setTimeout(() => ui.finish(), 900); return; }
      ui.prompt(`<em>${S.gen}代目</em>。よく実った大きいつぶをえらんで、また まこう。つぶが少しずつ大きくなるよ。`);
    }
  },

  update() {
    S.seeds.forEach(s => { if (s.grow < 1) s.grow += 0.02; });
  },

  draw(ctx, env) {
    const gy = groundY(env);
    // 奥に生えたものから描く。手前のほうが大きく見えるように少しだけずらす
    S.seeds.forEach(s => plant(ctx, env, s, gy));
  }
};

function gauge(ui) {
  ui.gauge(`${S.gen} / ${S.goal}`, (S.gen / S.goal) * 100, false);
}

/* オオムギ1本。茎・葉・穂・のぎ を分けて描く */
function plant(ctx, env, s, gy) {
  const scale = 0.55 + s.gen * 0.16;               // 世代が進むほど大きく実る
  const h = env.H * 0.19 * s.grow * scale;
  if (h < 1) return;
  const sway = Math.sin(env.frame * 0.024 + s.ph) * h * 0.07 * s.grow;
  const tipX = s.x + sway, tipY = gy - h;
  const ripe = Math.min(1, s.gen / (S.goal - 1));  // 0=青い 1=黄金色

  ctx.fillStyle = 'rgba(0,0,0,0.30)';              // 根もとの影
  ctx.beginPath();
  ctx.ellipse(s.x, gy + 2, 7 * scale, 2.6 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  const stalk = ctx.createLinearGradient(s.x, gy, tipX, tipY);
  stalk.addColorStop(0, mix('#4c7a24', '#a08a35', ripe));
  stalk.addColorStop(1, mix('#7fb03e', '#d9bd5a', ripe));
  ctx.strokeStyle = stalk;
  ctx.lineWidth = Math.max(1.6, 3.2 * scale);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(s.x, gy);
  ctx.quadraticCurveTo(s.x + sway * 0.3, gy - h * 0.55, tipX, tipY);
  ctx.stroke();

  if (s.grow > 0.35) {                             // 葉
    ctx.fillStyle = mix('#5f9a2c', '#b9a343', ripe);
    [-1, 1].forEach((d, i) => {
      const by = gy - h * (0.26 + i * 0.22);
      ctx.beginPath();
      ctx.moveTo(s.x + sway * 0.2, by);
      ctx.quadraticCurveTo(s.x + d * h * 0.30, by - h * 0.16,
                           s.x + d * h * 0.42, by - h * 0.02);
      ctx.quadraticCurveTo(s.x + d * h * 0.26, by - h * 0.04, s.x + sway * 0.2, by + h * 0.02);
      ctx.closePath();
      ctx.fill();
    });
  }

  if (s.grow > 0.55) {                             // 穂
    const rows = 4;
    const gw = 3.2 * scale, gh = 4.6 * scale;
    const grainCol = mix('#9dbb4a', '#e8c65e', ripe);
    const rand = seeded(700 + s.seed);

    ctx.strokeStyle = mix('rgba(150,180,90,0.75)', 'rgba(226,200,120,0.8)', ripe);
    ctx.lineWidth = Math.max(0.7, 1.1 * scale);
    for (let i = 0; i < rows; i++) {               // のぎ（長いひげ）
      const yy = tipY + i * gh * 0.95;
      [-1, 1].forEach(d => {
        ctx.beginPath();
        ctx.moveTo(tipX + d * gw * 0.6, yy);
        ctx.lineTo(tipX + d * gw * 2.2 + sway * 0.4, yy - h * (0.30 + rand() * 0.14));
        ctx.stroke();
      });
    }

    for (let i = 0; i < rows; i++) {               // つぶ
      const yy = tipY + i * gh * 0.95;
      [-1, 1].forEach(d => {
        ctx.fillStyle = grainCol;
        ctx.beginPath();
        ctx.ellipse(tipX + d * gw * 0.62, yy, gw, gh, d * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.ellipse(tipX + d * gw * 0.62 - gw * 0.25, yy - gh * 0.2, gw * 0.35, gh * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }
}

function mix(a, b, t) {
  if (a.startsWith('rgba')) return t < 0.5 ? a : b;
  const p = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}
