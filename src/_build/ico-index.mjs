/* ============================================================
   图标索引（#245）：往 icons\ 文件夹里放一份「索引.txt」，
   记录每一张图是什么、用在哪、哪些代码在叫它。
   谁丢了新图、删了旧图、改了引用，跑一遍这个脚本就重新对齐：
     node src/_build/ico-index.mjs
   索引同时写两处：出厂那份 src\pack\icons\（跟着构建走），
   正在用的那份 icons\（打开文件夹就能看）。
   图标扫描只认 .svg/.png/.jpg/.jpeg/.webp/.gif，.txt 不会被当成图标。
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FACTORY = path.join(ROOT, 'src', 'pack', 'icons');
const WORKING = path.join(ROOT, 'icons');
const EXT = ['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif'];

/* ---------- 每行中文说明（白话，说清这张图在屏幕上干什么） ----------
   名字和 icons\ 里的文件名去掉后缀一致；出厂线稿在 sh-ico.js 的 ICO_D 里同名。 */
const DESC = {
  undo:       '撤回：为写编辑器工具条、白板左上角',
  redo:       '重做：和撤回排在一起',
  anno:       '批注：正文右侧批注、右键菜单「添加批注」',
  rev:        '修订：编辑器模式那一组里的修订档',
  pencil:     '编辑 / 改代码：卡片标题上的 ✎、功能表「改代码」入口',
  findBook:   '找书（本书内搜索）：为写工具条搜索入口',
  findAll:    '全局搜索放大镜：词库、列表上方的搜索框',
  speak:      '语音（朗读）：为写工具条那一档',
  ver:        '历史版本（带箭头的钟）：章节 ⋮ 菜单、历史版本入口',
  exp:        '导出本章（下箭头）：为写工具条导出',
  expBook:    '整本导出（摊开的书）：导出面板里和「本章」分开的那一档',
  tidy:       '一键排版（扫帚）：为写工具条',
  'al-left':   '对齐·左对齐：工具条对齐那一组四张',
  'al-center': '对齐·居中：同上',
  'al-right':  '对齐·右对齐：同上',
  'al-ju':     '对齐·两端对齐：同上',
  indent:     '缩进：工具条缩进那一组',
  lh:         '行距：工具条间距那一组（行与行）',
  pg:         '段距：工具条间距那一组（段前段后）',
  blank:      '空行：删空行、段落间空行档位',
  size:       '字号（一大一小两个 A）：字号档、字体选择器',
  'w-mid':    '栏宽·适中：排版面板三档栏宽之一',
  'w-fill':   '栏宽·铺满：同上',
  'w-cut':    '栏宽·收窄：同上',
  ul:         '无序列表（圆点三条）：富文本块类型',
  ol:         '有序列表（1. 2. 三条）：富文本块类型',
  todo:       '待办清单（打勾方框）：富文本块类型',
  link:       '插入链接：富文本工具条',
  clear:      '清除格式：富文本工具条',
  img:        '插入图片：富文本工具条',
  tbl:        '插入表格：富文本工具条',
  home:       '首页 / 书架：为写左边那一竖条第一项',
  list:       '列表视图：目录、书架的视图切换',
  grid:       '网格视图：卡片墙、视图切换',
  idea:       '灵感（灯泡）：左竖条灵感池、灵感卡',
  board:       '白板（三点连线）：左竖条白板',
  tag:        '标签（尖头牌）：设定卡标签、日程标签',
  bank:       '词库（带柱子的房子）：Flow-Desk 卡片标题上的词库钮、为写词库页',
  log:        '日志 / 记录：左竖条日志、运行记录',
  gear:       '设置（齿轮）：Flow-Desk、为写各处设置入口',
  code:       '改代码（尖括号）：停靠标题条、内置功能改代码',
  pin:        '钉住：停靠面板标题条',
  eye:        '眼睛睁开：列表里「显示」（文字胶囊名单）',
  eyeOff:     '眼睛闭上：同上一档的「已隐藏」状态',
  menu:       '菜单（三条横线）：Flow-Desk 自绘标题栏最左边',
  winMin:     '窗口最小化：自绘标题栏右边四个按钮之一',
  winMax:     '窗口最大化：同上',
  winRestore: '窗口还原：同上（最大化之后换这张）',
  winClose:   '窗口关闭：同上，最右边那个',
  close:      '关闭 ×：卡片右上角、弹窗、标签页上的叉',
  card:       '功能牌（默认）：功能/插件没带自己图标时用它兜底',
  tpl:        '模板：设定卡模板、模板列表',
  music:      '音乐：音乐遥控器、歌词、播放器',
  swap:       '互换（上下两箭头）：换色、两边调换',
  keyboard:   '键盘：设置里的快捷键那一页',
  quote:      '引用块（两对引号）：富文本块类型',
  slot:       '时段色点（半填圆）：日程槽位选颜色',
  expand:     '展开（四角外扩）：卡片展开、全屏入口',
  caretDown:  '下拉箭头（朝下）：所有下拉框右边、折叠展开',
  caretUp:    '朝上箭头：收起、上一条那一类',
  caretLeft:  '朝左箭头：日程树折叠、翻上一条',
  caretRight: '朝右箭头：日程树展开、翻下一条',
  box:        '空方框：没勾上的复选框',
  check:      '对勾：勾上了、确认',
  cross:      '叉（比 close 更粗的 ×）：不合格、去掉',
  grip:       '六点拖把手：长按拖动提示、可拖的行列',
  imp:        '导入（进箭头）：导入配方、导入数据',
  disk:       '存盘（软盘）：Ctrl+S 保存入口',
  split:      '分屏（中间一竖线两块）：为写中栏左右分屏',
  plus:       '加号：用得最多的一个 —— 新建章、加子日程、加条目、加词',
  kebab:      '竖三点 ⋮：章节菜单、每行的更多操作',
  star:       '星标（实心）：收藏、你的句子',
  starOff:    '星标（空心）：还没收藏',
  cal:        '日历：日程「今天」、日历视图',
  stats:      '统计（柱图）：码字统计、字数统计',
  rel:       '关系（两个相交圆）：设定卡关系图、关联',
  bullet:     '实心圆点：列表符号、色点占位',
  pilcrow:    '段落记号 ¶：章纲 gutter 以前的旧符号（现已换成段落序号，图留着认旧数据）',
  pool:       '卡片池（两张叠牌）：设定卡卡片池',
  font:       '字体（A 带挑脚）：字体选择器、每组件字体',
  prev:       '上一条（‹ 尖角）：翻页、逐条走',
  next:       '下一条（› 尖角）：同上',
  minus:      '减号：缩小、删一档、折叠',
  up:         '上移（杆顶箭头）：列表、轨道上下换序',
  down:       '下移：同上',
  dock:       '停靠到右栏（右侧带线的面板）：为写停靠入口',
  cycle:      '再来一轮（绕圈箭头）：生成器不合格重试、重新抽',
  sort:       '拖行换序（两根带箭头竖杆）：白板轨道、字体列表',
  h1: '标题 1 档：工具条标题六档之一',
  h2: '标题 2 档：同上', h3: '标题 3 档：同上', h4: '标题 4 档：同上',
  h5: '标题 5 档：同上', h6: '标题 6 档：同上',
  FD_Icon:  'Flow-Desk 的程序图标：exe、任务栏、托盘、桌面入口都用它'
};

/* 从前这里还有一段 texDesc()：从 sh-look.js 的 LOOK_TEXTURES 现读那十一张平铺图的说明，
   拼成 textures-<名字> 那一批条目。预设纹理 2026-10-08 按作者的话全撤了（图、清单、那一格都不在程序里了），
   那张表也跟着没 —— 平铺图现在住在图片库（data\images.yaml），名字由那份清单自己记，不归图标索引管。 */

/* ---------- 哪张代码文件在叫这张图：扫引用 ----------
   三条路都算引用：icoMarkup('名字')、注册字段 icon:'名字'、
   还有老数据里的字符（sh-ico.js 的字符对照表把 '▤' 认成 log）。 */
const SCAN_DIRS = ['src/_shared', 'src/_fd/src', 'src/_wnw/src', 'src/pack', 'data/plugins'];
const SKIP_FILE = /[\\/](extracted\.js|索引\.txt)$/;
const EXT_SRC = /\.(js|cjs|mjs|json)$/;
function walk(dir, out){
  let st = null; try{ st = fs.readdirSync(dir, { withFileTypes:true }); }catch(e){ return out; }
  for(const s of st){
    const f = path.join(dir, s.name);
    if(s.isDirectory()){ if(!s.name.startsWith('.') && s.name !== 'node_modules') walk(f, out); }
    else if(EXT_SRC.test(s.name) && !SKIP_FILE.test(f)) out.push(f);
  }
  return out;
}
/* 字符对照表从 sh-ico.js 里现读，别在这儿抄一份两边跑偏 */
function aliasChars(){
  const m = {};
  try{
    const src = fs.readFileSync(path.join(ROOT, 'src/_shared/sh-ico.js'), 'utf8');
    const block = src.match(/GLYPH_ALIAS\s*=\s*\{([\s\S]*?)\n\};/);
    if(block) for(const g of block[1].matchAll(/'([^']+)'\s*:\s*'([^']+)'/g)){
      (m[g[2]] = m[g[2]] || []).push(g[1]);
    }
  }catch(e){}
  return m;
}
const files = [];
for(const d of SCAN_DIRS) walk(path.join(ROOT, d), files);
const reads = files.map(f => ({ f, txt: fs.readFileSync(f, 'utf8') }));
const ALIAS = aliasChars();
function refWhere(name){
  const al = ALIAS[name] || [];
  const hits = [];
  for(const r of reads){
    const rel = path.relative(ROOT, r.f).replace(/\\/g, '/');
    if(rel === 'src/_shared/sh-ico.js') continue;   /* 那是出厂线稿和字符对照表本身，不算用它的地方 */
    const q = new RegExp('["\']' + name.replace(/[-]/g, '\\-') + '["\']', 'g');
    if(/^data\/plugins\//.test(rel)){
      /* 插件自己的引用记成包名，索引里一行就够 */
      const id = rel.split('/')[2];
      q.lastIndex = 0;
      if(!q.test(r.txt) && !al.some(c => r.txt.includes("'" + c + "'"))) continue;
      const key = 'data/plugins/' + id;
      if(!hits.some(x => x.file === key)) hits.push({ file:key, n:0 });
      hits[hits.length - 1].n++;
      continue;
    }
    /* 名字在哪被叫：引号里的名字（icoMarkup('x')、btn('x')、i:'x'、icon:'x'、['x','说明'] 都算），
       再加上老数据字符（'▤' 这类经字符对照表认成这张图的） */
    const n = (r.txt.match(q) || []).length
      + al.reduce((s, c) => s + (r.txt.match(new RegExp('["\']' + c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\']', 'g')) || []).length, 0);
    /* 子文件夹那层的名字多半是拼出来的（'文件夹名-' + 文件名），整串扫不到，
       所以前缀带引号加号的那种叫法也算引用这一张图 */
    let pn = 0;
    const dash = name.indexOf('-');
    if(!n && dash > 0){
      const pre = name.slice(0, dash + 1).replace(/[-]/g, '\\-');
      pn = (r.txt.match(new RegExp('["\']' + pre + '["\']\\s*\\+', 'g')) || []).length;
    }
    if(n || pn) hits.push({ file:rel, n: n || pn });
  }
  return hits.sort((a, b) => b.n - a.n);
}

/* ---------- 认文件夹：有什么图就写什么行，顺带揪出两个家不一样多的 ----------
   只开一层子文件夹（和主进程那趟扫描同一个口径，见 src/pack/main.cjs 的 iconScan）：
   icons\子文件夹\x.png 在这里的名字是 子文件夹-x。 */
function namesIn(dir){
  const out = new Set();
  const base = (d, into) => {
    let st = [];
    try{ st = fs.readdirSync(d); }catch(e){ return; }
    for(const n of st){
      const ext = path.extname(n).toLowerCase();
      if(EXT.includes(ext)) into.add(n.slice(0, n.length - ext.length));
    }
  };
  const sub = [];
  try{
    for(const st of fs.readdirSync(dir, { withFileTypes:true })){
      if(st.isDirectory() && !st.name.startsWith('.') && !st.name.startsWith('_')) sub.push(st.name);
    }
  }catch(e){}
  base(dir, out);
  for(const s of sub){
    const one = new Set();
    base(path.join(dir, s), one);
    for(const n of one) out.add(s + '-' + n);
  }
  return out;
}
const factory = namesIn(FACTORY), working = namesIn(WORKING);
const all = new Set([...factory, ...working, ...Object.keys(DESC)]);
/* 内嵌出厂线稿（ICO_D）里有的名字也算进来：图标文件夹没读到时靠这一组顶着 */
try{
  const src = fs.readFileSync(path.join(ROOT, 'src/_shared/sh-ico.js'), 'utf8');
  const block = src.match(/ICO_D\s*=\s*\{([\s\S]*?)\n\};/);
  if(block) for(const g of block[1].matchAll(/^\s{2}([a-zA-Z0-9_-]+):/gm)) all.add(g[1]);
}catch(e){}

const lines = [
  '【图标索引】一张图一行：文件名 = 这是干什么的（引用它的代码）',
  '  这份是 node src/_build/ico-index.mjs 生成的，别手动改它；改了下次重新生成就没了。',
  '  想换某个图标：认准下面那行说它是干什么的，同名换图就行，存盘就用新图，不用重启。',
  '  新增图：起个英文名丢进这个文件夹（.svg 最好，线条跟着字色走；.png 贴原色），再跑一遍生成脚本登记。',
  '  这个文件夹下面还能开一层子文件夹，那里面的名字念作「文件夹名-文件名」（只认一层）。',
  '  icons\\ 里只认 .svg .png .jpg .jpeg .webp .gif 六种后缀，这个 .txt 不会被当成图标。',
  '  插件的图标不住这个文件夹，住在 data\\plugins\\<包>\\images\\icon.svg，名字记成 pack-<包名>，在最后一节列。'
];
const rows = [];
let noDesc = [];
for(const n of [...all].sort((a, b) => a.localeCompare(b))){
  if(!DESC[n]) noDesc.push(n);
  const refs = refWhere(n);
  const refTxt = refs.length ? refs.slice(0, 4).map(x => x.file + '×' + x.n).join('，') + (refs.length > 4 ? ' 等' + refs.length + '处' : '') : '没有代码直接叫它（可能是备用或已改名）';
  rows.push({ n, has: factory.has(n) || working.has(n), where: DESC[n] || '', refTxt });
}
if(noDesc.length){ console.log('索引里没有说明的名字：' + noDesc.join(', ')); }

lines.push('', '# —— 通用图标（icons\\ 文件夹）——');
for(const r of rows){
  if(!r.has) continue;
  const inBoth = factory.has(r.n) && working.has(r.n);
  const note = inBoth ? '' : (working.has(r.n) ? '（只在正在用的那份里，出厂那份没这张）' : '（只在出厂那份里，正在用的文件夹丢了这张）');
  lines.push(r.n + ' = ' + (r.where || '（没登记说明）') + note + ' —— 引用：' + r.refTxt);
}
const onlyDesc = rows.filter(r => !r.has);
if(onlyDesc.length){
  lines.push('', '# —— 说明了但文件夹里没这张图（该补图或删这条说明）——');
  for(const r of onlyDesc) lines.push(r.n + ' = ' + r.where + ' —— 引用：' + r.refTxt);
}
/* 插件自己那张也登记进来 */
const packRows = [];
try{
  const dir = path.join(ROOT, 'data', 'plugins');
  for(const st of fs.readdirSync(dir, { withFileTypes:true })){
    if(!st.isDirectory() || st.name.startsWith('.') || st.name.startsWith('_')) continue;
    const idir = path.join(dir, st.name, 'images');
    let f = '';
    try{ f = (fs.readdirSync(idir).find(x => EXT.includes(path.extname(x).toLowerCase())) || ''); }catch(e){}
    if(f) packRows.push('pack-' + st.name + ' = 组件「' + st.name + '」露脸那一张（功能列表、卡片标题） · ' + f);
  }
}catch(e){}
if(packRows.length){
  lines.push('', '# —— 插件图标（住在各包自己的 images\\ 里）——');
  lines.push(...packRows);
}
const text = lines.join('\n') + '\n';
for(const dir of [FACTORY, WORKING]){
  try{ fs.writeFileSync(path.join(dir, '索引.txt'), text); console.log('已写 ' + path.relative(ROOT, path.join(dir, '索引.txt'))); }
  catch(e){ console.log('写失败 ' + dir + '：' + e.message); }
}
console.log('通用图标 ' + rows.filter(r => r.has).length + ' 张，包图标 ' + packRows.length + ' 张');
