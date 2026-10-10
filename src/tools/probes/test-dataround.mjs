/* 外30 戊组（定期备份 + 他要的「数据保护复测」）：
   这一台跑的是仓库里那一份真的 backup.cjs、真的 node:fs、真的磁盘目录 —— 备份这种东西「看代码像对」不算数，
   必须量：抄出来的每一份每一个字节要和源那份一样；抄到一半崩了不许动到上一份；收旧份只许收自己造的。
   临时那一棵树落在他点名的 E 盘下面（C 盘不留东西），跑完自己收掉。
   另有一头：页面上那一块配置和那颗表（fd4-builtin 的 Backup）也切真源码跑一遍，
   断它「只摆一颗表、不是一遍遍问时间」和「同一时刻不许两趟并行抄」。 */
import fs from 'node:fs';
import nodePath from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { 切, 记账, rd } from './lib-slice.mjs';

const require = createRequire(import.meta.url);
import { 工区 as 工区根 } from '../本地路径.mjs';
const makeBackup = require('D:/Programs/Flow-Desk/src/pack/backup.cjs');
const Z = 记账('test-dataround');

/* 临时树要落在仓外，那一格住哪儿写在 src\tools\本地路径.cjs（那颗不进仓）；没配就这一台自己不跑 */
if(!工区根){ console.log('这台作废：没配本地工区（src\\tools\\本地路径.cjs 里那一格），临时树没地方放'); process.exit(77); }
const 工区 = 工区根 + '/备份复测';
const 源 = 工区 + '/源';
const 落 = 工区 + '/备份';
function 收场(){ try{ fs.rmSync(工区, { recursive:true, force:true }); }catch(e){ console.log('  ! 临时树没收掉：' + e.message); } }
try{ fs.rmSync(工区, { recursive:true, force:true }); fs.mkdirSync(源 + '/222/history/chA', { recursive:true }); }
catch(e){ console.log('FAIL 0 临时树建不起来（' + e.message + '）· 这一台一条都没跑到'); process.exitCode = 1; Z.收尾(); throw e; }

/* 一棵像样的源树：明文正文、逐字记录（只追加那一颗）、插图（二进制）、配置、插件、词库、日志 */
const 文件 = {
  '222/第一章.md': '# 第一章\n床前明月光，疑是地上霜。\n',
  '222/第二章 草稿（改）.md': '第二章的字\n',
  '222/history/chA/keystroke.txt': '#B\n{"at":1,"t":"床"}\n{"at":2,"t":"前"}\n',
  '222/history/chA/1762-0001.json': JSON.stringify({ paras:[{ id:'p1', t:'床前明月光，' }] }),
  '222/assets/图 一.png': Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 253]),
  'userdata-fd/appearance.json': JSON.stringify({ 方案:'暖纸' }),
  'userdata-fd/backup.json': JSON.stringify({ on:true }),
  'plugins/music-remote/main.js': 'export const id = "music-remote";\n',
  '333-bank/data.txt': '床前\t2\n明月\t3\n',
  'logs/今天.log': '一行日志，不该跟着抄走\n',
  'userdata-list.md': '不受更新影响的清单\n'
};
const 写 = (root, rel, v) => { const p = path_join(root, rel); fs.mkdirSync(nodePath.dirname(p), { recursive:true }); fs.writeFileSync(p, v); };
const path_join = (root, rel) => nodePath.join(root, ...rel.split('/'));
const sha = p => { const h = require('node:crypto').createHash('sha256'); h.update(fs.readFileSync(p)); return h.digest('hex').slice(0, 12); };
for(const rel in 文件) 写(源, rel, 文件[rel]);
const 根 = [{ label:'数据', dir:源 }];
const 该抄的 = Object.keys(文件).filter(r => !r.startsWith('logs/'));

/* 时间可控：一颗表摆一次给一个时刻，收旧份和「到点」那几笔都要靠它 */
let 此刻 = new Date(2026, 9, 8, 10, 0);
const 台 = () => makeBackup({ fs, path:nodePath, now:() => new Date(此刻) });

Z.题('一、真抄一份（真磁盘 · 真 backup.cjs）');
{
  const B = 台();
  const r = await B.run({ dest:落, keep:8, skip:['logs'] }, 根);
  Z.判('1 抄成了，报回的文件数和源里该抄的对得上（日志那一格不算）',
    r.ok === true && r.抄 === 该抄的.length && r.数 === 该抄的.length, [r.ok, r.msg, r.抄, r.数, 该抄的.length]);
  const 份 = fs.readdirSync(落).filter(x => B.STAMP_RE.test(x));
  Z.判('2 落点里就一颗时间戳文件夹，名字合式（FD-年-月-日-时分）', 份.length === 1 && 份[0] === 'FD-2026-10-08-1000', fs.readdirSync(落));
  let 差 = [], 少了 = [];
  for(const rel of 该抄的){
    const to = path_join(nodePath.join(落, 份[0], '数据'), rel);
    if(!fs.existsSync(to)) { 少了.push(rel); continue; }
    if(sha(to) !== sha(path_join(源, rel))) 差.push(rel);
  }
  Z.判('3 每一个文件逐字节比过：一个不差（含中文名那一章、二进制的插图、只追加那份 keystroke.txt）',
    少了.length === 0 && 差.length === 0, { 少了, 差 });
  Z.判('4 抄出来的那一棵挂在「数据」这个子文件夹底下（外加的文件夹各归各的名，不混在一堆）',
    fs.existsSync(nodePath.join(落, 份[0], '数据', '222')) && fs.existsSync(nodePath.join(落, 份[0], '数据', 'userdata-fd')));
  Z.判('5 日志那一格没跟着抄（skip 那一列是真的在筛，不是写着好看）',
    !fs.existsSync(nodePath.join(落, 份[0], '数据', 'logs')), fs.readdirSync(nodePath.join(落, 份[0], '数据')));
  const 单 = fs.readFileSync(nodePath.join(落, 份[0], B.MANIFEST), 'utf8');
  Z.判('6 清单里写着时间、落点、留几份，并且每个抄走的名字都列得出（外加它的字节数）',
    /抄的时间：/.test(单) && 单.includes('备份到：' + 落) && 单.includes('留几份：8') &&
    该抄的.every(rel => 单.includes('数据/' + rel + '\t')), 单.split('\n').slice(0, 6));
  Z.判('7 没出岔子时清单里不写「没抄上」那一段（写了就等于有事瞒着）', !/没抄上的/.test(单));
  Z.判('8 收口干净：落点里没有留 .正在写 那种半成品',
    fs.readdirSync(落).every(x => !x.endsWith(B.DOING)), fs.readdirSync(落));
}

Z.题('二、抄的时候出事（他点名要的那一条：崩了只丢这一趟）');
{
  const B = 台();
  const 第一份 = nodePath.join(落, fs.readdirSync(落).find(x => B.STAMP_RE.test(x)));
  const 点 = r => { const l = []; const 走 = d => { for(const x of fs.readdirSync(d, { withFileTypes:true }))
      x.isDirectory() ? 走(nodePath.join(d, x.name)) : l.push(nodePath.relative(r, nodePath.join(d, x.name)) + '=' + sha(nodePath.join(d, x.name))); };
    走(r); return l.sort().join('|'); };
  const 前账 = 点(第一份);
  /* 甲：其中一颗文件读不到（开着别的程序在写、或被占用）—— 这一趟不许整个塌，也不许静悄悄少一颗 */
  let 手 = 0;
  const 读不动 = { promises:{
    readdir:(...a) => fs.promises.readdir(...a), stat:(...a) => fs.promises.stat(...a),
    mkdir:(...a) => fs.promises.mkdir(...a), rm:(...a) => fs.promises.rm(...a), rename:(...a) => fs.promises.rename(...a),
    writeFile:(...a) => fs.promises.writeFile(...a),
    readFile:async (...a) => { if(++手 === 3) throw new Error('这一颗正被别的程序占着'); return fs.promises.readFile(...a); } } };
  此刻 = new Date(2026, 9, 8, 11, 0);
  const 甲 = await makeBackup({ fs:读不动, path:nodePath, now:() => new Date(此刻) }).run({ dest:落, keep:8, skip:['logs'] }, 根);
  Z.判('9 一颗读不到：其余照抄、这一趟照样收口，但「没抄上」那一个报出来（不响就当没事的那种不算做完）',
    甲.ok === true && 甲.坏.length === 1 && 甲.抄 === 该抄的.length - 1, [甲.msg, 甲.坏]);
  const 单甲 = fs.readFileSync(nodePath.join(落, 'FD-2026-10-08-1100', B.MANIFEST), 'utf8');
  Z.判('10 清单里专列一节写没抄上的，连它是哪一颗都说得出',
    /没抄上的 1 个/.test(单甲) && 单甲.split('没抄上的')[1].includes('数据/'), 单甲.split('没抄上的')[1]);
  /* 乙：收口那一下失败（改名动不了 = 断电正好卡在这儿）—— 这一趟不许冒充一份 */
  此刻 = new Date(2026, 9, 8, 11, 20);
  const 改不动 = { promises:{
    readdir:(...a) => fs.promises.readdir(...a), stat:(...a) => fs.promises.stat(...a),
    mkdir:(...a) => fs.promises.mkdir(...a), rm:(...a) => fs.promises.rm(...a), readFile:(...a) => fs.promises.readFile(...a),
    writeFile:(...a) => fs.promises.writeFile(...a),
    rename:async () => { throw new Error('这一会儿改不了名'); } } };
  const 乙 = await makeBackup({ fs:改不动, path:nodePath, now:() => new Date(此刻) }).run({ dest:落, keep:8, skip:['logs'] }, 根);
  Z.判('11 收口失败就报「没成」，不许把半成品端出去当一份',
    乙.ok === false && /这一份没收住/.test(乙.msg), 乙.msg);
  const 现在 = fs.readdirSync(落).sort();
  Z.判('12 崩了只留下一颗 .正在写，没有一颗改了名的假成品',
    现在.includes('FD-2026-10-08-1120' + B.DOING) && !现在.includes('FD-2026-10-08-1120'), 现在);
  Z.判('13 先前那两份完整的一个字节都没动（逐字节清单前后一样）',
    点(第一份) === 前账 && 点(nodePath.join(落, 'FD-2026-10-08-1100')) === 点(nodePath.join(落, 'FD-2026-10-08-1100')));
  /* 那颗半成品里其实有清单（清单是先写进草稿、再整颗改名的）—— 认不认它是「一份」靠的是名字合不合式 */
  Z.判('14 收旧份认名字：带 .正在写 的那一颗不合式，所以它里头有清单也不当一份数',
    fs.existsSync(nodePath.join(落, 'FD-2026-10-08-1120' + B.DOING, B.MANIFEST))
    && B.STAMP_RE.test('FD-2026-10-08-1120' + B.DOING) === false);
  const 摆 = (p, 分钟) => { const t = new Date(new Date(2026, 9, 8, 11, 55).getTime() - 分钟 * 6e4);
    fs.utimesSync(p, t, t); };
  摆(nodePath.join(落, 'FD-2026-10-08-1120' + B.DOING), 40);        /* 就当它是四十分钟前撂下的 */
  const 收 = await makeBackup({ fs, path:nodePath, now:() => new Date(2026, 9, 8, 11, 55) }).prune(落, 8);
  Z.判('15 放了四十分钟的半成品收掉了，完整的那两份一个没动',
    收.半.length === 1 && fs.readdirSync(落).sort().join() === 'FD-2026-10-08-1000,FD-2026-10-08-1100', [收.半, fs.readdirSync(落)]);
  const 正在 = nodePath.join(落, 'FD-2026-10-08-1150' + B.DOING);
  fs.mkdirSync(正在, { recursive:true }); 摆(正在, 5);
  const 收二 = await makeBackup({ fs, path:nodePath, now:() => new Date(2026, 9, 8, 11, 55) }).prune(落, 8);
  Z.判('16 五分钟前的那一颗不收 —— 这一刻真在抄的那一颗，不会被收摊的那一趟吃掉',
    收二.半.length === 0 && fs.existsSync(正在), 收二.半);
  fs.rmSync(正在, { recursive:true, force:true });
}

Z.题('三、留几份（只收自己造的那几颗）');
{
  const B = 台();
  for(const 时 of [[12, 0], [12, 5], [12, 10]]){ 此刻 = new Date(2026, 9, 8, 时[0], 时[1]); await B.run({ dest:落, keep:2, skip:['logs'] }, 根); }
  const 现 = fs.readdirSync(落).sort();
  Z.判('17 留两份就收两份：先前那一颗和这三颗里最旧的那一颗没了',
    现.length === 2 && !现.includes('FD-2026-10-08-1000') && !现.includes('FD-2026-10-08-1200'), 现);
  /* 他自己在那个文件夹里放的东西，和一颗没清单的同名样子，都不许收 */
  fs.mkdirSync(nodePath.join(落, '我自己导出的文稿'), { recursive:true });
  fs.writeFileSync(nodePath.join(落, '我自己导出的文稿/留着.txt'), '别删我');
  fs.mkdirSync(nodePath.join(落, 'FD-2020-01-01-0000'), { recursive:true });
  此刻 = new Date(2026, 9, 8, 13, 0);
  await B.run({ dest:落, keep:1, skip:['logs'] }, 根);
  const 后 = fs.readdirSync(落).sort();
  Z.判('18 收到只剩一份时：他自己放的文件夹、没清单的那一颗同名样子，一颗都没动',
    fs.existsSync(nodePath.join(落, '我自己导出的文稿', '留着.txt')) && fs.existsSync(nodePath.join(落, 'FD-2020-01-01-0000')), 后);
  Z.判('19 留一份就真只剩一份抄的（带清单的那几颗才数得着，那颗没清单的同名样子不算一份）',
    后.filter(x => B.STAMP_RE.test(x) && fs.existsSync(nodePath.join(落, x, B.MANIFEST))).length === 1, 后);
  /* 最险的一种：半成品那颗里头是有清单的（清单先写进草稿再改名），光看「有没有清单」分不出它和一份真的。
     摆一颗五分钟前的、带清单的半成品，再收一次 —— 认名字的那版什么都不动，认前缀的那版会把最新真那份删掉 */
  const 险 = nodePath.join(落, 'FD-2026-10-08-1330' + B.DOING);
  fs.mkdirSync(险, { recursive:true });
  fs.writeFileSync(nodePath.join(险, B.MANIFEST), '抄到一半的那份清单\n');
  const 摆 = (p, 分钟, 当) => { const t = new Date(当.getTime() - 分钟 * 6e4); fs.utimesSync(p, t, t); };
  摆(险, 5, new Date(2026, 9, 8, 13, 35));
  const 收三 = await makeBackup({ fs, path:nodePath, now:() => new Date(2026, 9, 8, 13, 35) }).prune(落, 1);
  Z.判('20 带清单的半成品不算「一份」：最新那一份留着，半成品也留着（它只归半小时那一档收）',
    fs.existsSync(nodePath.join(落, 'FD-2026-10-08-1300', B.MANIFEST)) && fs.existsSync(险)
    && 收三.留.length === 1 && 收三.留[0] === 'FD-2026-10-08-1300' && 收三.半.length === 0,
    { 留:收三.留, 半:收三.半, 现:fs.readdirSync(落) });
  fs.rmSync(险, { recursive:true, force:true });
}

Z.题('四、外加文件夹、落点不许在被抄的里面');
{
  fs.mkdirSync(nodePath.join(工区, '文稿出去'), { recursive:true });
  fs.writeFileSync(nodePath.join(工区, '文稿出去', '第三章.txt'), '第三章的导出稿\n');
  const B = 台();
  此刻 = new Date(2026, 9, 8, 14, 0);
  const 外 = nodePath.join(工区, '文稿出去');
  const r = await B.run({ dest:落, keep:8, skip:['logs'] }, 根.concat([{ label:'文稿出去', dir:外 }]));
  const 份 = nodePath.join(落, 'FD-2026-10-08-1400');
  Z.判('21 外加的那一处抄成它自己的名字，和数据那一棵并排放',
    r.ok && fs.existsSync(nodePath.join(份, '文稿出去', '第三章.txt')) && fs.existsSync(nodePath.join(份, '数据', 'userdata-list.md')),
    fs.readdirSync(份));
  Z.判('22 外加那处读不到时报进「错」那一堆，不是静悄悄少抄一处',
    (await B.plan({ dest:落, skip:[] }, [{ label:'没这一处', dir:nodePath.join(工区, '不存在') }])).错.length === 1);
  const 撞 = await B.run({ dest:nodePath.join(源, '备份'), keep:8 }, 根);
  Z.判('23 落点跑在被抄的那一处里面：当场拒（不然大的一直吃小的，越抄越大）',
    撞.ok === false && /跑在「数据」那一处里面/.test(撞.msg), 撞.msg);
  const 空 = await B.run({ dest:'', keep:8 }, 根);
  Z.判('24 还没定落点就抄：一句实话，不去建一颗怪名字的文件夹',
    空.ok === false && /还没定/.test(空.msg) && !fs.existsSync(nodePath.join(落, 'FD-2026-10-08-1400正在写')));
  const 全 = await B.run({ dest:nodePath.join(工区, '空的'), keep:8 }, [{ label:'空的', dir:nodePath.join(工区, '空的源') }]);
  Z.判('25 一处都没读到（空树）：报「什么都没抄」，不在落点留一颗空的份',
    全.ok === false && /一处都没读到/.test(全.msg) && !fs.existsSync(nodePath.join(工区, '空的', 'FD-2026-10-08-1400')), 全.msg);
}

Z.题('五、到点那一笔账');
{
  const B = 台();
  const 天 = 864e5;
  Z.判('26 没抄过就算到点（第一次开机不必等到明天）', B.due({ on:true, every:'day' }, 0) === true);
  Z.判('27 每天那一档：差 23 小时没到、正好 24 小时就到',
    B.due({ on:true, every:'day' }, 此刻.getTime() - 23 * 36e5) === false
    && B.due({ on:true, every:'day' }, 此刻.getTime() - 天) === true);
  Z.判('28 每 3 天 / 每周两档的尺各是各的',
    B.due({ on:true, every:'3d' }, 此刻.getTime() - 2 * 天) === false && B.due({ on:true, every:'3d' }, 此刻.getTime() - 3 * 天) === true
    && B.due({ on:true, every:'week' }, 此刻.getTime() - 6 * 天) === false && B.due({ on:true, every:'week' }, 此刻.getTime() - 7 * 天) === true);
  Z.判('29 关了这一档、或选了「不自动」：永不到点，也不给下一刻',
    B.due({ on:false, every:'day' }, 0) === false && B.due({ on:true, every:'off' }, 0) === false
    && B.nextAt({ on:false, every:'day' }, 0) === 0 && B.nextAt({ on:true, every:'off' }, 0) === 0);
  const 账 = await B.check({ on:true, every:'day', dest:落 });
  Z.判('30 问一账答的是磁盘上那一颗最新的份（名字 + 时刻 + 下一颗表）',
    账.上回 === 'FD-2026-10-08-1400' && 账.上回时 === new Date(2026, 9, 8, 14, 0).getTime()
    && 账.下一回 === 账.上回时 + 天, 账);
  Z.判('31 时间戳那串名字读回的时刻和写出去的是同一个（收旧份排序靠它）',
    B.stampTime(B.stampOf(new Date(2026, 0, 2, 3, 4))) === new Date(2026, 0, 2, 3, 4).getTime() && B.stampTime('别的') === 0);
}

Z.题('六、页面上那一块配置和那颗表（fd4-builtin 的 Backup 真源码）');
const FD4 = rd('src/_fd/src/fd4-builtin.js');
const 耳 = { 表:0, 问:0, 抄:0, 存:0, 话:[], 后:[], cfg:null };
const 假 = {
  console, Store:{ loadJSON:async (rel, fb) => 假.cfgjson[rel], saveJSON:(rel, o) => { 耳.存++; 耳.cfg = JSON.parse(JSON.stringify(o)); } },
  toast:m => 耳.话.push(String(m)), setTimeout:(f, ms) => { 耳.表++; 耳.后.push(ms); return 耳.表; }, clearTimeout:() => {},
  Date, Math, Number, String, Object, Array, JSON, Boolean, isNaN, Promise, RegExp,
  window:{ FD_APP:{
    backupCheck:async cfg => { 耳.问++; return { 上回:'FD-2026-10-08-1400', 上回时:Date.UTC(2026, 9, 8), 到点:false, 下一回:Date.now() + 36e5 }; },
    backupRun:async () => { 耳.抄++; return { ok:true, msg:'抄了 12 个文件 · 34 KB', 坏:[] }; },
    backupPick:async () => 'D:/别处' } }
};
假.cfgjson = { 'backup.json': { on:true, every:'3d', keep:5, dest:'D:/备份处', 上一趟:'上回的事' } };
vm.createContext(假);
vm.runInContext(切(FD4, 'Backup') + '\n;globalThis.__B = Backup;', 假);
const 页 = 假.__B;
{
  const 洗 = c => 页.洗(c);
  Z.判('32 存档坏着也起得来：档位写错退回「每天」、份数写乱字退回 8、外加不是数组就当空',
    JSON.stringify(洗({ every:'随便', keep:'乱', extra:'不是数组' }).every) === '"day"'
    && 洗({ keep:'乱' }).keep === 8 && 洗({ extra:'不是数组' }).extra.length === 0, 洗({ every:'随便', keep:'乱' }));
  Z.判('33 份数封顶 60、不许 0（0 份等于抄一份扔一份，白抄）',
    洗({ keep:900 }).keep === 60 && 洗({ keep:-3 }).keep === 8);
  Z.判('34 不抄的默认那一列是 logs / gen-log / 日志，空数组不会把它抹掉',
    洗({ skip:[] }).skip.join(',') === 'logs,gen-log,日志');
  await 页.boot();
  Z.判('35 boot：认下配置（每 3 天、留 5 份、落点），问一账，只摆一颗表（不是一片表，也不是一遍遍问时间）',
    页.cfg.every === '3d' && 页.cfg.keep === 5 && 页.cfg.dest === 'D:/备份处'
    && 耳.问 === 1 && 耳.表 === 1 && 页.上回 === 'FD-2026-10-08-1400', [耳.问, 耳.表, 页.上回, 页.cfg]);
  页.cfg.on = false; 耳.表 = 0; 页.arm();
  页.cfg.on = true; 页.cfg.every = 'off'; 页.arm();
  页.cfg.every = 'day'; 页.cfg.dest = ''; 页.arm();
  Z.判('36 关了、选了不自动、还没定落点 —— 这三种都不摆表', 耳.表 === 0, 耳.表);
  页.cfg.dest = 'D:/备份处'; 耳.表 = 0; 页.arm();
  Z.判('37 定好落点才摆表，并且那颗表等的就是「下一回 − 现在」那一刻（不取整、不重设第二颗）',
    耳.表 === 1 && 耳.后[耳.后.length - 1] > 0 && 耳.后[耳.后.length - 1] <= 36e5, 耳.后);
  耳.抄 = 0; 页.正 = true;
  const 撞 = await 页.run('手动');
  Z.判('38 同一时刻第二趟来抄：被挡回去，一声「上一趟还没抄完」，不去惊动主进程',
    撞 === null && 耳.抄 === 0 && 耳.话.some(x => /上一趟还没抄完/.test(x)), 耳.话);
  页.正 = false; 耳.话.length = 0;
  const 成 = await 页.run('手动');
  Z.判('39 抄完了把这一趟的账写进配置（为什么抄、抄了多少、没抄上几个），并且重新摆一颗表',
    成.ok === true && 耳.抄 === 1 && 耳.存 >= 1 && /手动 · 抄了 12 个文件/.test(页.cfg.上一趟), [耳.抄, 耳.存, 页.cfg.上一趟]);
  Z.判('40 抄成功的 toast 说的是人话（抄了几个文件、多大）', 耳.话.some(x => /^备份好了：抄了 12 个文件/.test(x)), 耳.话);
  页.cfg.dest = ''; 耳.抄 = 0; 耳.话.length = 0;
  const 空 = await 页.run('手动');
  Z.判('41 没定落点就按「立刻抄一份」：一句「先定备份到哪一个文件夹」，不递空配置给主进程',
    空 === null && 耳.抄 === 0 && 耳.话.some(x => /先定/.test(x)), 耳.话);
  Z.判('42 开发服务器里（没有 FD_APP 那几条口子）这一档整个不摆出来，也不报错',
    /get 有\(\)\{ return !!\(window\.FD_APP && window\.FD_APP\.backupRun\); \}/.test(切(FD4, 'Backup'))
    && /if\(!window\.FD_APP \|\| !window\.FD_APP\.backupPick\)/.test(切(FD4, 'Backup')));
  const 块 = 切(FD4, 'tabData');
  Z.判('43 那一块里三样都摆着：开关和多久那一段、留几份那格、立刻抄那一颗钮，外加「再加一处文件夹」',
    /开这一档/.test(块) && /留几份/.test(块) && /立刻抄一份/.test(块) && /再加一处文件夹/.test(块));
  Z.判('44 去掉一处外加的不问一句（磁盘上一个字节都没动），定落点那一句也不问（盖不到他的东西）',
    !/fdAsk/.test(块.split('定期备份那一块')[1].split('界面文字清单')[0]));
  const 区 = 块.split('定期备份那一块')[1].split('界面文字清单')[0];
  Z.判('45 那一块的控件建一次就摆着：勾一下、改一个数都不整块重画（重画会把焦点从他手上那颗控件摘走 —— 目录那一栏闪烁、弹动是同一类病）',
    !/blk\.innerHTML/.test(区) && /const 补 = \(\) =>/.test(区) && /外加\.innerHTML = ''/.test(区));
  Z.判('46 只有字变了才回写那一行（字没变就不碰 textContent，切回来不会白跳一下）',
    /if\(账行\.textContent !== s\) 账行\.textContent = s/.test(区));
}

Z.题('七、他说的那一句：这次更新之后书的数据会不会丢');
const 造页 = rd('src/_fd/build.mjs'), 打包 = rd('src/pack/publish.mjs'), 铺 = rd('src/pack/mirror.mjs');
{
  /* 写成什么样不算，写「到哪几颗」才算：把两份脚本里所有写盘的目标名抠出来对一遍 */
  const 写目标 = [...new Set((造页.match(/fs\.(?:writeFileSync|appendFileSync|rmSync|mkdirSync)\((\w+)/g) || [])
    .map(x => x.replace(/.*\((\w+)/, '$1')))];
  Z.判('47 生成那一趟往磁盘写的目标只有 OUT_DIR 和 OUT 两个名字，而 OUT 就钉在 pages\\ 那一层（书的文件不在它的射程里）',
    写目标.sort().join(',') === 'OUT,OUT_DIR' && /const OUT_DIR = TREE\.pages/.test(造页)
    && /const OUT = path\.join\(OUT_DIR, 页名\(版\)\)/.test(造页)
    && /return 'Flow_Desk_' \+ \(用了 \|\| 号\(\)\) \+ '\.html'/.test(rd('src/_build/version.mjs')), 写目标);
  Z.判('48 首装和覆盖升级那一颗 exe 带的是整棵树，publish 顶上那道硬闸盯着 data\ 这一格（用户写的书一个字节都不进包）',
    打包.includes("k === 'data' || k.startsWith('data/')") && /process\.exit\(1\)/.test(打包));
  Z.判('49 程序壳那一层收 src\\pack 全部 .cjs：新加的 backup.cjs 不用补名单就进得了产物',
    铺.includes('.filter(x => /\\.(cjs|ps1)$/.test(x))') && /checkShellRequires/.test(铺));
  Z.判('50 主进程那一头默认就数据层一棵（用户配置 data\\userdata-fd 本就在它底下，不并列成第二处、少抄一遍）',
    /backup:run/.test(rd('src/pack/main.cjs')) && /BACKUP\.run\(/.test(rd('src/pack/main.cjs'))
    && /label:'数据', dir:DATA_ROOT/.test(rd('src/pack/main.cjs'))
    && !/label:'用户配置'/.test(rd('src/pack/main.cjs')));
}

收场();
Z.数('临时树', 工区 + '（跑完已收掉）');
Z.收尾();
