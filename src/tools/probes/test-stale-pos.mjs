/* 外27 己组 · 拿今天真录到的 103 张 MusicBee 快照，把 apply()/nowMs() 的原文跑两遍：
   一遍从前（位置没动也照样换基准），一遍今天（那种快照只收元数据、不动基准）。
   看的是基准这一路：每一张快照落地后 FD 拿的那一对 (pos, at)，以及它算出的当前位置与真值差多少。 */
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync('D:/Programs/Flow-Desk/data/plugins/music-remote/main.js', 'utf8');
function pick(n){ const i = src.indexOf('\n  ' + n + '('); let j = src.indexOf('\n  },', i);
  const j2 = src.indexOf('\n  }', i + 1); if(j2 > i && j2 < j) j = j2; return src.slice(i + 1, j + 4); }
const body = ['deadband', 'offsetMs', 'lyricMs', 'apply', 'nowMs'].map(pick).join(',\n');
const num = n => Number(src.match(new RegExp('const ' + n + '\\s*=\\s*([0-9]+)'))[1]);
const mk = old => {
  const A = vm.runInNewContext('({' + 'smtc:null,audio:null,at:0,pos:0,dur:0,rate:1,status:"",title:"",artist:"",album:"",app:"",can:{}' +
    ',appliedSeq:0,trackKey:"",drift:null,timer:null,seekAt:0,gen:0,snapAt:0,confirm:null,lastRawPos:-1,flags:{off:0,sync:500}' +
    ',isSelf(){return false},plan(){},loadLyric(){},tell(){},' + (old ? body.replace('const stalePos = had', 'const stalePos = false && had') : body) + '})',
    { console, Date, Math, Number, String, Array, clearTimeout, JUMP_MS: num('JUMP_MS'), CALIB_BACK: num('CALIB_BACK') });
  return A;
};
const rows = fs.readFileSync('smtc-observed.jsonl', 'utf8').split('\n').filter(Boolean)
  .map(l => JSON.parse(l)).filter(r => r.raw).map(r => JSON.parse(r.raw))
  .filter(o => /musicbee/i.test(o.app || '') && o.status === 'Playing');

for(const old of [true, false]){
  const A = mk(old);
  const jumps = []; let worst = 0, n = 0, sum = 0;
  rows.forEach((st, i) => {
    if(A.smtc && A.title === st.title && st.pos >= A.pos - 3000){        /* 同一首之内才比 */
      const est = A.pos + (st.at - A.at) * (A.rate || 1);
      const e = Math.round(est - st.pos);
      if(Math.abs(e) < 4000){ worst = Math.max(worst, Math.abs(e)); sum += Math.abs(e); n++; }
    }
    const old = { pos:A.pos, at:A.at };
    A.apply({ ...st });
    /* 基准真的换了：屏幕上的位置就在这一刻从 old 那一条跳到新那一条，跳多少 = 新值 − 旧外推值 */
    if(old.at && (A.pos !== old.pos || A.at !== old.at)){
      const drag = Math.round(st.pos - (old.pos + (st.at - old.at) * (A.rate || 1)));
      if(Math.abs(drag) > 300) jumps.push('#' + i + ' ' + st.ev + ' 歌词当场跳 ' + drag + ' 毫秒');
    }
  });
  console.log('=== ' + (old ? '从前（旧位置也换基准）' : '今天（旧位置只收元数据）') + ' ===');
  console.log('  基准被换走的次数（幅度过 300 毫秒的）：' + jumps.length);
  for(const j of jumps) console.log('    ' + j);
  console.log('  每张真值落地前 FD 与真值的差：最大 ' + worst + ' 毫秒，平均 ' + Math.round(n ? sum / n : 0) + ' 毫秒，比对 ' + n + ' 张');
}
