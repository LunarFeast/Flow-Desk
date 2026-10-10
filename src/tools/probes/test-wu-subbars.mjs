/* 外27 戊组 · 图13 子日程完成度：真的 subBars 抠出来跑，再看三个落点是否都改口了 */
import fs from 'node:fs';
import vm from 'node:vm';

const SCH = 'D:/Programs/Flow-Desk/data/plugins/schedule/main.js';
const SH = 'D:/Programs/Flow-Desk/src/_fd/src/fd3-shell.js';
const s = fs.readFileSync(SCH, 'utf8'), sh = fs.readFileSync(SH, 'utf8');

const i0 = s.indexOf('\nfunction subBars');
const body = s.slice(i0 + 1, s.indexOf('\n}\n', i0) + 2);
const sb = { console };
vm.createContext(sb);
const npAt = s.indexOf('function nodeProgress');
const np = s.slice(npAt, s.indexOf('\n}\n', npAt) + 2);
vm.runInContext(np + '\n' + body, sb);
const { nodeProgress, subBars } = sb;

/* 假 h：只记标签、属性、孩子 */
function h(tag, props, kids){
  return { tag, props: props || {}, kids: (Array.isArray(kids) ? kids : kids == null ? [] : [kids]).filter(x => x != null && x !== false) };
}
const out = [], ok = m => out.push('PASS ' + m), bad = m => out.push('FAIL ' + m);

const kids = [ {title:'买菜的', progress:0}, {title:'写稿', progress:50}, {title:'回信', done:true}, {title:'空的'} ];
const parent = { title:'今天', children:kids };
ok('nodeProgress 平均 = ' + nodeProgress(parent) + '（0/50/100/0 平均 38）');

const b = h('b', { style:'width:100%' });
const bars = subBars(h, parent);
bars && bars.tag === 'span' ? ok('有子日程：交回一个 span.sch-sub') : bad('没交回 span：' + JSON.stringify(bars));
(bars.props.class === 'sch-sub' ? ok : bad)('主日程那一档 class = 「' + bars.props.class + '」（竖着摞）');
bars.kids.length === 4 ? ok('一个子一条：4 条') : bad('条数 = ' + bars.kids.length);
const 填 = bars.kids.map(x => x.kids[0].props.style);
JSON.stringify(填) === JSON.stringify(['width:0%', 'width:50%', 'width:100%', 'width:0%']) ? ok('每一条里的填充照自己那个数：' + 填.join(' '))
  : bad('填充 = ' + JSON.stringify(填));
bars.kids[2].props.class === 'full' ? ok('走满那一条带 full（换成完成色）') : bad('走满那条没带 full：' + bars.kids[2].props.class);
/%$/.test(bars.kids[1].props.title) && bars.kids[1].props.title.includes('写稿')
  ? ok('数字挪进悬停说明：「' + bars.kids[1].props.title + '」') : bad('悬停说明不对：' + bars.kids[1].props.title);

subBars(h, { title:'没有子' }) === null ? ok('没有子日程：不摆这一格') : bad('没有子还摆了东西');

/* 三个落点：有子日程的地方不许再出现光杆百分数 */
const gantt = s.slice(s.indexOf('function ganttBar'), s.indexOf('function barTitle'));
/!kids\.length && p > 0/.test(gantt) ? ok('甘特条：底下有人的那一条不再拿一整截深色压在字底下（.sch-fill 只给最下级那一档）') : bad('甘特条还在给父条压深色');
/'sch-pct'/.test(gantt) ? ok('甘特条：父日程文字后面那枚完成度小标签接上了') : bad('甘特条没接完成度小标签');
/subInBar\(h, s, C, it, b\.subs/.test(gantt) ? ok('甘特条：下级接的是条底那一排细条（subInBar），不再各自摊成粗条') : bad('甘特条没接上条底细条');
const day = s.slice(s.indexOf('function openDayDetail'), s.indexOf('function openDayDetail') + 4200);
!/meta\.push\('子日程 '[^\n]*进度 /.test(day) ? ok('日详情那一行：不再写「子日程 N 项 · 进度 X%」') : bad('日详情还带着百分数');
/subBars\(h, n\)/.test(day) ? ok('日详情：细条摆上了') : bad('日详情没摆细条');
const tree = s.slice(s.indexOf('function renderTree'), s.indexOf('function renderYear'));
/\(n\.children \|\| \[\]\)\.length \? null : h\('span', \{ class:'fd-hint'/.test(tree)
  ? ok('主日程树：有子日程时右边那个百分数撤掉，没子的叶子照旧留数') : bad('主日程树那一处没改对');
/* 画法搬家到插件自己那份 SCH_CSS：条底细条和小标签的选择器得在组件里，壳子里那两条横排档得没掉 */
const css = /const SCH_CSS = `([\s\S]*?)`;/.exec(s);
css && /\.sch-inbar\{/.test(css[1]) && /\.sch-pct\{/.test(css[1])
  ? ok('插件的 SCH_CSS 里有 .sch-inbar 和 .sch-pct 这两条') : bad('组件 SCH_CSS 缺条底细条或小标签那两条');
!/@?\.sch-sub\.row/.test(sh) ? ok('壳子里没留 .sch-sub.row 那两条尾巴（撤掉的画法不留死样式）') : bad('壳子里还写着 .sch-sub.row');
/* 组件不许自己造百分数：细条以外不该再有 nodeProgress + '%' 出现在这三处 */
ok('三处之外还剩的百分数落点：' + (s.match(/nodeProgress\([^)]*\) \+ '%'/g) || []).length + ' 处（编辑框里那两处是给他拖着看数的，留着）');
console.log(out.join('\n'));
const 不过 = out.filter(x => x.startsWith('FAIL')).length;
console.log(不过 ? 'RESULT: FAIL（' + 不过 + ' 条不过）' : 'RESULT: ALL PASS (' + out.length + ')');
process.exit(不过 ? 1 : 0);
