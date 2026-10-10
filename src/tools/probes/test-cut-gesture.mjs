/* 外27 乙组 · 分音节三步手势的时序自检。
   跑的是 w18-lyric.js 里真发出去的那几行原文：cell() 里那三行接线 + 那个 cutToggle。
   要验的是：双击进来 → 单击落刀 → 再双击出去，而双击自带的两次单击不许把刀落下去。 */
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync('D:/Programs/Flow-Desk/src/_wnw/src/w18-lyric.js', 'utf8');
const i0 = SRC.indexOf('if(!counting){');
const i1 = SRC.indexOf('\n    }', i0);
const wire = SRC.slice(i0, i1 + 6);
if(!/addEventListener\('click'/.test(wire) || !/cutToggle/.test(wire)) throw new Error('手势那段没切对：\n' + wire);
function pick(n){ const i = SRC.indexOf('\n  ' + n + '('); const j = SRC.indexOf('\n  }', i + 1); return SRC.slice(i + 1, j + 4); }
const toggle = pick('cutToggle');
if(!/cutToggle\(/.test(toggle)) throw new Error('cutToggle 没切对：\n' + toggle);

const R = []; const ok = (n, c, x) => R.push((c ? 'PASS ' : 'FAIL ') + n + (x === undefined ? '' : '  [' + x + ']'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ctx = { console, setTimeout, clearTimeout, Math, Array, String, Number, toast:() => {} };

function mk(){
  const c = { t:'长安', ms:600 };
  const H = {};
  const inp = { value:'长安', clientWidth:80, addEventListener:(k, f) => { H[k] = f; } };
  const g = vm.runInNewContext('(function(){return {' + 'cutCell:null,cutTimer:0,playing:false,rendered:0,' + toggle + '}})', ctx)();
  g.cuts = 0;
  g.render = () => { g.rendered++; }; g.touch = () => {}; g.push = () => {};
  g.toast = () => {};
  g.cutAt = (e, ip, cc) => { g.cuts++; cc.cut = [1]; };
  vm.runInNewContext('(function(inp, c){const counting=false;\n' + wire + '\n})', ctx).call(g, inp, c);
  return { g, c, inp, H };
}

/* 一、双击进来：click,click,dblclick 这一串里不许落刀 */
{
  const { g, c, H } = mk();
  H.dblclick.call(g, {});
  ok('双击之后进了分音节这一档（认的是树里那个格子）', g.cutCell === c, g.cutCell === c ? '同一个' : '不是');
  ok('进来这一下没落刀', g.cuts === 0, '落刀 ' + g.cuts + ' 次');
  H.click.call(g, { clientX:140, detail:1 });
  H.click.call(g, { clientX:140, detail:2 });
  H.dblclick.call(g, {});                       /* 第二下双击 = 出去 */
  await sleep(300);
  ok('双击出去时，那两下单击没有把刀落下去', g.cuts === 0, '落刀 ' + g.cuts + ' 次');
  ok('出去之后这一档清空', g.cutCell === null, String(g.cutCell));
}
/* 二、进来之后单击：等过那一段延迟，刀落下，且还在这一档里 */
{
  const { g, c, H } = mk();
  H.dblclick.call(g, {});
  H.click.call(g, { clientX:140, detail:1 });
  ok('单击之后先不落刀（给双击留退路）', g.cuts === 0, '落刀 ' + g.cuts + ' 次');
  await sleep(300);
  ok('等过那一段，单击的刀落下', g.cuts === 1 && c.cut && c.cut[0] === 1, '落刀 ' + g.cuts + ' 次  cut=' + JSON.stringify(c.cut));
  ok('落完刀还在这一档里（可以连着落几刀）', g.cutCell === c, String(g.cutCell === c));
}
/* 三、不在这一档时单击那一格：什么都不该发生 */
{
  const { g, H } = mk();
  H.click.call(g, { clientX:140, detail:1 });
  await sleep(300);
  ok('没进这一档，单击不落刀', g.cuts === 0, '落刀 ' + g.cuts + ' 次');
}
/* 四、不到两个字的格子进不去 */
{
  const { g, c, H } = mk();
  c.t = '真';
  H.dblclick.call(g, {});
  ok('不到两个字的格子进不了这一档', g.cutCell === null, String(g.cutCell));
}
console.log(R.join('\n'));
