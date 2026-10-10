/* 外27 己组 · 逐张看：真值落地前 FD 的钟差多少、diff 多大、有没有换基准、实测走速收到多少 */
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync('D:/Programs/Flow-Desk/data/plugins/music-remote/main.js', 'utf8');
function pick(n){ const i = src.indexOf('\n  ' + n + '('); if(i < 0) throw new Error('组件里已经没有方法 ' + n + ' 了');
  let j = src.indexOf('\n  },', i);
  const j2 = src.indexOf('\n  }', i + 1); if(j2 > i && j2 < j) j = j2; return src.slice(i + 1, j + 4); }
let body;
try{ body = ['eff', 'deadband', 'offsetMs', 'lyricMs', 'apply', 'nowMs'].map(pick).join(',\n'); }
catch(e){
  /* 跟隔壁那台同源：切的是外27 己组「实测走速」那一版的 eff()，那一版没落地（今天的 nowMs 直接用播放器 rate）。
     结论已经结了，这台按作废记 —— 别拿它的旧数字当今天的证据。 */
  console.log('这台作废：' + e.message + '（那一版没落地，见 main.js:849）');
  process.exit(77);
}
const num = n => { const m = src.match(new RegExp('const ' + n + '\\s*=\\s*([0-9]+)')); return Number(m[1]); };
const stubs = '({smtc:null,audio:null,at:0,pos:0,dur:0,rate:1,src:1,status:"",title:"",artist:"",album:"",app:"",can:{}' +
  ',appliedSeq:0,trackKey:"",drift:null,timer:null,seekAt:0,gen:0,snapAt:0,confirm:null,flags:{off:0,sync:500}' +
  ',isSelf(){return false},plan(){},loadLyric(){},tell(){},' + body + '})';
const rows = fs.readFileSync('D:/Programs/Flow-Desk/smtc-observed.jsonl', 'utf8').split('\n').filter(Boolean)
  .map(l => JSON.parse(l)).filter(r => r.raw).map(r => JSON.parse(r.raw))
  .filter(o => /musicbee/i.test(o.app || '') && o.status === 'Playing');

for(const old of [true, false]){
  const A = vm.runInNewContext(stubs, { console, Date, Math, Number, String, Array, clearTimeout,
    JUMP_MS: num('JUMP_MS'), CALIB_BACK: num('CALIB_BACK') });
  if(old) A.eff = () => (A.rate || 1);
  console.log(old ? '=== 从前（外推一律 1.0x） ===' : '=== 今天（外推用实测走速） ===');
  let worst = 0, re = 0;
  rows.forEach((st, i) => {
    const err = A.smtc ? Math.round(A.pos + (st.at - A.at) * A.eff() - st.pos) : null;
    const g0 = A.gen; A.apply({ ...st });
    if(A.gen > g0) re++;
    if(err !== null && st.pos > A.pos - 9000 && Math.abs(err) < 9000) worst = Math.max(worst, Math.abs(err));
    if(i < 12 || i > rows.length - 4)
      console.log('  #' + i + ' pos=' + st.pos + ' 墙上=+' + (st.at - rows[0].at) + ' 落地前差=' + (err === null ? '—' : err) +
        ' src=' + (A.src || 1).toFixed(5) + (A.gen > g0 ? '  ←换基准' : ''));
  });
  console.log('  整场最大差（剔掉切歌那一张）= ' + worst + ' 毫秒   换基准 ' + re + ' 次');
}
