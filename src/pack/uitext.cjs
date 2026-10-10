/* ============================================================
   界面文字映射（批⑤ 第 6 项）· 扫描、清单、写回，全在这一份
   ----------
   要做的事：界面上那些字由用户说了算。办法是一份明文清单（YAML · 按页分组），一行一个地方：
     Flow-Desk · 顶栏:
       添加插件: 加功能
   段首那一行写清是哪一页（Flow-Desk 桌面的、设置里哪一页、哪个功能包的、主进程菜单和托盘里的）。
   功能包那一段的名字用它在说明书里的中文名（为写、声笔输入法练习、你的便签、你的句子、音乐遥控器…）。
   同一个字出现在不同的页就是不同段底下的两行，可以各写各的。
   清单存在 数据\ui-text.yaml。
   ----------
   四件事都在这一个文件里，构建脚本、主进程、我测的时候都从这里取，别处不写第二套：
     collectAll()  扫源码，得出每一处界面文字在哪个文件第几行第几列
     render()      把扫出来的东西写成清单文本；他改过的那一列原样留着
     parse()       读清单文本
     plan()/apply() 按清单把源码里那句原文改成他写的那一句
   ----------
   认「哪一句是给人看的字」的口径：
     见汉字就收（2026-10-03 他拍的）：带着汉字的字符串一律进清单，不挑它住在哪一档；
       认得出档位的照旧写明（属性 title / 在 h() 里面 / 数组里的一项），认不出的标一句「别处的一句」。
       每收进来一处，清单里都带着「在哪个文件第几行」，改字工具那一页会说清是哪一页的哪个位置。
     注释、正则、比较用的常量、路径、文件名、CSS 不收；
     拿去词库查东西的那一类名字不收：走读词库那几个动作（pool / opts / raw / cats 和功能包自己
       那几只取字的）传进去的、写在 cat: 和 multi: 后面的、方括号里光秃秃只有一句字用来当键取值的
       （s['收获.收获类别']）—— 这些都是「去哪儿取字」的地址，界面上显示不出来，改它们等于改词库，
       不该进这份清单；方括号里那句是跟着别的东西拼出来的（out[起的名字 || '定义']）另说，
       那一句是运行时现起的名字，界面上看得着，照收；
     拼接出来的（'一共 ' + n + ' 项'）收成模板（一共 {1} 项），写回时按 {1} {2} 拆回原来那几段；
     模板串里带 ${…} 的不收（说不清哪一段是字）；
     三个静态 html 里标签之间的字和 title / placeholder 也收；html 里内嵌 <script> 那一层照 JS 的口径收（外42 三补的）。
     每一段的名字（哪个程序的哪一页）一律从真身取：功能包读它自己说明书里的 name，
       不在这份文件里另抄一份功能名。
   ----------
   命令行（在 src\pack 里跑，也可以从别处跑，路径按相对位置找）：
     node uitext.cjs          重新扫一遍，刷新 数据\ui-text.yaml（只动清单，源码一个字不碰）
     node uitext.cjs stats    只报数
     node uitext.cjs dump     把清单打到标准输出，看样本
   ============================================================ */
const fs = require('fs');
const path = require('path');

const CN = /[\u4e00-\u9fa5]/;
const HAS_CN = s => CN.test(s);
/* 清单里一行只能写一句：带换行的不收 */
const MULTI = /[\r\n]/;
/* 一看就是路径、文件名、CSS 选择器、样式属性的不收 */
const NOT_UI = [/\.(json|md|txt|html?|js|cjs|mjs|css|yaml|yml|dic|dll|ps1|exe|png|jpg|jpeg|svg|zip|bat|ts)$/i,
  /^[\\/]/, /\\\\/, /^\s*[.#][\w-]/, /^[\w-]+:[\w-]+$/, /^--/, /^[a-z-]+$/];
/* 长到这个样的多半是一段说明文档或一段样式 */
const TOO_LONG = 300;

/* ---------- 1. 分词 ---------- */
function tokenize(src){
  const out = [];
  let i = 0, line = 1, col = 1, prev = null;
  const at = t => { t.line = line; t.col = col; return t; };
  const bump = n => { for(let k = 0; k < n; k++){ if(src[i + k] === '\n'){ line++; col = 1; } else col++; } i += n; };
  const isRegexOk = p => {
    if(!p) return true;
    if(p.k === 'id') return ['return','typeof','case','in','of','new','delete','void','do','else','yield','await'].includes(p.v);
    if(p.k === 'str' || p.k === 'tpl' || p.v === ')' || p.v === ']') return false;
    return true;
  };
  while(i < src.length){
    const c = src[i];
    if(c === '\n' || c === ' ' || c === '\t' || c === '\r'){ bump(1); continue; }
    if(c === '/' && src[i + 1] === '/'){ const j = src.indexOf('\n', i); bump(j < 0 ? src.length - i : j - i); continue; }
    if(c === '/' && src[i + 1] === '*'){ const j = src.indexOf('*/', i + 2); bump(j < 0 ? src.length - i : j + 2 - i); continue; }
    if(c === '"' || c === "'" || c === '`'){
      const q = c; let j = i + 1, raw = '', esc = false, ok = true;
      while(j < src.length){
        const d = src[j];
        if(esc){ raw += d; esc = false; j++; continue; }
        if(d === '\\'){ esc = true; raw += d; j++; continue; }
        if(d === q){ j++; break; }
        if(d === '\n' && q !== '`'){ ok = false; break; }
        raw += d; j++;
      }
      if(!ok){ bump(1); continue; }                     /* 引号没配上：这一句不认，往后挪一个字再看 */
      if(j >= src.length && src[src.length - 1] !== q){ bump(1); continue; }
      const t = { k: q === '`' ? 'tpl' : 'str', raw, q, start:i, end:j };
      at(t);
      if(t.k === 'tpl' && /\$\{/.test(raw)) t.slots = 1;
      out.push(t); prev = t; bump(j - i); continue;
    }
    if(c === '/' && isRegexOk(prev)){
      let j = i + 1, esc = false, cls = false, ok = false;
      while(j < src.length){
        const d = src[j];
        if(d === '\n') break;
        if(esc) esc = false;
        else if(d === '\\') esc = true;
        else if(d === '[') cls = true;
        else if(d === ']') cls = false;
        else if(d === '/' && !cls){ j++; ok = true; break; }
        j++;
      }
      if(ok){ const t = { k:'re', v:src.slice(i, j) }; at(t); out.push(t); prev = t; bump(j - i); continue; }
      bump(1); continue;
    }
    if(/[A-Za-z_$\u4e00-\u9fa5]/.test(c)){
      let j = i; while(j < src.length && /[A-Za-z0-9_$\u4e00-\u9fa5]/.test(src[j])) j++;
      const t = { k:'id', v:src.slice(i, j) }; at(t); out.push(t); prev = t; bump(j - i); continue;
    }
    const three = src.substr(i, 3), two = src.substr(i, 2);
    if(['===','!=='].includes(three)){ const t = { k:'op', v:three }; at(t); out.push(t); prev = t; bump(3); continue; }
    if(['==','!=','<=','>=','&&','||','??','=>'].includes(two)){ const t = { k:'op', v:two }; at(t); out.push(t); prev = t; bump(2); continue; }
    if('{}()[],:;.+*?='.includes(c)){ const t = { k:c }; at(t); out.push(t); prev = t; bump(1); continue; }
    bump(1);
  }
  return out;
}
/* 转义还原成界面上真正的那几个字 */
function unesc(raw){
  return String(raw).replace(/\\([\s\S])/g, (s, c) => c === 'n' ? '\n' : c === 't' ? '\t' : c === 'r' ? '' : c);
}
/* 反过来：界面上那几个字写回源码。q 是引号；html 表示静态页面里的字，按 html 的规矩转义 */
function resc(text, q){
  if(q === 'html') return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if(q === 'attr') return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let s = String(text).replace(/\\/g, '\\\\').replace(/\r/g, '').replace(/\n/g, '\\n');
  if(q === '`') s = s.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  else if(q === '"') s = s.replace(/"/g, '\\"');
  else s = s.replace(/'/g, "\\'");
  return s;
}

/* ---------- 2. 哪些位置上的字符串是"给人看的字" ---------- */
const DISPLAY_KEYS = new Set(['title','placeholder','label','text','textContent','desc','tip','tips',
  'message','detail','btn','caption','hint','ph','aria','html','say']);
const NOT_KEYS = new Set(['class','style','id','type','accept','download','href','src','rel','key','db','store',
  'value','width','height','min','max','step','size','color','font','content','pattern','for','role','method',
  'url','path','dir','file','name','data','dataset','on','onclick']);
const DISPLAY_CALLS = new Set(['h','toast','row','seg','segCtrl','option','field','check','radio','tab','menu',
  'sub','item','note','say','confirm','ask','line','kv','chip','btn','label','SetupTabs','Modal','Overlay','trayText']);
const SKIP_CALLS = new Set(['log','logLine','push','test','replace','split','join','includes','indexOf','lastIndexOf',
  'startsWith','endsWith','match','readdir','readFileSync','writeFileSync','existsSync','mkdirSync','require','fetch',
  'atob','btoa','encodeURI','decodeURI','encodeURIComponent','decodeURIComponent','setAttribute','getAttribute',
  'querySelector','querySelectorAll','closest','addEventListener','removeEventListener','on','once','off','send',
  'invoke','handle','readFile','writeFile','stat','cmp','RegExp','createElement','setProperty','find','filter',
  'some','every','sort','map','reduce','slice','padEnd','padStart','concat','removeChild','appendChild','insertBefore',
  'has','add','delete','get','set','emit','watch','mkdir','rm','unlink','rename','copy','exec','spawn','open']);
/* 读词库的那几个动作：传进去的名字是「去词库哪一类取字」的地址，不是界面上给人看的字。
   后八个是功能包自己包的那几层取字的（pFirst('模块条目.主角') 那种），口径同一个。 */
const BANK_CALLS = new Set(['pool','opts','raw','cats','pFirst','pPick','pPickMulti','pPickAny','entriesOf']);
/* 写在 cat: 和 multi: 后面的值同理：是查词库用的地址 */
const ADDR_KEYS = new Set(['cat','multi']);
/* ---------- 「这一句摆在软件里的哪个位置」 ----------
   改字工具那一页要说人话：他在界面上找那句字，靠的是「哪个程序 · 哪一页 · 摆在什么上面」，
   不是源码文件名和第几行。下面三张表把源码里认出来的那些线索（属性名、调用名、h() 的第一个参数）
   翻成一句白话。认不出来的留空，那一行就只说程序、页名和句子本身。 */
const ATTR_POS = { title:'鼠标停在上面时的那行小字', placeholder:'输入框里那句还没打字的灰字', ph:'输入框里那句还没打字的灰字',
  alt:'图片显示不出来时顶上那几个字', aria:'读屏软件念出来的那句说明', caption:'标题', text:'界面上的一句',
  desc:'一句说明', tip:'一句说明', tips:'一句说明', message:'一句说明', detail:'更细的一句说明', hint:'一句说明',
  textContent:'界面上的一句', html:'界面上的一段', btn:'按钮上的字', say:'临时冒出来的那句话' };
const CALL_POS = { toast:'临时冒出来的那句话', say:'临时冒出来的那句话', confirm:'对话框里问你的那句', ask:'对话框里问你的那句',
  Modal:'对话框里的话', Overlay:'盖在界面上的那一层', option:'下拉列表里的一个选项', tab:'标签上那几个字',
  SetupTabs:'设置左边那一列标签', menu:'菜单里的一项', sub:'菜单里的一项', item:'菜单里的一项',
  trayText:'托盘图标上的字', note:'一行说明的小字', row:'设置或列表里的一行', field:'设置里一行的名字',
  check:'勾选框旁边的说明', radio:'单选那一栏的说明', seg:'分段按钮上那几个字', segCtrl:'分段按钮上那几个字',
  btn:'按钮上的字', label:'挨在旁边的那句说明', line:'一行字', kv:'一行里左边那个名字' };
const TAG_POS = { button:'按钮上的字', a:'链接上的字', span:'那一截字', p:'那一段话', div:'页面上的一段话', label:'挨在旁边的那句说明', li:'列表里的一项', ul:'列表里的一项', ol:'列表里的一项', b:'加重的那几个字', strong:'加重的那几个字', small:'一行说明的小字',
  option:'下拉列表里的一个选项', input:'输入框里的字', textarea:'输入框里的字', legend:'一组东西顶上的名字',
  th:'表头那一格', td:'表格里的一格', h1:'标题', h2:'标题', h3:'标题', h4:'标题', h5:'标题', h6:'标题', title:'标题栏' };
/* h() / row() 这一类里第一个参数就是标签名或控件名，扫到它的时候记在栈上那一级 */
const TAG_ARG_CALLS = new Set(['h','row','field','segCtrl','btn','note','line','menu','item','sub','kv','seg','tab','option','check','radio']);
function posOf(key, call, tag, inH){
  if(key && ATTR_POS[key]) return ATTR_POS[key];
  if(call && CALL_POS[call]) return CALL_POS[call];
  if(tag && TAG_POS[tag]) return TAG_POS[tag];
  if(inH) return '界面上的一处';
  return '';
}

/* 方括号里当键取值用的那个字符串（s['收获.收获类别']）也是地址；
   紧跟在 return / case / in 这些字后面的方括号是数组底子，不算取值 */
const AFTER_RETURN = new Set(['return','case','in','of','typeof','new','delete','void','await','yield','do','else']);
/* 往上找最近的那一层：数组只是套着，接着往上问；碰到对象取它那个键名，碰到调用取它那个函数名 */
function ownerKey(stack){
  for(let k = stack.length - 1; k >= 0; k--){
    const f = stack[k];
    if(f.type === 'obj') return f.key || '';
    if(f.type === 'call') return '';
  }
  return '';
}
function ownerCall(stack){
  for(let k = stack.length - 1; k >= 0; k--){
    const f = stack[k];
    if(f.type === 'call') return f.name || '';
    if(f.type === 'obj') return '';
  }
  return '';
}

/* 一个文件里每个函数 / 方法从哪一行开始（只用来给出处起个页名，不讲究嵌套） */
function fnMap(src){
  const list = [];
  const re = /^\s{0,8}(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^\s{0,8}(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*\{|^\s{0,8}(?:async\s+)?([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?(?:function|\(|[^)]*=>)/gm;
  const skipWord = new Set(['if','for','while','switch','catch','return','function','const','let','var','do','else','try','new']);
  let m;
  while((m = re.exec(src))){
    const name = m[1] || m[2] || m[3];
    if(!name || skipWord.has(name)) continue;
    list.push({ line:src.slice(0, m.index).split('\n').length, name });
  }
  list.sort((a, b) => a.line - b.line);
  return list;
}
function fnAt(map, line){
  let got = '';
  for(const f of map){ if(f.line <= line) got = f.name; else break; }
  return got;
}

/* ---------- 3. 出处：哪个程序的哪一页 ---------- */
const P_FD = 'Flow-Desk', P_WNW = '为写', P_RP = '声笔输入法练习',
  P_MAIN = 'Flow-Desk 主进程', P_SH = '共用模块', P_PACK = '功能包', P_WC = '组件定制';
/* 功能包那几段的名字不在这儿抄第二份：读各包自己那份说明书（manifest.json 里的 name），
   改名字、装功能、卸功能都跟着真身走。以前这里抄过一份功能包的名字表，包一改名清单上就凭空
   多出一段谁也对不上的旧名字，所以改成读说明书。 */
function packNames(TREE){
  const out = {};
  const dir = path.join(TREE, 'data', 'plugins');
  let es = [];
  try{ es = fs.readdirSync(dir, { withFileTypes:true }); }catch(e){ return out; }
  for(const e of es){
    if(!e.isDirectory()) continue;
    try{
      const m = JSON.parse(fs.readFileSync(path.join(dir, e.name, 'manifest.json'), 'utf8'));
      if(m && m.name) out[e.name] = String(m.name);
    }catch(err){}
  }
  return out;
}
const SH_CN = { 'sh-bank-ui':'词库界面', 'sh-banks':'词库', 'sh-code':'改代码', 'sh-color':'配色',
  'sh-doc':'文档', 'sh-font':'字体', 'sh-gen':'生成器', 'sh-ico':'图标', 'sh-icode':'代码编辑器',
  'sh-log':'生成记录', 'sh-packs':'插件装卸', 'sh-look':'外观这一层', 'sh-mus':'播放进度那一条桥',
  'sh-ttml':'歌词时间尺（ttml / lrc）',
  'sh-style':'样式', 'sh-text':'界面文字', 'sh-wizard':'配方向导', 'sh-rand':'零碎帮手', 'sh-store':'数据库助手',
  'sh-load':'插件加载接线' };
const FD_CN = { 'fd2-store.js':'存储', 'fd3-lib.js':'三份库文件（色卡 / 外观方案 / 图片库）',
  'fd3-shell.js':'主界面', 'fd4-builtin.js':'内置组件',
  'fd5-load.js':'插件加载接线', 'fd6-boot.js':'启动', 'fd10-size.js':'卡片大小', 'fd11-cards.js':'色卡',
  'fd12-rime-colors.js':'小企鹅配色那一串色号', 'fd13-colour-v1.js':'内置配色与随包纹理',
  'fd8-tools.js':'中立工具', 'fd9-title.js':'标题栏' };
const WNW_CN = { 'w0-skin.js':'为写的皮肤与骨架', 'w1-core.js':'基础', 'w2-theme.js':'配色', 'w3-shell.js':'主界面',
  'w5-load.js':'插件加载接线', 'w6-boot.js':'启动',
  'w7-data.js':'数据与词库', 'w8-write.js':'写作台', 'w9-shelf.js':'书架', 'w10-cards.js':'设定卡',
  'w11-board.js':'看板', 'w12-rich.js':'富文本', 'w13-docx.js':'导出 Word', 'w14-num.js':'章节序号',
  'w15-hist.js':'历史版本', 'w16-export.js':'导出', 'w17-tags.js':'标签',
  'w18-lyric.js':'词格', 'w19-cruise.js':'词巡航', 'w20-keystroke.js':'逐字记录' };
const RP_CN = { 'p1.js':'取码与方案', 'p2.js':'文件加载', 'p3.js':'方案族', 'p4.js':'编码规则',
  'p5.js':'编码变换', 'p6.js':'外观与存储' };

/* 动态认：FD 的 SetupTabs.add、WNW 的 Settings.tabs —— 函数名对应设置里的哪一页 */
function settingPages(files){
  /* 一张空底的表：不能用 {} —— {} 身上带着 constructor 这些祖传的名字，
     组件里谁写了个 constructor 方法，就会被认成「设置 · undefined」那一页。 */
  const dyn = Object.create(null);
  const fd = files['src/_fd/src/fd4-builtin.js'];
  if(fd){ let m; const re = /SetupTabs\.add\(\s*'([^']+)'\s*,\s*(\w+)/g; while((m = re.exec(fd))) dyn[m[2]] = [P_FD, '设置 · ' + m[1]]; }
  const wn = files['src/_wnw/src/w3-shell.js'];
  if(wn){
    const blk = wn.match(/tabs:\s*(\[[^\n]*?\[\s*'\w+'\s*,\s*'[^']*'\s*\][^\n]*\])/);
    if(blk){ let m; const re = /\[\s*'(\w+)'\s*,\s*'([^']+)'\s*\]/g; while((m = re.exec(blk[0]))) dyn[m[1]] = [P_WNW, '设置 · ' + m[2]]; }
    /* 有一页设置整个拆到别的文件、方法里只剩一句转发（Settings.type 就转给 w8-write 的 typeForm）：
       认下这层转发，转发到的那个函数里出来的字，出处也算「设置 · 那一页」 */
    let fm; const fre = /(?:async\s+)?(\w+)\s*\([^()]*\)\s*\{\s*return\s+(\w+)\s*\(\s*\)\s*;?\s*\}/g;
    while((fm = fre.exec(wn))) if(dyn[fm[1]] && !dyn[fm[2]]) dyn[fm[2]] = dyn[fm[1]];
  }
  return dyn;
}
function pageOf(rel, fn, dyn, packs){
  const P = packs || {};
  const f = rel.replace(/\\/g, '/');
  /* 那两本「函数名 → 设置里的某一页」只从 Flow-Desk / 为写 自己的源码里认：
     功能包里恰好也有个同名的方法（比如都叫 render），不能算到设置那一页头上。 */
  if(fn && /^src\/_(fd|wnw)\//.test(f) && dyn[fn]) return { prog:dyn[fn][0], page:dyn[fn][1] };
  if(f === 'src/pack/main.cjs') return { prog:P_MAIN, page:'窗口菜单与托盘' };
  if(f === 'src/pack/preload.cjs') return { prog:P_MAIN, page:'关窗询问框' };
  if(f === 'src/pack/zip-read.cjs') return { prog:P_MAIN, page:'插件导入报错' };
  /* 定期备份那一颗（外30 戊组）：它嘴里那几句最后都摆在 设置 · 数据 那一块和 toast 上，界面上看得见 */
  if(f === 'src/pack/backup.cjs') return { prog:P_MAIN, page:'定期备份' };
  /* 这一份是「改代码 / 恢复出厂 / 完全删除」那几步在主进程里的落盘手：
     它回的那几句全摆在卡片上那几个钮点开的面板上，界面上看得见，所以给它一页名字 */
  if(f === 'src/pack/comp-files.cjs') return { prog:P_FD, page:'功能卡 · 改代码与恢复出厂的提示' };
  let m = f.match(/^src\/_fd\/template\.html$/); if(m) return { prog:P_FD, page:'页面骨架' };
  m = f.match(/^src\/_wnw\/template\.html$/); if(m) return { prog:P_WNW, page:'页面骨架' };
  m = f.match(/^src\/_build\/rp-base\.html$/); if(m) return { prog:P_RP, page:'页面骨架' };
  m = f.match(/^src\/_fd\/src\/([^/]+)$/); if(m) return { prog:P_FD, page:FD_CN[m[1]] || m[1] };
  m = f.match(/^src\/_wnw\/src\/([^/]+)$/); if(m) return { prog:P_WNW, page:WNW_CN[m[1]] || m[1] };
  m = f.match(/^src\/_shared\/([^/]+)\.js$/); if(m) return { prog:P_SH, page:SH_CN[m[1]] || m[1] };
  /* 外39 组件定制分离：那四份搬进 src\_wcustom\src\，一页名字照旧吃上面那张 SH_CN（词库 / 生成器 / 配方向导 / 改代码），
     只是「哪个程序的哪一份文件」这一栏从「共用模块」换成「组件定制」。 */
  m = f.match(/^src\/_wcustom\/src\/([^/]+)\.js$/); if(m) return { prog:P_WC, page:SH_CN[m[1]] || m[1] };
  m = f.match(/^src\/_build\/(p\d)\.js$/); if(m) return { prog:P_RP, page:RP_CN[m[1] + '.js'] || m[1] };
  m = f.match(/^data\/plugins\/([^/]+)\//); if(m) return { prog:P_PACK, page:P[m[1]] || m[1] };
  m = f.match(/^data\/plugins\/([^/]+)\.js$/); if(m) return { prog:P_PACK, page:P[m[1]] || m[1] };
  /* 上面一张表都没认上的（新加的文件、还没起名字的那一类）：至少把「哪个程序的哪一份文件」说全，
     别再回一个光秃秃的「?」让人对着清单猜。文件名带的是相对路径里的最后那一段。 */
  const last = f.split('/').pop();
  m = f.match(/^src\/pack\//);   if(m) return { prog:P_MAIN, page:last };
  m = f.match(/^src\/_fd\//);    if(m) return { prog:P_FD,   page:last };
  m = f.match(/^src\/_wnw\//);   if(m) return { prog:P_WNW,  page:last };
  m = f.match(/^src\/_shared\//);if(m) return { prog:P_SH,   page:last };
  m = f.match(/^src\/_wcustom\//);if(m) return { prog:P_WC,  page:last };
  m = f.match(/^src\/_build\//); if(m) return { prog:P_RP,   page:last };
  return { prog:'别处', page:f };
}

/* ---------- 4. 扫一个 js 文件 ---------- */
function scanJs(rel, src, dyn, packs){
  const toks = tokenize(src);
  const map = fnMap(src);
  const stack = [];                       /* {type:'call'|'obj'|'arr', name, argi, key} */
  const consumed = new Set();             /* 拼接式里非最左的那几个字面量 */
  const rows = [];
  const isStr = t => t && (t.k === 'str' || t.k === 'tpl');
  /* 加号后面能接上的才算一段值：接不上就说明这条拼接式到此为止（'文件', '另一个参数' 不算连着的两句） */
  const exprStart = t => !!t && (isStr(t) || t.k === 'id' || t.k === '(' || t.k === '[');
  let prevId = '';
  /* 从第 idx 个字面量起，把 'a' + 变量 + 'b' 这条拼接式整个吃下来 */
  function plusChain(idx){
    let i = idx;
    /* 先退到链首：往前只有「字面量 +」「变量 +」「括号收尾 +」这三种接法 */
    while(i >= 2 && toks[i - 1] && toks[i - 1].k === '+' && exprStart(toks[i - 2])) i -= 2;
    const start = i;
    const pieces = [];
    let slot = 0;
    while(i < toks.length){
      const t = toks[i];
      if(isStr(t)){
        if(t.slots) return null;                     /* 模板串里带 ${…}：说不清哪一段是字，整条不要 */
        pieces.push({ off:t.start, len:t.end - t.start, q:t.q === '`' ? "'" : t.q, val:unesc(t.raw) });
        i++;
        if(toks[i] && toks[i].k === '+'){ i++; if(!exprStart(toks[i])) return { pieces, slots:slot, endIdx:i - 1, startIdx:start }; continue; }
        break;
      }
      /* 变量那一段：吃到下一个顶层的 + , : ; 或闭括号为止
         （那一句 ; 一定要有：'甲' + f(x) + '乙' 后面紧跟的是下一句代码，
           少了它，这一条拼接式会把往后整个文件都当成它的一个槽，后面的界面话一条都剩不下） */
      if(!exprStart(t)) break;
      let j = i, d = 0;
      while(j < toks.length){
        const x = toks[j];
        if(x.k === '(' || x.k === '{' || x.k === '[') d++;
        else if(x.k === ')' || x.k === '}' || x.k === ']'){ if(d === 0) break; d--; }
        else if(d === 0 && (x.k === '+' || x.k === ',' || x.k === ':' || x.k === ';')) break;
        j++;
      }
      if(j === i) break;
      slot++;
      pieces.push({ expr:true, slot });
      i = j;
      if(toks[i] && toks[i].k === '+'){ i++; continue; }
      break;
    }
    if(!pieces.length || pieces[0].expr || !pieces.some(p => !p.expr)) return null;
    return { pieces, slots:slot, endIdx:i, startIdx:start };
  }
  for(let i = 0; i < toks.length; i++){
    const t = toks[i];
    if(t.k === 'id'){ prevId = t.v; continue; }
    if(t.k === '('){ stack.push({ type:'call', name:prevId || '(匿名)', argi:0 }); prevId = ''; continue; }
    if(t.k === ')'){ stack.pop(); prevId = ''; continue; }
    if(t.k === '{'){ stack.push({ type:'obj', key:null }); prevId = ''; continue; }
    if(t.k === '}'){ stack.pop(); prevId = ''; continue; }
    if(t.k === '['){
      /* 紧跟在「名字 / 括号收尾 / 一句字」后面的方括号是取值（s['收获.收获类别']），不是数组底子；
         return、case 这些字后面的照旧算数组底子。
         只认「方括号里光秃秃就一句字」那一种：那是拿去查东西的键。方括号里是算出来的东西
         （out[起的名字 || '定义']），那句就是现拼出来的名字，界面上看得着，照收。 */
      const p = toks[i - 1];
      const oneLit = toks[i + 1] && toks[i + 1].k === 'str' && toks[i + 2] && toks[i + 2].k === ']';
      const idx = !!oneLit && !!p && (p.k === ')' || p.k === ']' || p.k === 'str' || (p.k === 'id' && !AFTER_RETURN.has(p.v)));
      stack.push({ type:'arr', idx }); prevId = ''; continue;
    }
    if(t.k === ']'){ stack.pop(); prevId = ''; continue; }
    if(t.k === ','){ if(stack.length) stack[stack.length - 1].argi = (stack[stack.length - 1].argi || 0) + 1; prevId = ''; continue; }
    if(t.k === ':'){ const f = stack[stack.length - 1]; if(f && f.type === 'obj') f.key = prevId; prevId = ''; continue; }
    if(!isStr(t)){ prevId = ''; continue; }
    if(consumed.has(i)) continue;
    const chain = plusChain(i);
    if(!chain || chain.startIdx !== i){ prevId = ''; continue; }
    /* 拼接式里其余的字面量记下来跳过；结构符照旧走一遍，栈不能乱 */
    for(let k = i + 1; k < chain.endIdx; k++) if(isStr(toks[k])) consumed.add(k);
    let text = '';
    for(const p of chain.pieces) text += p.expr ? '{' + p.slot + '}' : p.val;
    /* h('button', …) 的第一个参数是标签名：它自己没有汉字，走不到下面的收字那条，
       但它决定这一句摆在什么控件上，所以趁现在把它记在栈上这一级。 */
    {
      const fr = stack[stack.length - 1];
      if(fr && fr.type === 'call' && fr.argi === 0 && TAG_ARG_CALLS.has(fr.name) && !chain.slots && !fr.tag)
        fr.tag = /^([a-zA-Z][\w-]*)$/.test(text) ? text.toLowerCase() : '';
    }
    const bare = text.replace(/\{\d+\}/g, '');
    if(!text || !CN.test(bare) || MULTI.test(text) || text.length > TOO_LONG || NOT_UI.some(re => re.test(bare))){ prevId = ''; continue; }
    /* 上下文：属性名 / 调用名 */
    const f = stack[stack.length - 1];
    const key = f && f.type === 'obj' ? f.key : '';
    const call = f && f.type === 'call' ? f.name : '';
    /* 拿去词库查东西的地址不收：走读词库那几个动作传进去的、cat: / multi: 后面的、
       方括号里光秃秃只有一句字当键取值用的。这些名字的真身在词库里，界面上显示不出来；
       改词库它们跟着变，不该在清单里再留一份。 */
    if(stack.some(x => x.type === 'arr' && x.idx) || ADDR_KEYS.has(ownerKey(stack)) ||
      BANK_CALLS.has(ownerCall(stack)) || BANK_CALLS.has(call)){ prevId = ''; continue; }
    const inH = stack.some(x => x.type === 'call' && ['h','row','field','segCtrl','btn','note','line','menu','item','sub'].includes(x.name));
    let why = '';
    if(key && NOT_KEYS.has(key)) why = '';
    else if(key && DISPLAY_KEYS.has(key)) why = '属性 ' + key;
    else if(call && SKIP_CALLS.has(call)) why = '';
    else if(call && DISPLAY_CALLS.has(call)) why = '调用 ' + call;
    else if(inH) why = '在 h() 里面';
    else if(f && f.type === 'arr') why = '数组里的一项';
    /* 「见汉字就收」（2026-10-03 他拍的）：上面这几档都没认上的，只要带着汉字也一并收进清单，
       标一句「别处的一句」，他在改字工具里看得见、改得着。
       拦住不收的几类照旧：词库地址（cat: / multi: / 取字那几个调用 / 方括号里光秃秃当键取值）
       在上面一条就挡掉了；属性名落在 NOT_KEYS、函数落在 SKIP_CALLS 的也照旧不收 ——
       那是代码的骨头和查东西的地址，不是界面上给人看的字。 */
    else why = '别处的一句';
    if(!why){ prevId = ''; continue; }
    /* 比较用的常量不收：'x' === k、k === 'x'、case 'x': */
    const before = toks[i - 1], after = toks[chain.endIdx];
    if(before && before.k === 'id' && before.v === 'case') { prevId = ''; continue; }
    if(after && after.k === 'op' && ['===','!==','==','!='].includes(after.v)){ prevId = ''; continue; }
    if(before && before.k === 'op' && ['===','!==','==','!='].includes(before.v)){ prevId = ''; continue; }
    const fn = fnAt(map, t.line);
    const pg = pageOf(rel, fn, dyn, packs);
    /* 摆在什么上面：先认控件，再认列表里的一项；实在认不出就留空，那一行只说程序、页名和句子 */
    const pos = posOf(key, call, (f && f.type === 'call' && f.tag) || '', inH) ||
      (f && f.type === 'arr' && !f.idx ? '列表里的一项' : '');
    rows.push({ rel, prog:pg.prog, page:pg.page, fn, line:t.line, text, pos,
      pieces:chain.pieces.filter(p => !p.expr).map(p => ({ off:p.off, len:p.len, q:p.q })),
      slots:chain.pieces.filter(p => p.expr).length, why });
    prevId = '';
  }
  return rows;
}

/* ---------- 5. 扫静态 html：标签之间的字 + title / placeholder ---------- */
function scanHtml(rel, src, packs){
  const rows = [];
  const pg = pageOf(rel, '', {}, packs);
  /* 把 <script> <style> 的内容挖成同样长的空格：位置一个不动，正则就再也翻不进代码里 */
  const mask = src.split('');
  for(const tag of ['script', 'style']){
    const re = new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)</' + tag + '>', 'gi');
    let m;
    while((m = re.exec(src))){
      const a = m.index + m[0].indexOf('>') + 1, b = m.index + m[0].lastIndexOf('<');
      for(let k = a; k < b && k < mask.length; k++) if(mask[k] !== '\n') mask[k] = ' ';
    }
  }
  const flat = mask.join('');
  const push = (raw, off, kind) => {
    const t = String(raw).replace(/\s+/g, ' ').trim();
    if(!t || !CN.test(t) || t.length > TOO_LONG || NOT_UI.some(re => re.test(t))) return;
    /* 位置对准源码里真写着的那一段：前后空白不算，中间原样（长度按原样，不按收拢后的） */
    const lead = String(raw).length - String(raw).replace(/^\s+/, '').length;
    const real = String(raw).trim().length;
    /* 这一段字挂在哪个标签底下：往前找最近的那个开标签，标签名决定「摆在什么上面」 */
    const lt = flat.lastIndexOf('<', off);
    const tm = lt >= 0 ? /^\/?\s*([a-zA-Z][\w-]*)/.exec(flat.slice(lt + 1)) : null;
    const tag = tm ? tm[1].toLowerCase() : '';
    rows.push({ rel, prog:pg.prog, page:pg.page, fn:'', line:src.slice(0, off + lead).split('\n').length, text:t,
      pos:kind === 'attr' ? (/<\w+[^>]*\bplaceholder\s*=/i.test(flat.slice(lt, off + 20)) ? ATTR_POS.placeholder :
        /<\w+[^>]*\balt\s*=/i.test(flat.slice(lt, off + 20)) ? ATTR_POS.alt : ATTR_POS.title) :
        (TAG_POS[tag] || '页面上的一段话'),
      pieces:[{ off:off + lead, len:real, q:kind === 'attr' ? 'attr' : 'html' }], slots:0, why:'静态页面' });
  };
  let m;
  const reText = />([^<>]+)</g;
  while((m = reText.exec(flat))) push(m[1], m.index + 1, 'text');
  const reAttr = /\b(?:title|placeholder|aria-label)="([^"]*)"/g;
  while((m = reAttr.exec(flat))) push(m[1], m.index + m[0].indexOf('"') + 1, 'attr');
  /* ---------- 内嵌 <script> 里的那一层字（外42 三补的漏）----------
     上面把 <script> 挖成空格是给标签之间的字用的，那一挖把脚本里的话也一起埋了：
     声笔输入法练习那一页骨架的字全住在内嵌脚本里，清单上 204 处只收了 68 处。
     所以这一段再把每一块脚本单独交给 scanJs，回来的行列和偏移按整份文件平移 ——
     写回的时候吃的还是整份文件里的偏移，改得动。 */
  const reScript = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let sm;
  while((sm = reScript.exec(src))){
    const body = sm[1];
    if(!body || !CN.test(body)) continue;
    const start = sm.index + sm[0].indexOf('>') + 1;
    const 前面几行 = src.slice(0, start).split('\n').length - 1;
    for(const r of scanJs(rel, body, {}, packs)){
      r.line += 前面几行;
      for(const p of r.pieces) p.off += start;
      rows.push(r);
    }
  }
  return rows;
}

/* ---------- 6. 全树扫一遍 ---------- */
/* 页面骨架那三份里只扫还在用的两份：_wnw/template.html 随为写的独立页面一起退了
   （为写的骨架真身在 _wnw/src/w0-skin.js），搬去了 备份\2026-10-04-收口\，不再扫它。 */
const HTML_FILES = ['src/_fd/template.html', 'src/_build/rp-base.html'];
function treeOf(from){
  const env = process.env.FD_TREE;
  return path.resolve(env || path.resolve(from, '../..'));
}
/* 退休的源码不再扫。这个口子留着：以后再有"文件还在、字不该进清单"的，往这一行里加一个名字就行。
   （原先挂在这上头的 src/_shared/sh-phrase.js —— 旧「提示语」那一半 —— 外20 已经把文件本身删了：
   三棵源码树 44 份 .js 里唯一没被 build.mjs 点名的一份，产物里出现 0 次，git 里随时唤得回来。）
   uitext.cjs / cardsize.cjs 是这两份清单的生成器本身：它们嘴里念的是"清单怎么写的"说明文字，
   不是界面上的字，扫进去就成了清单里的脏行（出处那一栏还会是个问号）。 */
const SKIP_REL = new Set();
const SKIP_NAME = new Set(['uitext.cjs', 'cardsize.cjs', 'wnw-kernel.js', 'wnw-custom-kernel.js']);
/* 只认 .js / .cjs，不跟着收 .mjs —— 这是量过的，不是漏的：
   这六棵被扫的树里 .mjs 一共九份（src/_fd：build / fd-serve / grad-survey / look-check，
   src/pack：build-app / mirror / publish，src/_wnw 与 src/_wcustom 各一颗 build-kernel），全是敲命令行跑的构建脚本，
   嘴里念的是打包进度，界面上一个字都不显示；收进来就成了清单里的脏行（和 uitext.cjs 同一类）。
   src/tools/ 底下那些 .mjs 是自检台，压根不在这五棵树的射程里。
   哪天新增了往界面上说话的一份，给它在这一行加一个名或者在 pageOf 里加一页，别放开这个口子。 */
function listFiles(TREE){
  const out = [];
  const walk = dir => {
    let es = [];
    try{ es = fs.readdirSync(dir, { withFileTypes:true }); }catch(e){ return; }
    for(const e of es){
      const p = path.join(dir, e.name);
      if(e.isDirectory()){ if(['node_modules','images','userdata-fd','userdata-wnw','userdata-rp','logs','plugin','dist'].includes(e.name)) continue; walk(p); }
      else if(/\.(js|cjs)$/.test(e.name) && !/\.code\.js$/.test(e.name) && !SKIP_NAME.has(e.name)){
        const rel = path.relative(TREE, p).replace(/\\/g, '/');
        if(!SKIP_REL.has(rel)) out.push(rel);
      }
    }
  };
  for(const d of ['src/pack', 'src/_fd', 'src/_wnw', 'src/_shared', 'src/_wcustom', 'data/plugins']) walk(path.join(TREE, d));
  for(const f of ['src/_build/p1.js','src/_build/p2.js','src/_build/p3.js','src/_build/p4.js','src/_build/p5.js','src/_build/p6.js'])
    if(fs.existsSync(path.join(TREE, f))) out.push(f);
  for(const f of HTML_FILES) if(fs.existsSync(path.join(TREE, f))) out.push(f);
  return [...new Set(out)].sort();
}
function collectAll(TREE){
  const files = listFiles(TREE);
  const src = {};
  for(const rel of files){ try{ src[rel] = fs.readFileSync(path.join(TREE, rel), 'utf8'); }catch(e){ src[rel] = ''; } }
  const dyn = settingPages(src);
  const packs = packNames(TREE);
  let occ = [];
  for(const rel of files){
    if(/\.html$/.test(rel)){ occ = occ.concat(scanHtml(rel, src[rel], packs)); continue; }
    try{ occ = occ.concat(scanJs(rel, src[rel], dyn, packs)); }
    catch(e){ console.log('扫不动 ' + rel + '：' + e.message); }
  }
  return { files, src, occ };
}
/* 同一页里的同一句合成一行（界面上分不出这两处，写两个不同的字也没法分别显示） */
function groupsOf(occ){
  const g = new Map();
  for(const o of occ){
    const key = o.prog + '\u0000' + o.page + '\u0000' + o.text;
    if(!g.has(key)) g.set(key, { prog:o.prog, page:o.page, text:o.text, fn:o.fn, pos:o.pos || '', at:[] });
    g.get(key).at.push({ rel:o.rel, line:o.line, pieces:o.pieces, slots:o.slots, why:o.why, pos:o.pos || '' });
  }
  return [...g.values()].sort((a, b) => (a.prog + ' ' + a.page + ' ' + a.text).localeCompare(b.prog + ' ' + b.page + ' ' + b.text, 'zh'));
}

/* ---------- 7. 清单文本（YAML · 按页分组） ----------
   形状：
     Flow-Desk · 顶栏:
       添加插件: 加功能
       色卡:
   段首那一行是出处（哪个程序的哪一页），底下缩进两格一行一个地方：冒号左边是界面上
   原来那句话，冒号右边写你要的字。右边空着 = 不改。
   ----------
   为什么冒号两边敢直接写字不加点花样：界面上那些字里什么符号都有（冒号、井号、引号、花括号），
   所以写出去之前先过一道 plainOk —— 只有「绝不会让 YAML 认错」的那些才裸写，
   其余一律裹一双双引号（双引号里的写法就是 JSON 那套转义，任何 YAML 解析器都认）。
   读回来那一半同样两种都认，所以他在记事本里手打的裸句子照样进得去。
   ----------
   读的时候一行一行为政：认不动的那一行跳过，只坏那一行，其余照常生效。 */
/* 这一段文字能不能裸写在 YAML 里：带换行/制表、首尾带空格、以指示符开头、
   中间出现「冒号+空格」或「空格+井号」的都不行（那两个会把这一行劈成两截） */
function plainOk(s){
  const t = String(s);
  if(t === '' || /[\r\n\t]/.test(t)) return false;
  if(/^\s|\s$/.test(t)) return false;
  if(/^[-?:,[\]{}#&*!|>'"%@`]/.test(t)) return false;
  if(/:\s/.test(t) || /\s#/.test(t)) return false;
  return true;
}
function yq(s){ const t = String(s); return plainOk(t) ? t : JSON.stringify(t); }
/* 双引号那一种：JSON 的写法正好是 YAML 的双引号标量；单引号那种（他自己打的）也认 */
function yunq(s){
  const t = String(s);
  if(t[0] === '"'){ try{ const v = JSON.parse(t); return { val:typeof v === 'string' ? v : t, rest:'' }; }catch(e){ return { val:t, rest:'' }; } }
  if(t[0] === "'" && /'$/.test(t)) return { val:t.slice(1, -1).replace(/''/g, "'"), rest:'' };
  /* 裸写的值：YAML 的规矩是「空格 + #」往后算行内注释，读的时候照同一个办 */
  const c = t.search(/\s#/);
  return { val:(c < 0 ? t : t.slice(0, c)).trim(), rest:'' };
}
/* 一行里的「冒号分隔」：找第一个后面跟着空格（或到行尾）的冒号 —— 「00:02 开始」这种不算 */
function colonAt(line){
  for(let i = 0; i < line.length; i++){
    if(line[i] !== ':') continue;
    if(i + 1 >= line.length || line[i + 1] === ' ') return i;
  }
  return -1;
}
/* 「这句不要了」在清单里的写法：冒号右边就一对空引号 —— "" 或 ''。
   什么都不写（整行到冒号为止）是「不改」，写一对空引号才是「要它不显示」，这两个得分开认。 */
function isEmptyQuoted(s){
  const t = String(s || '').trim();
  return t === '""' || t === "''";
}
/* 拆开一行 key: value；不是这个形状的回 null。key 带引号的按引号里头尾算，不挨冒号 */
function kvOf(line){
  const s = String(line);
  if(s[0] === '"' || s[0] === "'"){
    let i = 1, esc = false;
    while(i < s.length){
      const c = s[i];
      if(esc) esc = false;
      else if(c === '\\' && s[0] === '"') esc = true;
      else if(c === s[0]){ if(s[0] === "'" && s[i + 1] === "'"){ i++; } else break; }
      i++;
    }
    if(i >= s.length) return null;
    const key = yunq(s.slice(0, i + 1)).val;
    let j = i + 1; while(j < s.length && s[j] === ' ') j++;
    if(s[j] !== ':') return null;
    const rest = s.slice(j + 1).trim();
    return { key, val:yunq(rest).val, del:isEmptyQuoted(rest) };
  }
  const k = colonAt(s);
  if(k < 0) return null;
  const rest = s.slice(k + 1).trim();
  return { key:yunq(s.slice(0, k).trim()).val, val:yunq(rest).val, del:isEmptyQuoted(rest) };
}
const HEAD = [
  '【界面文字清单】界面上那些字由你说了算',
  '  这是一份 YAML（YAML 就是"用缩进和冒号排版"的纯文本），记事本、Notepad++ 都能直接改；存盘请保持 UTF-8 编码。',
  '  一行一个地方：冒号左边是界面上原来那句话，冒号右边写你要的字。',
  '  每一段开头那一行写着「哪个程序 · 哪一页」，它底下缩进两格的都算这一页的；同一个字出现在不同页就是两段底下的两行，各换各的。',
  '  冒号右边什么都不写、或者把整行删掉，这一句就用程序原来的字。',
  '  不想让某一句显示：冒号右边写一对空引号 "" —— 界面上这一句就空着（改字工具里点「这句不要了」写出来的就是这个）。',
  '  改完存盘，界面上那一句立刻跟着变，不用重启。',
  '  字里的 {1} {2} 是程序运行时填进去的数字或名字；不想显示那个数，就把它删掉。',
  '  写坏一行只坏那一行：读不懂的那一行程序自己跳过，其余各行照常按这一份显示。',
  '  字里带冒号、井号、引号的那几句，外面会被程序裹上一双引号 —— 那是格式要裹的，改的时候连引号一起改就行。',
  '  改完想让它变成程序本来就有的一段代码：设置 → 数据 → 界面文字 里点「把改动写进程序」，先给你看改动清单，你确认才落笔。',
  '  写进程序之后，这一份里冒号左边跟着变成新的字，这时候把这一份删掉也不影响程序里的字。',
  '  这一份由程序在每次重新生成页面时刷新，你写在冒号右边的字不会丢。以 # 开头的行是说明，程序读的时候跳过。',
  '  万一某一句在当前源码里认不到了（功能卸了、或者原话改了名字），你给它写的改动不会被顺手清掉 —— 会被挪到这一份最末尾那几段底下，认回来之后再回到原来那一段。'
];
function one(s){ return String(s).replace(/[\r\n]+/g, ' '); }
/* 段内 key 的分隔符：NUL 不会出现在界面上的字里，拿来拼「程序+页+原句」最稳 */
const SEP0 = String.fromCharCode(0);
function render(groups, prevRows){
  const keep = new Map();
  for(const r of (prevRows || [])) keep.set(r.prog + '\u0000' + r.page + '\u0000' + r.from, { to:r.to, del:!!r.del });
  /* 按出处归段：段序和段内行序都跟 groups 进来时的排序一致 */
  const byTag = new Map();
  for(const g of groups){
    const k = g.prog + '\u0000' + g.page;
    if(!byTag.has(k)) byTag.set(k, []);
    byTag.get(k).push(g);
  }
  const lines = HEAD.map(s => '# ' + s), out = [];
  for(const [k, list] of byTag){
    const g0 = list[0];
    out.push('');
    out.push(yq(g0.prog + ' · ' + g0.page) + ':');
    for(const g of list){
      const from = one(g.text);
      const kept = keep.get(g.prog + '\u0000' + g.page + '\u0000' + g.text);
      const to = kept && !kept.del ? one(kept.to || '') : '';
      /* 「这句不要了」在清单里写成一对空引号：那是这一行唯一的记号，不能和「没改」混成同一个样子 */
      out.push('  ' + yq(from) + ':' + (kept && kept.del ? ' ""' : (to && to !== from ? ' ' + yq(to) : '')));
    }
  }
  /* 源码里暂时认不到那一句话的改动（功能卸了、或者那句原话改了名字）：
     单独附在最后一段，别让他写好的那一句跟着这次重写丢掉。运行时照旧读得懂（还是「程序 · 页名」+ 缩进行），
     源码里再出现同样这一句，下一次重写它就回到上面那一段里去。 */
  const have = new Set();
  for(const g of groups) have.add(g.prog + SEP0 + g.page + SEP0 + g.text);
  const orphans = [];
  for(const r of (prevRows || [])){
    if(!r.to && !r.del) continue;
    if(!r.from || have.has(r.prog + SEP0 + r.page + SEP0 + r.from)) continue;
    orphans.push(r);
  }
  if(orphans.length){
    const byOld = new Map();
    for(const r of orphans){
      const k = r.prog + SEP0 + r.page;
      if(!byOld.has(k)) byOld.set(k, []);
      byOld.get(k).push(r);
    }
    out.push('');
    out.push('# ↓↓↓ 下面这几句在当前源码里认不到了（功能卸了、或者原话改了名字）：你写的改动先留在这儿，' +
      '源码里再出现同样这一句，它就回到上面那一段。不想留就自己把这几行删掉。');
    for(const [k, list] of byOld){
      out.push('');
      out.push(yq(list[0].prog + ' · ' + list[0].page) + ':');
      for(const r of list){
        const from = one(r.from), to = one(r.to || '');
        out.push('  ' + yq(from) + ':' + (r.del ? ' ""' : (to && to !== from ? ' ' + yq(to) : '')));
      }
    }
  }
  return lines.join('\n') + '\n' + out.join('\n') + '\n';
}
/* 读清单：段首行认出处，缩进行认「原来的字 → 你写的字」；行首 # 和空行跳过 */
function parse(text){
  const rows = [];
  let cur = null;
  for(const raw of String(text || '').split(/\r?\n/)){
    const s = raw.trimEnd();
    if(!s.trim() || s.trimStart().startsWith('#')) continue;
    const ind = /^\s*/.exec(s)[0].replace(/\t/g, '  ').length;
    const kv = kvOf(s.trim());
    if(!kv) { if(ind === 0) cur = null; continue; }          /* 认不动的这一行跳过：段首行认不出就把后面挂空 */
    if(ind === 0){
      const i = kv.key.indexOf(' · ');
      cur = { prog:i < 0 ? kv.key : kv.key.slice(0, i).trim(), page:i < 0 ? '' : kv.key.slice(i + 3).trim(), src:kv.key };
      continue;
    }
    if(!cur) continue;
    const from = kv.key, to = kv.val && kv.val !== from ? kv.val : '';
    rows.push({ prog:cur.prog, page:cur.page, src:cur.src, from, to, del:!!kv.del });
  }
  return rows;
}

/* ---------- 8. 写回源码 ---------- */
/* edits = [{prog,page,from,to}]：先按当前源码定位，再改。
   plan()  只出改动清单（哪句改成哪句、在源码哪几处），一个字都不写
   apply() 真写 */
function plan(TREE, edits){
  const { occ } = collectAll(TREE);
  const g = groupsOf(occ);
  const list = [], miss = [];
  for(const e of edits){
    /* del = 「这句不要了」：这一句在界面上不显示，写进程序就是把它那句字面量掏空 */
    const del = !!e.del;
    const to = del ? '' : String(e.to || '').trim();
    if((!to && !del) || to === e.from) continue;
    const hit = g.find(x => x.prog === e.prog && x.page === e.page && x.text === e.from);
    if(!hit){ miss.push({ prog:e.prog, page:e.page, from:e.from, to, del }); continue; }
    list.push({ prog:hit.prog, page:hit.page, from:hit.text, to, del, at:hit.at.map(a => a.rel + ':' + a.line) });
  }
  return { list, miss };
}
/* 新句子按槽序拆回原来那几段字面量：'一共 {1} 项' → ['一共 ', ' 项'] */
function splitTemplate(text, n){
  const bits = String(text).split(/\{(\d+)\}/);
  const out = [];
  for(let i = 0; i < bits.length; i += 2) out.push(bits[i]);
  while(out.length < n) out.push('');
  /* 原句以槽结尾（'…：' + 一段 + 又一段）的时候，用户写在最后那几个字会落到第 n+1 段上，
     照老写法 slice 一刀就丢了 —— 点「把改动写进程序」一个字都没改，比改错更难受。
     源码里只有 n 段字面量可写，所以把多出来的那几段并到最后一份里（中间那些槽是代码，不照抄字面）。 */
  if(out.length > n) out[n - 1] = out.slice(n - 1).join('');
  return out.slice(0, n);
}
function apply(TREE, edits){
  const p = plan(TREE, edits);
  const { occ } = collectAll(TREE);
  const groups = groupsOf(occ);
  const patch = new Map();
  const done = [];
  for(const e of p.list){
    const hit = groups.find(x => x.prog === e.prog && x.page === e.page && x.text === e.from);
    if(!hit) continue;
    for(const a of hit.at){
      const vals = splitTemplate(e.to, a.pieces.length);
      a.pieces.forEach((pc, k) => {
        if(!patch.has(a.rel)) patch.set(a.rel, []);
        const esc = resc(vals[k] === undefined ? '' : vals[k], pc.q);
        /* 位置（off/len）吃的是一段带引号的字面量，写回去就得把引号重新裹上；
           静态 html 里标签之间和属性里的字（q 是 html/attr）本来没引号，不裹。 */
        const wrap = /["'`]/.test(pc.q);
        patch.get(a.rel).push({ off:pc.off, len:pc.len, text: wrap ? pc.q + esc + pc.q : esc });
      });
    }
    done.push({ prog:e.prog, page:e.page, from:e.from, to:e.to, del:!!e.del, at:hit.at.map(a => a.rel + ':' + a.line) });
  }
  const files = [];
  for(const [rel, spans] of patch){
    let text = fs.readFileSync(path.join(TREE, rel), 'utf8');
    spans.sort((x, y) => y.off - x.off);
    for(const s of spans){
      const head = text.slice(s.off, s.off + s.len);
      if(/^\s/.test(head) && !/^\s/.test(s.text)) { }
      text = text.slice(0, s.off) + s.text + text.slice(s.off + s.len);
    }
    fs.writeFileSync(path.join(TREE, rel), text);
    files.push(rel);
  }
  return { done, files, miss:p.miss };
}
/* 静态 html 里标签之间的字：写回时把原来那一段（含前后空白）整段换掉 */

/* ---------- 9. 刷新清单文件 ---------- */
function uiTextPath(TREE){ return path.join(TREE, 'data', 'ui-text.yaml'); }
function refresh(TREE){
  const file = uiTextPath(TREE);
  let prev = [];
  try{ prev = parse(fs.readFileSync(file, 'utf8')); }catch(e){}
  const { occ } = collectAll(TREE);
  /* 老 txt 那份按 " = " 分栏，字里带 " = " 的句子进不了清单；换成 YAML 之后没这道坎了，
     每一句都写得出（真要带冒号井号就裹双引号）。扫到的全数进清单。 */
  const groups = groupsOf(occ);
  fs.mkdirSync(path.dirname(file), { recursive:true });
  fs.writeFileSync(file, render(groups, prev));
  return { file, rows:groups.length, occ:occ.length };
}

/* ---------- 10. 旧「提示语」覆盖表搬进清单 ----------
   phrases.json 里是 { 原句: 改后的句子 }（FD 那份明文文件；WNW 那份由页面读回来再交过来）。
   一句原句可能在清单里好几段底下各有一行：哪一行的冒号右边还空着就填上，填过的不动。
   这是搬家不是改规矩：搬完清单照旧，phrases.json 原件一个字没动、也没删。 */
function adoptPhrases(text, map){
  let n = 0;
  let cur = null;
  const out = String(text || '').split(/\r?\n/).map(line => {
    const s = line.trimEnd();
    if(!s.trim() || s.trimStart().startsWith('#')) return line;
    const ind = /^\s*/.exec(s)[0].replace(/\t/g, '  ').length;
    const kv = kvOf(s.trim());
    if(!kv){ if(ind === 0) cur = null; return line; }
    if(ind === 0){ cur = { prog:kv.key, from:'', to:'' }; const i = kv.key.indexOf(' · ');
      if(i >= 0) cur.prog = kv.key.slice(0, i).trim(); return line; }
    if(!cur || kv.val || kv.del) return line;                          /* 只填还空着的那一行；「这句不要了」的不动 */
    if(!/^(Flow-Desk|Why Not Write|Rime Practice|Flow-Desk 主进程|共用模块|功能包)/.test(cur.prog)) return line;
    const v = map ? map[kv.key] : '';
    if(typeof v !== 'string') return line;
    const to = one(v).trim();
    if(!to || to === kv.key) return line;
    n++;
    return '  ' + yq(kv.key) + ':' + ' ' + yq(to);
  });
  return { text:out.join('\n'), adopted:n };
}

module.exports = { collectAll, groupsOf, render, parse, plan, apply, refresh, adoptPhrases, tokenize, scanJs, scanHtml,
  listFiles, pageOf, settingPages, packNames, uiTextPath, unesc, resc, splitTemplate, fnMap, fnAt,
  yq, kvOf, plainOk,
  P_FD, P_WNW, P_RP, P_MAIN, P_SH, P_PACK, TREE:treeOf(__dirname) };

if(require.main === module){
  const TREE = treeOf(__dirname);
  const mode = process.argv[2];
  const { files, occ } = collectAll(TREE);
  const gs = groupsOf(occ);
  if(mode === 'stats'){
    const byProg = new Map(), byPage = new Map();
    for(const g of gs){
      byProg.set(g.prog, (byProg.get(g.prog) || 0) + 1);
      const k = g.prog + ' · ' + g.page;
      byPage.set(k, (byPage.get(k) || 0) + 1);
    }
    console.log('扫过文件 ' + files.length + ' 个 · 每一处算一条 ' + occ.length + ' 处 · 合并成清单 ' + gs.length + ' 行');
    console.log('按程序：');
    [...byProg.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('  ' + String(v).padStart(5) + '  ' + k));
    console.log('按出处（哪一页几行）：');
    [...byPage.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh')).forEach(([k, v]) => console.log('  ' + String(v).padStart(5) + '  ' + k));
  } else if(mode === 'dump'){
    console.log(render(gs, []));
  } else {
    const r = refresh(TREE);
    console.log('WROTE ' + r.file + '  清单 ' + r.rows + ' 行（扫到 ' + r.occ + ' 处）');
  }
}
