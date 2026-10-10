/* 外32 图10 · 「时间重叠复杂的唱段，弹动、闪烁、『正在唱』的歌词片段有时出错」
   这一段两条嗓子叠着唱：主唱 10~14 秒里挂着一条和声 12~13 秒。挑「正在唱哪一行」的准是他定的
   （都在唱取开口最晚的那一行），所以手会走 主唱 → 和声 → 主唱 一个来回 —— 这个来回本身没错，
   错的是跟着它动的另外两样：
     ① 每一行「唱过没唱过」从前按「数组里排在当前这行前面」判 → 和声先被点亮、又整行染成已唱、再掉回未唱，
        .mu-line 上挂着 opacity .18s 的过渡，掉一下就是他看见的那次闪烁；
     ② 换行就滚一次、打字机每帧写一个落点 → 手回到前一行时整列被往回拽一行，那就是「弹动」。
   这一台把真源码那两颗方法（lineAt / rowStates）切进虚拟机跑一条时间轴，判的是三件事：
   一行亮过之后不许再掉回未唱、全程最多只有一行 act、没打时间戳的那一行全程不亮；
   另外拿旧的判法照同一条轴跑一遍当对照 —— 它确实掉回去了，判法才算咬住了这处 bug。
   切的是仓库里那一份原文，不抄第二份：LI_BACK_MS 整颗 + lineAt / rowStates 两颗方法整颗。 */
import vm from 'node:vm';
import { rd, 切, 切方法, 记账 } from './lib-slice.mjs';

const R = 记账('test-overlap');
const M = rd('data/plugins/music-remote/main.js');
const 起 = M.indexOf('class MusicView');
const 止 = M.indexOf('/* ---------- 上面这些是');
const 截 = (止 > 0 ? 止 : M.length);
const 算 = 头 => 切方法(M, 头, 起, 截);
const 两颗 = [算('  rowStates(li, ms){'), 算('  lineAt(ms, lines){')];
const 旧判 = 两颗[0].replace('const act = i === li, sung = !act && isFinite(r.L.ms) && ms >= r.L.ms;',
  'const sung = i < li, act = i === li;');
if(旧判 === 两颗[0]) throw new Error('对照那一条没换成旧判法 —— rowStates 里那一行改过写法，这一台的对照得跟着改');
const 拼 = `
${切(M, 'LI_BACK_MS')}
const 壳 = class{
${两颗.join('\n')}
};
const 旧壳 = class{
${旧判}
${两颗[1]}
};
this.件 = { 壳, 旧壳 };
`;
function 台(代){
  const 沙 = { R };
  vm.createContext(沙);
  vm.runInContext(`var Music = { gen:${代 || 1}, playing:() => true };`, 沙);
  vm.runInContext(拼, 沙);
  Object.assign(沙, 沙.件);
  return 沙;
}
/* 一条行节点替身：只记 sung / act 两个类挂没挂（真代码走的就是 classList.toggle 那一笔） */
function 行(L){ const 挂 = {}; return { L, row:{ classList:{ toggle(k, on){ 挂[k] = !!on; } }, 挂 } }; }
function 装(沙, 类, lines){
  const v = new 类();
  v.li = -1; v.liGen = -1; v.滚到 = -1;
  v.rows = lines.map(L => 行(L));
  return v;
}
/* 主唱 10~14 里挂一条和声 12~13；后面接主唱 14~16；最后那一行没打时间戳 */
const 叠 = [
  { ms:10000, ms2:14000, text:'主唱长的这一句' },
  { ms:12000, ms2:13000, text:'和声那一句' },
  { ms:14000, ms2:16000, text:'主唱下一句' },
  { ms:NaN, ms2:NaN, text:'没打时间戳的那一行' }
];
function 走轴(沙, 类, lines, from, to, 步 = 100, 改代){
  const v = 装(沙, 类, lines);
  const 轨 = [];
  for(let ms = from; ms <= to; ms += 步){
    if(改代 && ms === 改代.at){ 沙.Music.gen = 改代.代; }
    const li = v.lineAt(ms, lines);
    v.li = li; v.liGen = 沙.Music.gen;
    v.rowStates(li, ms);
    轨.push({ ms, li, 态: v.rows.map(r => r.row.挂.act ? 'act' : (r.row.挂.sung ? '已唱' : '—')) });
  }
  return { v, 轨 };
}
const 找 = (轨, ms) => 轨.find(x => x.ms === ms);
const 态序 = (轨, i) => [...new Set(轨.map(x => x.态[i]))];

R.题('一、手落在哪一行（他定的那条准一个字没动）');
{
  const 沙 = 台();
  const { 轨 } = 走轴(沙, 沙.壳, 叠, 9000, 16500);
  R.判('主唱开口 → 落第 0 行；和声一开口（两条都张着口）→ 落开口最晚的第 1 行',
    找(轨, 10500).li === 0 && 找(轨, 12500).li === 1, 找(轨, 10500).li + ' / ' + 找(轨, 12500).li);
  R.判('和声 13 秒收口 → 手回到还在唱的第 0 行（这就是那个来回，挑行这一头是对的）',
    找(轨, 13500).li === 0 && 找(轨, 14500).li === 2, 找(轨, 13500).li + ' / ' + 找(轨, 14500).li);
  R.判('一条一行都还没开口 → 落第一行，不是「无行可选」（换歌那一下落在结尾那条老账）',
    找(轨, 9000).li === 0, 找(轨, 9000).li);
  R.判('全程任何一刻最多只有一行亮着「正在唱」（两行同时 act = 逐字填充会打架）',
    轨.every(x => x.态.filter(t => t === 'act').length <= 1), 轨.map(x => x.ms + ':' + x.态.join(',')).slice(0, 6).join(' | '));
}
R.题('二、每一行的状态只许往前走（闪烁的根子就在这儿）');
{
  const 沙 = 台();
  const { 轨 } = 走轴(沙, 沙.壳, 叠, 9000, 16500);
  const 掉 = 轨.filter((x, k) => k > 0 && x.态.some((t, i) => 轨[k - 1].态[i] !== '—' && t === '—'));
  R.判('一行亮过之后一个字节都不许掉回「未唱」（这一条就是作者看见的那次闪烁）',
    掉.length === 0, 掉.map(x => x.ms + ':' + x.态.join(',')).slice(0, 4).join(' | '));
  R.判('和声那一行的状态顺序是 未唱 → 正在唱 → 已唱（不再回到未唱）',
    态序(轨, 1).join(' → ') === '— → act → 已唱', 态序(轨, 1).join(' → '));
  R.判('主唱那一行全程不断线（手在它和和声之间来回那 7 秒，它一次都没掉回未唱）',
    轨.every(x => x.态[0] !== '—'), 轨.filter(x => x.态[0] === '—').map(x => x.ms).join(','));
  R.判('和声当这一行的那 1 秒里，主唱挂的是「已唱」那一档（还在唱的背景行至少是亮的，不是灰的 —— 旧判法这条一样过，区别在下面那一条）',
    找(轨, 12500).态[0] === '已唱' && 找(轨, 12500).态[1] === 'act', 找(轨, 12500).态.join(','));
  R.判('没打时间戳的那一行全程不亮（它没有窗口，谁也不许把它当正在唱）',
    轨.every(x => x.态[3] === '—'), 态序(轨, 3).join(','));
  /* 对照：拿旧的「按排第几判」跑同一条轴 —— 它确实掉回去了，上面那两条判法才算咬住了这处 bug */
  const 对 = 走轴(台(), 台().旧壳, 叠, 9000, 16500).轨;
  const 对掉 = 对.filter((x, k) => k > 0 && x.态.some((t, i) => 对[k - 1].态[i] !== '—' && t === '—'));
  R.判('对照（旧判法）：按「数组里排第几」判，和声那一行 13.5 秒确实掉回未唱 —— 判法不是空的',
    对掉.length > 0 && 对.find(x => x.ms === 13500).态[1] === '—',
    对掉.map(x => x.ms + ':' + x.态.join(',')).slice(0, 3).join(' | '));
  R.判('对照（旧判法）：同那一刻主唱明明还在唱，却被整行染成「已唱」',
    对.find(x => x.ms === 12500).态[0] === '已唱', 对.find(x => x.ms === 12500).态.join(','));
}
R.题('三、播放器那点噪声和人为回拖（那两道闸不许被这次改动碰坏）');
{
  const 沙 = 台();
  const 噪 = [
    { ms:10000, ms2:11000 }, { ms:11000, ms2:12000 }, { ms:12000, ms2:13000 }
  ];
  const v = 装(沙, 沙.壳, 噪);
  let 手 = v.lineAt(12500, 噪); v.li = 手; v.liGen = 沙.Music.gen;
  const 抖 = [];
  for(let ms = 12500; ms >= 12310; ms -= 30){ const li = v.lineAt(ms, 噪); 抖.push(li); v.li = li; v.liGen = 沙.Music.gen; }
  R.判('位置带噪声往回晃 190 毫秒（量过的 ±90 那一档给到两倍）：一行都不许退',
    抖.every(x => x === 2), 抖.join(','));
  const 退 = v.lineAt(10000, 噪);
  R.判('真退过开口 700 毫秒那条线以外（人往回拖带子）：认，跟着退',
    退 === 0 || 退 < 2, 退);
  const 沙2 = 台();
  const v2 = 装(沙2, 沙2.壳, 噪);
  v2.li = 2; v2.liGen = 99;
  沙2.Music.gen = 100;
  R.判('基准换了号（拖条 / 换歌 / 暂停再播）那一下不看噪声闸：整屏要跟着新位置归位',
    v2.lineAt(10500, 噪) === 0, v2.lineAt(10500, 噪));
}
R.题('四、往回拽那一头的两处闸（滚动这一头量不了 DOM，钉住接线）');
{
  R.判('每一行的状态改吃「这一行自己的开口时刻」，数组里排第几不参与（rowStates 那颗方法里再没有 i < li）',
    /const act = i === li, sung = !act && isFinite\(r\.L\.ms\) && ms >= r\.L\.ms;/.test(两颗[0]) && !/i < li/.test(两颗[0]),
    两颗[0].split('\n').find(l => /const act/.test(l)));
  R.判('调用点把时刻递进去了（少递一个参数，ms 是 undefined，那一行永远不亮）',
    /this\.rowStates\(li, ms\)/.test(M), /this\.rowStates\([^\n]*/.exec(M)[0]);
  R.判('换行滚那一趟加了闸：只有往前走、或基准换了号才滚（落回还在唱的前一行不往回拽）',
    /const 换了基准 = Music\.gen !== this\.liGen;[\s\S]{0,300}\(换了基准 \|\| li > this\.滚到\)[\s\S]{0,400}if\(换了基准 \|\| !this\.crawling\) this\.scrollTo\(this\.rows\[li\]\.row\)/.test(M),
    /换了基准[^\n]*/.exec(M)[0]);
  R.判('闸的起点摆正了：挂上那张卡和重画整棵歌词树两处都把「滚到第几行」清回 -1（不清，换歌那一下第一趟滚不动）',
    (M.match(/this\.滚到 = -1;/g) || []).length === 2, (M.match(/this\.滚到 = -1;/g) || []).length + ' 处');
  R.判('打字机那一趟的落点也只许往前走：同一版基准里比上一帧靠后，就按上一帧那个数写；换了基准那一趟照旧放行',
    /const to = g\.s0 \+ \(g\.s1 - g\.s0\) \* p;[\s\S]{0,400}const 回拽 = this\.crawlGen === Music\.gen && this\.crawlSet != null && to < this\.crawlSet;[\s\S]{0,120}this\.crawlTo = 回拽 \? this\.crawlSet : to;[\s\S]{0,400}box\.scrollTop = this\.crawlTo;/.test(M),
    /const 回拽[^\n]*/.exec(M)[0]);
}
R.题('五、真数复现（他库里那种「行序和时间序对不上」）');
{
  const 沙 = 台();
  /* 和声写在主唱后面、开口却更早 —— 那份逐字文件里有 6 处这个形状（外30 那一轮量到的） */
  const 乱 = [
    { ms:20000, ms2:23000, text:'主唱' },
    { ms:19000, ms2:24000, text:'和声（开口比主唱早，写在后面）' }
  ];
  const { 轨 } = 走轴(沙, 沙.壳, 乱, 18500, 24500);
  R.判('两条都张着口时取开口最晚的那一行（主唱 20 秒开口，和声 19 秒就开口了）',
    找(轨, 21000).li === 0, 找(轨, 21000).li);
  R.判('和声那一行从 19 秒开口起就一直亮着，24 秒收口才转已唱（中间一次都不掉）',
    态序(轨, 1).join(' → ') === '— → act → 已唱' && 找(轨, 23500).态[1] === 'act', 态序(轨, 1).join(' → '));
  R.判('主唱 23 秒收口那一下亮的是还在唱的和声（这就是「正在唱那一段」跟着口走，不跟着文件行序走）',
    找(轨, 23500).态[0] === '已唱' && 找(轨, 23500).li === 1, 找(轨, 23500).态.join(','));
}
R.收尾();
