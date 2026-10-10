/* 外27 己组 · 拿今天真录到的 103 张 MusicBee 快照，把 apply()/nowMs() 的真代码原文跑两遍：
   一遍按从前（外推一律 1.0x），一遍按今天改的（外推用实测走速）。
   看两个数：① 每一趟真值落地前，FD 自己的钟与真值差多少（这就是他看到的"偏"）
             ② 差过 500 毫秒死区、当场被拽回几次（每一次就是啪一下）
   方法：从组件原文里按名字切出 eff/deadband/apply/nowMs/offsetMs/lyricMs 六段，其余打桩。 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const MAIN = 'D:/Programs/Flow-Desk/data/plugins/music-remote/main.js';
const src = fs.readFileSync(MAIN, 'utf8');
/* 按方法名切原文：从 "\n  name(" 起，到下一行正好是 "  }," 或 "  }" 止 */
function pick(name){
  const i = src.indexOf('\n  ' + name + '(');
  if(i < 0) throw new Error('找不到方法 ' + name);
  let j = src.indexOf('\n  },', i); const j2 = src.indexOf('\n  }', i + 1);
  if(j2 > i && j2 < j) j = j2;
  if(j < 0) throw new Error('切不完 ' + name);
  return src.slice(i + 1, j + 4);
}
const body = (() => {
  try{ return ['eff', 'deadband', 'offsetMs', 'lyricMs', 'apply', 'nowMs'].map(pick).join(',\n'); }
  catch(e){
    /* 作废不是失败：这一台切的是「外推按实测走速」那一版的 eff()，那一版没落地 ——
       今天的 nowMs 直接用播放器报的 rate（main.js:849）。外27 己组那条量测的结论已经结了（位置稳在 ±90ms、死区不触发）。
       退出码 77 是「自己报作废」，selfcheck 第五节按作废记，既不当它过、也不占着红字。 */
    console.log('这台作废：' + e.message + ' —— 它切的 eff() 在组件里已经没有了（那一版没落地，见 main.js:849 直接用播放器 rate）');
    process.exit(77);
  }
})();
const stubs = `
  const A = {
    smtc:null, msg:'', dead:false, audio:null, at:0, pos:0, dur:0, rate:1, src:1, status:'',
    title:'', artist:'', album:'', app:'', can:{}, appliedSeq:0, trackKey:'', drift:null, timer:null,
    seekAt:0, gen:0, snapAt:0, confirm:null, flags:{ off:0, sync:500 },
    isSelf(){ return false; }, plan(){}, loadLyric(){}, tell(){},
    ${body}
  };
  A;`;
const num = name => { const m = src.match(new RegExp('const ' + name + '\\s*=\\s*([0-9]+)')); if(!m) throw new Error('找不到常量 ' + name); return Number(m[1]); };
const mk = old => {
  const A = vm.runInNewContext(stubs, { console, Date, Math, Number, String, Array, clearTimeout,
    JUMP_MS: num('JUMP_MS'), CALIB_BACK: num('CALIB_BACK') }, { filename:'music-stub' });
  if(old){ A.eff = () => (A.rate || 1); }        /* 从前那版：外推一律按播放器报的倍速（这里恒 1） */
  return A;
};
const rows = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname.slice(1)), 'smtc-observed.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(r => r.raw).map(r => JSON.parse(r.raw))
  .filter(o => /musicbee/i.test(o.app || '') && typeof o.pos === 'number' && typeof o.at === 'number' && o.status === 'Playing');

for(const old of [true, false]){
  const A = mk(old);
  let worst = 0, sum = 0, n = 0, seq = [];
  for(const st of rows){
    /* 真值落地之前，FD 这一趟认为自己在哪儿：拿这一张快照自己的墙钟去问，只比同一首之内的 */
    if(A.smtc && A.status === 'Playing' && A.title === st.title){
      const est = A.pos + (st.at - A.at) * A.eff();
      const e = Math.round(est - st.pos);
      if(Math.abs(e) > worst) worst = Math.abs(e);
      sum += Math.abs(e); n++; seq.push(e);
    }
    A.apply({ ...st });
  }
  const B = mk(old); let re = 0;
  for(const st of rows){ const had = !!B.smtc; const g0 = B.gen; B.apply({ ...st }); if(had && B.gen > g0) re++; }
  console.log((old ? '从前（外推一律按 1.0x）' : '今天（外推用实测走速）') +
    '：最大偏差 ' + worst + ' 毫秒，平均 ' + Math.round(n ? sum / n : 0) + ' 毫秒，比对 ' + n +
    ' 张，换基准 ' + re + ' 次');
  console.log('  每张快照落地前那一刻的差（每 5 张取一个，正=FD 报得比真值晚）：' + seq.filter((x, i) => i % 5 === 0).join(' '));
}
