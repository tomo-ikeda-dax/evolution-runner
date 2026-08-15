/* ==========================================================================
   画面の流れと入力
   ==========================================================================
   タイトル → オープニング映像 → 各章（体験 → 事実カード）→ 年表。
   体験そのものは js/act/ の各ファイルが持ち、ここは順番と入口だけを扱う。 */

import { CHAPTERS, SPAN } from './chapters.js';
import { drawScene, drawForeground } from './scenes.js';
import { vignette } from './paint.js';
import { fire } from './act/fire.js';
import { dig } from './act/dig.js';
import { trace } from './act/trace.js';
import { sow } from './act/sow.js';

const ACTS = { fire, dig, trace, sow };

const el = id => document.getElementById(id);
const stage = el('stage');
const canvas = el('scene');
const ctx = canvas.getContext('2d');

/* 座標のきまり
   ------------------------------------------------------------------
   W / H  … 文字と操作の枠（9:16 の帯）の大きさ。原点(0,0)はその左上。
            体験（js/act/）はすべてこの座標で書く。帯の中に収まる。
   x0..y1 … 実際に絵を描ける範囲を、同じ帯の座標で表したもの。
            横長のPCでは x0 が大きなマイナスになり、画面の端まで広がる。
            縦画面のスマホでは帯とほぼ一致するので、見え方は変わらない。
   dpr    … 前景（火の粒など）の描画倍率。
   bgDpr  … 背景の焼きつけ倍率。全画面ぶんを dpr=2 で焼くと重いので落とす。 */
const env = {
  W: 0, H: 0,
  x0: 0, y0: 0, x1: 0, y1: 0, VW: 0, VH: 0,
  dpr: 1, bgDpr: 1, frame: 0,
  firelight: 0.7            // 火の明るさ。fire.js が毎コマ書き、背景側が読む
};
let chapterIndex = 0;
let state = 'title';        // title | play | card

function resize() {
  const r = stage.getBoundingClientRect();
  const c = canvas.getBoundingClientRect();   // = ビューポート（fixed inset:0）

  env.dpr = Math.min(window.devicePixelRatio || 1, 2);
  env.bgDpr = Math.min(env.dpr, 1.5);
  env.W = r.width;
  env.H = r.height;
  env.VW = c.width;
  env.VH = c.height;
  env.x0 = c.left - r.left;                   // 帯の左上から見たビューポートの左上
  env.y0 = c.top - r.top;
  env.x1 = env.x0 + c.width;
  env.y1 = env.y0 + c.height;

  canvas.width = Math.round(c.width * env.dpr);
  canvas.height = Math.round(c.height * env.dpr);
  // 原点を帯の左上へずらす。これで体験側は今までどおりの座標で書ける
  ctx.setTransform(env.dpr, 0, 0, env.dpr,
                   (r.left - c.left) * env.dpr, (r.top - c.top) * env.dpr);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);

/* 体験から画面へ触れる口。体験側がDOMを直接いじらないようにしている */
const ui = {
  gauge(text, pct, low) {
    el('gaugeVal').textContent = text;
    el('gaugeFill').style.width = Math.max(0, Math.min(100, pct)) + '%';
    el('gaugeFill').classList.toggle('low', !!low);
  },
  prompt(html) {
    const c = CHAPTERS[chapterIndex];
    el('prompt').innerHTML = (html == null) ? c.prompt : html;
  },
  finish() {
    if (state === 'play') finishInteraction();
  }
};

/* --------------------------------------------------------------------------
   章の進行
   -------------------------------------------------------------------------- */
function renderDots() {
  el('dots').innerHTML = CHAPTERS.map((c, i) =>
    `<span class="dot ${i < chapterIndex ? 'done' : (i === chapterIndex ? 'now' : '')}"></span>`
  ).join('');
}

function openChapter(i) {
  chapterIndex = i;
  const c = CHAPTERS[i];
  state = 'play';
  renderDots();
  el('eraName').textContent = c.name;
  el('eraSub').textContent = c.sub;
  el('eraWhen').textContent = c.when;
  el('cardScreen').classList.remove('show');

  if (c.pending) {
    el('prompt').innerHTML = 'この時代のお話は<em>じゅんび中</em>です。<br>調べおわったら、たいけんと説明が入ります。';
    el('gaugeWrap').classList.remove('show');
    el('panel').classList.remove('lean');
    el('mainBtn').textContent = 'つぎへ';
    el('mainBtn').onclick = () => nextChapter();
    return;
  }

  el('prompt').innerHTML = c.prompt;
  const act = ACTS[c.interaction];
  if (act) {
    el('gaugeWrap').classList.add('show');
    // 体験中はパネルを薄くする。絵に使える高さがおよそ40px増える
    el('panel').classList.add('lean');
    el('gaugeName').textContent = act.gauge;
    el('mainBtn').textContent = 'スキップ';
    el('mainBtn').onclick = () => finishInteraction();
    act.start(ui, env);
  } else {
    el('gaugeWrap').classList.remove('show');
    el('panel').classList.remove('lean');
    el('mainBtn').textContent = 'すすむ';
    el('mainBtn').onclick = () => finishInteraction();
  }
}

function finishInteraction() {
  const c = CHAPTERS[chapterIndex];
  el('gaugeWrap').classList.remove('show');
  el('panel').classList.remove('lean');
  if (!c.card) { nextChapter(); return; }
  state = 'card';
  el('cardTitle').textContent = `${c.name}（${c.sub}）`;
  el('cardWhen').textContent = c.when;
  const f = c.card;
  const block = (cls, head, items) =>
    items && items.length
      ? `<div class="fact ${cls}"><h3>${head}</h3>${items.map(t => `<p>${t}</p>`).join('')}</div>`
      : '';
  el('cardBody').innerHTML =
    block('certain', 'たしかなこと', f.certain) +
    block('debated', 'まだわかっていないこと', f.debated) +
    block('updated', 'むかしと変わったこと', f.updated) +
    (f.src ? `<div class="src">もとにした研究<br>${f.src.join('<br>')}</div>` : '');
  el('cardScreen').classList.add('show');
}

function nextChapter() {
  if (chapterIndex + 1 < CHAPTERS.length) openChapter(chapterIndex + 1);
  else showTimeline();
}

/* 年表。棒の重なりで「一直線の階段ではない」ことを目で見せるのが目的 */
function showTimeline() {
  state = 'card';
  const L = v => Math.log10(Math.max(v, 8000));
  const lo = L(2200000), hi = L(8000);
  const pos = v => ((lo - L(v)) / (lo - hi)) * 100;

  const bars = SPAN.map(s => {
    const a = pos(s.from), b = pos(s.to);
    return `<div style="margin-bottom:11px;">
      <div style="font-size:11px;color:#cfd5e4;margin-bottom:3px;">${s.name}</div>
      <div style="position:relative;height:13px;background:#161c2c;border-radius:7px;">
        <div style="position:absolute;left:${a}%;width:${Math.max(3, b - a)}%;top:0;bottom:0;
                    background:${s.color};border-radius:7px;"></div>
      </div>
    </div>`;
  }).join('');

  el('cardTitle').textContent = '人類のあゆみは、階段じゃなかった';
  el('cardWhen').textContent = '← むかし ／ 今 →（めもりのはばは同じではありません）';
  el('cardBody').innerHTML = bars +
    `<div class="fact certain"><h3>ぼうが かさなっているのを見て</h3>
      <p>ネアンデルタール人とホモ・サピエンスは、
      <b>26万年もいっしょに生きていました</b>。
      かた方が、もう かた方に変わったのではありません。
      同じ先ぞから分かれた、<b>べつのなかま</b>です。
      長いあいだ、となり合ってくらしていました。</p>
      <p>「原人 → 旧人 → 新人」というならべ方は、順番をおぼえるのに べんりです。
      でも、<b>一列に進んだという意味ではありません</b>。
      人類の歴史は、1本の階段ではありません。枝分かれした木です。
      えだの多くは、とちゅうで かれました。さいごまで残ったのが、わたしたちです。</p></div>` +
    `<div class="src">年代のもと: Smithsonian National Museum of Natural History,
      Human Origins Program（いくつかのページ）<br>
      くわしい理由と出典は docs/human-evolution-facts.md にまとめています</div>`;
  el('cardNext').textContent = 'はじめから';
  el('cardScreen').classList.add('show');
  el('cardNext').onclick = () => {
    el('cardNext').textContent = 'つぎの時代へ';
    el('cardNext').onclick = () => nextChapter();
    openChapter(0);
  };
}

el('cardNext').onclick = () => nextChapter();

/* --------------------------------------------------------------------------
   オープニング映像
   -------------------------------------------------------------------------- */
const introScreen = el('introScreen');
const introVideo = el('introVideo');
let introTimer = null;

function endIntro() {
  if (introScreen.style.visibility === 'hidden') return;
  clearTimeout(introTimer);
  introScreen.style.opacity = '0';
  introScreen.style.visibility = 'hidden';
  try { introVideo.pause(); } catch (e) {}
  resize();
  openChapter(0);
}

el('btnSkipIntro').onclick = endIntro;
introVideo.addEventListener('ended', endIntro);
introVideo.addEventListener('error', endIntro);

/* 音つきの自動再生は禁止されているため、「はじめる」を押した
   この瞬間（＝ユーザー操作）に再生する。
   再生できなければ必ず本編へ進ませ、映像で詰まらせない。 */
el('startBtn').onclick = () => {
  el('titleScreen').classList.add('hide');
  introScreen.style.visibility = 'visible';
  introScreen.style.opacity = '1';
  try { introVideo.currentTime = 0; } catch (e) {}
  introVideo.muted = false;
  const p = introVideo.play();
  if (p && p.catch) p.catch(() => {
    introVideo.muted = true;
    const r = introVideo.play();
    if (r && r.catch) r.catch(endIntro);
  });
  introTimer = setTimeout(() => {
    if (introVideo.paused || introVideo.currentTime === 0) endIntro();
  }, 5000);
};

/* --------------------------------------------------------------------------
   入力
   -------------------------------------------------------------------------- */
let dragging = false;

/* キャンバスは画面全面だが、体験側の座標は帯の左上が原点。
   だから canvas ではなく stage を基準に測る */
function localPos(e) {
  const r = stage.getBoundingClientRect();
  const t = e.touches ? e.touches[0] : e;
  return { x: t.clientX - r.left, y: t.clientY - r.top };
}

function currentAct() {
  const c = CHAPTERS[chapterIndex];
  return c ? ACTS[c.interaction] : null;
}

function onDown(e) {
  if (state !== 'play') return;
  const act = currentAct();
  if (!act || !act.down) return;
  e.preventDefault();
  dragging = true;
  act.down(localPos(e), env, ui);
}

function onMove(e) {
  if (!dragging || state !== 'play') return;
  const act = currentAct();
  if (!act || !act.move) return;
  e.preventDefault();
  act.move(localPos(e), env, ui);
}

function onUp() { dragging = false; }

canvas.addEventListener('touchstart', onDown, { passive: false });
canvas.addEventListener('touchmove', onMove, { passive: false });
canvas.addEventListener('touchend', onUp);
canvas.addEventListener('mousedown', onDown);
canvas.addEventListener('mousemove', onMove);
window.addEventListener('mouseup', onUp);

/* --------------------------------------------------------------------------
   メインループ（60fps固定）
   -------------------------------------------------------------------------- */
const DT = 1000 / 60;
let last = 0, acc = 0;

function tick() {
  env.frame++;
  if (state !== 'play') return;
  const act = currentAct();
  if (act && act.update) act.update(ui, env);
}

function draw() {
  const c = CHAPTERS[chapterIndex] || CHAPTERS[0];
  drawScene(ctx, env, c);
  const act = ACTS[c.interaction];
  if (act && act.draw) act.draw(ctx, env);
  drawForeground(ctx, env, c);      // いちばん手前の草木。火より前に立つ
  vignette(ctx, env, 0.45);
}

function loop(now) {
  requestAnimationFrame(loop);
  if (!last) { last = now; return; }
  let d = now - last;
  last = now;
  if (d > 200) d = DT;
  acc += d;
  let steps = 0;
  while (acc >= DT && steps < 5) { tick(); acc -= DT; steps++; }
  draw();
}

resize();
renderDots();
requestAnimationFrame(loop);
