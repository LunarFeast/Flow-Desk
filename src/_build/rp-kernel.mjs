/* ============================================================
   声笔输入法练习内核：把独立那一页剥成 Flow-Desk 页面里的一层闭包（#343 G4）
   ------------------------------------------------------------
   从前这一家是三块拼出来的：rp-base.html 出封面和样式，p1..p6 出代码，另有一份装配脚本
   把它们灌成一张独立的 html，Flow-Desk 再用 iframe 把那张页嵌进来。两条路各一套配色、各一套字体，
   外观层还得隔着窗口递 —— 为写那边已经整段搬进宿主页面跑通了（#350），这一家照同一个形状搬。
   独立页面和那份装配脚本一起退了，现在只剩这一层闭包。
   搬进来要解决三件事，这一份文件只管这三件事，不管业务：
   1 名字会撞：这一家的 CSS 写的是 html / body / :root / *，直接拼进宿主就把整个 Flow-Desk 窗口的版式改了。
     所以每一段 CSS 落纸之前都要过一道 rpScopeCss，把那一层选择器改挂在 .rp-root 这一格容器上，
     字号那一路 rem 也改成对容器的 --rp-fs 取，才对得上「这一格自己的字号」。
   2 摸的是整张页：这一家的代码拿 document.documentElement 当根、往 document.head 塞样式表、
     在 window 上挂监听、量 innerWidth 算缩放。所以递给它的 document 是一层影子，
     根元素 / body / head 都回这一格容器，id 和选择器只在容器里找，
     挂上来的监听和闹钟全部记账，拆的时候一并摘干净。
   3 它是自己开机的：装配那一份灌完 <script> 就直接跑，搬进来之后得等有人递容器才跑，
     所以整段包成 rpBoot(RP)，入口出口挂在窗口上（见文件尾 RP_KERNEL）。
   搬的这一趟行为一比特都不改：出题、取码、跟打、落盘那些代码一个字没动，只是换了个地方跑。
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';

const HERE = import.meta.dirname;
/* 六份代码的相对次序沿用从前那份装配脚本，不重排：p1 立数据层、p2 读盘、
   p3/p4 取码与出题、p5 排版与统计、p6 外壳接线，后面的要认前面那些名字 */
const RP_PARTS = ['p1.js', 'p2.js', 'p3.js', 'p4.js', 'p5.js', 'p6.js'];
/* 这一家的版本号不再自己抄一份：独立那一页早就归了宿主（#349），它现在和宿主同一条命 ——
   号由调用方（_fd/build.mjs）从 src\_build\version.mjs 那一格取来传进 rpKernelSource({version})，
   从前写在文件名上的 1.0.0-dev-1.0.6 就是这一串的前身。 */

/* ---------- 名字对不上就停下：别拿一份改坏了的底座往下拼 ---------- */
function fail(msg){
  console.error('RP 内核拼装失败：' + msg);
  process.exit(1);
}
function mustReplace(src, from, to, want, what){
  const hit = src.split(from).length - 1;
  if(hit !== want) fail(what + '：期望命中 ' + want + ' 处，实际 ' + hit + ' 处 —— 那一份源码改了，这一处的对应要跟着改');
  return src.split(from).join(to);
}

/* ============================================================
   rpScopeCss —— 把「整张页」那一层选择器改挂在容器上
   ------------------------------------------------------------
   构建期用它处理 rp-base.html 里那一段底样式，运行时用它处理这一家自己注入的那几张样式表
   （#recBtnStyle / #midColStyle）。两边必须同一把尺，
   所以交进闭包的是这一份函数的原身（见下面 closure 里的 .toString()），不另写第二份。
   三条口径：
   · :root / html / body  →  .rp-root（这一格容器就是它的「页面」）
   · *                    →  .rp-root, .rp-root *
   · 其余每条逗号段前面挂一段 .rp-root
   每一条前面都正好多一个类，规则之间的相对高低不动：原来 .col 赢得过 *，改完还赢得过。
   @font-face 那一段原样留着 —— 字体脸是全页共享的一份，648KB 那一份霞鹜文楷不该按容器复制好几份。
   ============================================================ */
function rpScopeCss(css, root){
  root = root || '.rp-root';
  /* :root 那一格里只有这几条归这一家自己：粗细、分隔线。
     色号那一串（--page-bg / --card-bg / --text / --accent …）不收：2026-10-08 起这一家不再自己画配色，
     整格跟着宿主吃 —— 宿主把同一批名字钉在真根元素上，容器继承得到，这一格再声明一份就把它们顶掉了。
     圆角两条（--radius / --r-card）同样不收，也是同一个理由：宿主钉的是卡片一档、控件一档。 */
  var KEEP = { '--bw':1, '--hair-w':1, '--hair-color':1, '--hair':1 };

  function splitTop(str, sep){
    var out = [], buf = '', i = 0, n = str.length, pa = 0, br = 0, q = '';
    while(i < n){
      var c = str.charAt(i);
      if(!q && c === '/' && str.charAt(i + 1) === '*'){
        var e = str.indexOf('*/', i + 2); e = e < 0 ? n : e + 2;
        buf += str.slice(i, e); i = e; continue;
      }
      if(q){
        if(c === '\\'){ buf += c + str.charAt(i + 1); i += 2; continue; }
        if(c === q) q = '';
        buf += c; i++; continue;
      }
      if(c === '"' || c === "'"){ q = c; buf += c; i++; continue; }
      if(c === '(') pa++;
      else if(c === ')') pa--;
      else if(c === '{') br++;
      else if(c === '}') br--;
      if(c === sep && pa === 0 && br === 0){ out.push(buf); buf = ''; i++; continue; }
      buf += c; i++;
    }
    out.push(buf);
    return out;
  }
  function bare(s){ return s.replace(/\/\*[\s\S]*?\*\//g, '').trim(); }
  /* 声明里那第一个冒号：括号里、引号里、注释里的不算 ——
     --hair:var(--hair-w) solid var(--hair-color) 认的是最前面那一个，
     background:color-mix(in srgb,var(--bad) 12%,var(--face-solid)) 同理。 */
  function colonAt(d){
    var i = 0, n = d.length, pa = 0, q = '';
    while(i < n){
      var c = d.charAt(i);
      if(!q && c === '/' && d.charAt(i + 1) === '*'){ var e = d.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
      if(q){ if(c === '\\'){ i += 2; continue; } if(c === q) q = ''; i++; continue; }
      if(c === '"' || c === "'"){ q = c; i++; continue; }
      if(c === '(') pa++;
      else if(c === ')') pa--;
      else if(c === ':' && pa === 0) return i;
      i++;
    }
    return -1;
  }
  function value(x){
    return x
      /* rem 原本对着整张页的根字号；搬进来之后要对这一格容器自己的字号 */
      .replace(/(-?\d*\.?\d+)rem\b/g, function(m, n){ return 'calc(' + n + ' * var(--rp-fs,14px))'; })
      /* 视口高度这一格没有：那一格多高就是多高 */
      .replace(/(-?\d*\.?\d+)vh\b/g, function(m, n){ return n + '%'; });
  }
  function selOf(part){
    var p = bare(part);
    if(!p) return null;
    if(p === ':root' || p === 'html' || p === 'body') return { sel: root, tag: p };
    var m = p.match(/^(:root|html|body)(?![\w-])([\s\S]*)$/);
    if(m){
      var rest = m[2].trim();
      return { sel: rest ? root + ' ' + rest : root, tag: m[1] };
    }
    if(p === '*') return { sel: root + ', ' + root + ' *', tag: '*' };
    return { sel: root + ' ' + p, tag: '' };
  }
  function declText(body, tag){
    var keptRoot = tag === ':root', isRootBox = tag === 'html' || tag === 'body';
    var out = [];
    splitTop(body, ';').forEach(function(d){
      if(!bare(d)){ if(d.trim()) out.push(d); return; }   /* 单独成行的一条注释原样留着 */
      var ci = colonAt(d);
      if(ci < 0) return;                                  /* 没有冒号就不是条声明，丢掉 */
      var name = bare(d.slice(0, ci));
      if(!name) return;
      if(keptRoot && !KEEP[name]) return;
      var val = d.slice(ci + 1);                          /* 冒号之后的原身，含前后注释和空白 */
      if(isRootBox && name === 'font-size')
        out.push('  --rp-fs:' + value(val).trim() + ';\n  font-size:var(--rp-fs)');
      else
        out.push(d.slice(0, ci + 1) + value(val));        /* 只在值那一段做替换，前面的注释原样留着 */
    });
    return out.join(';');
  }
  function rule(prelude, body){
    var sels = [], tag = '';
    splitTop(prelude, ',').forEach(function(part){
      var s = selOf(part);
      if(!s) return;
      sels.push(s.sel);
      if(!tag) tag = s.tag;
    });
    if(!sels.length) return '';
    return '\n' + sels.join(',\n') + '{\n' + declText(body, tag) + '\n}';
  }
  function matchBlock(t, o){
    var i = o + 1, n = t.length, d = 1;
    while(i < n){
      var c = t.charAt(i);
      if(c === '/' && t.charAt(i + 1) === '*'){ var e = t.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
      if(c === '{') d++;
      else if(c === '}'){ d--; if(!d) return i + 1; }
      i++;
    }
    return n;
  }
  function walk(text){
    var out = '', i = 0, n = text.length;
    while(i < n){
      if(text.charAt(i) === '/' && text.charAt(i + 1) === '*'){
        var e = text.indexOf('*/', i + 2); e = e < 0 ? n : e + 2;
        out += text.slice(i, e); i = e; continue;
      }
      var k = i, stop = '';
      while(k < n){
        var c = text.charAt(k);
        if(c === '/' && text.charAt(k + 1) === '*'){ var q = text.indexOf('*/', k + 2); k = q < 0 ? n : q + 2; continue; }
        if(c === '{'){ stop = '{'; break; }
        if(c === ';'){ stop = ';'; break; }
        k++;
      }
      if(k >= n){ out += text.slice(i); break; }
      if(stop === ';'){ out += text.slice(i, k + 1); i = k + 1; continue; }
      var prelude = text.slice(i, k), end = matchBlock(text, k), inner = text.slice(k + 1, end - 1);
      var head = bare(prelude);
      if(head.charAt(0) === '@'){
        /* 条件那一层往里的规则还要再走一遍这道尺；字体脸和关键帧原样交回 */
        out += /^@(media|supports|layer|container)\b/.test(head) ? prelude + '{' + walk(inner) + '}' : prelude + '{' + inner + '}';
      } else out += rule(prelude, inner);
      i = end;
    }
    return out;
  }
  return walk(String(css || ''));
}

/* ---------- 底座那一份：拆出底样式和封面骨架 ---------- */
function splitBase(file){
  if(!fs.existsSync(file)) fail('底座找不到：' + file);
  const s = fs.readFileSync(file, 'utf8');
  const styleOpen = s.indexOf('<style');
  const styleClose = s.indexOf('</style>');
  const bodyOpen = /<body[^>]*>/.exec(s);
  const scriptAt = s.indexOf('<script', bodyOpen ? bodyOpen.index : 0);
  if(styleOpen < 0 || styleClose < 0) fail('底座里没有 <style> 那一段：' + file);
  if(!bodyOpen || scriptAt < 0) fail('底座里没有 <body>…<script> 那一段：' + file);
  return {
    css: s.slice(s.indexOf('>', styleOpen) + 1, styleClose),
    html: s.slice(bodyOpen.index + bodyOpen[0].length, scriptAt)
  };
}

/* ---------- 六份代码：只动两处，其余一个字不改 ----------
   每一处都带命中数：那一侧源码改了却没同步这里，拼出来的闭包会少一条接线，
   那种错在页面上只表现为「配色不动」，查起来费时，所以在这里当场停下。
   从前这里还钉着三处补丁，是把「向父窗口要一份配色、向父窗口要一张纹理图」那两句改写成本地直读；
   独立那一页退了，那两句在源码里已经直接写成本地直读，补丁跟着撤。 */
function rpScripts(dir, charfreqLine){
  const js = RP_PARTS.map(p => fs.readFileSync(path.join(dir, p), 'utf8')).join('\n');
  let out = js;
  /* 1 缩放那一条从前量的是窗口，现在量的是这一格容器：封面几乎占满窗口，口径和从前一样 */
  out = mustReplace(out, 'innerWidth/1560,innerHeight/900', 'RP.w()/1560,RP.h()/900', 1, '第 1 处 量窗口那一句');
  /* 2 字频表：装配那一份是从底座第 447 行拿的，这里同样只拿那一条 */
  out = mustReplace(out, '/*__CHARFREQ__*/', charfreqLine, 1, '第 2 处 字频表那一格');
  return out;
}

/* 容器身上那两条不归那把尺管，是给「这一格」本身定规矩的，所以排在底样式之前：
   --rp-fs 先给一个兜底，底样式和后面注入那几条同一条选择器写在它之后，正常盖得住它；
   加载板子那一张写的是 position:fixed（从前它盖的就是整张页），搬进来之后要收在这一格里，
   不然一点开练习，Flow-Desk 整扇窗口先被一块「正在加载」盖住。 */
const RP_ADAPTER = [
  '.rp-root{position:relative;min-height:0;',
  '  --rp-fs:calc(var(--base-fs,14px) * var(--vsc,1));}',
  '.rp-root [style*="position:fixed"]{position:absolute !important;}'
].join('\n');

/* ---------- 交出去的那一段闭包 ---------- */
export function rpKernelSource(opt){
  const o = opt || {};
  if(!o.version) fail('没把版本号传进来：这一串归 src\\_build\\version.mjs 那一格，调用方取好再传，这里不留第二份字面量');
  const dir = o.dir || HERE;
  const base = o.base || path.join(dir, 'rp-base.html');
  const src = fs.readFileSync(base, 'utf8').split(/\r?\n/);
  const charfreqLine = src.find(l => /^const CHARFREQ_RAW=/.test(l));
  if(!charfreqLine) fail('底座里没有 CHARFREQ_RAW 那一行：' + base);

  const { css, html } = splitBase(base);
  const RP_CSS = RP_ADAPTER + '\n' + rpScopeCss(css);
  const RP_JS = rpScripts(dir, charfreqLine);

  const closure = [
    '/* 声笔输入法练习内核：整段包一层闭包拼进宿主这一张页（见 _build/rp-kernel.mjs 的说明）。',
    '   往外读宿主那一层的名字只剩 Txt 一个（界面文字清单）；色号、圆角、字体、字号一律不再读、不再钉，',
    '   容器继承宿主钉在真根元素上的那一批就够（2026-10-08「取消独立外观、独立字体设置」）。',
    '   交出去的只有窗口上那一份 RP_KERNEL。 */',
    '(function(){',
    "const RP_VERSION = " + JSON.stringify(o.version) + ';',
    'const RP_ROOT = \'.rp-root\';',
    '/* 底样式（已经过那把尺）和封面骨架：骨架里那六个段头是这一家自己的，不动它 */',
    'const RP_CSS = ' + JSON.stringify(RP_CSS) + ';',
    'const RP_HTML = ' + JSON.stringify(html) + ';',
    /* 那把尺的原身：运行时这一家自己注入的样式表全部从这里过 */
    'const rpScopeCss = ' + rpScopeCss.toString() + ';',
    'let RP_HOST = null, RP_BAG = null, rpTxtPrev = null;',
    '/* 界面文字清单是全页共用的那一份底子，认的是「这一段字属于哪个程序」：',
    '   接上去之前先记下宿主那一份，拆的时候原样还回去。',
    '   这里不重画整张页 —— 清单换了要重画是宿主那一趟的事，这一格新长出来的字由已经开着的观察器补。 */',
    'function rpBindText(){',
    '  rpTxtPrev = { prog:Txt.prog, host:Txt.host };',
    "  Txt.use(Object.assign({}, Txt.host, { prog:'声笔输入法练习' }));",
    '}',
    'function rpUnbindText(){',
    '  if(!rpTxtPrev) return;',
    '  Txt.use(rpTxtPrev); rpTxtPrev = null;',
    '}',
    '/* 这一家往 head 塞样式表时改的那两条（记录按钮、中栏布局）都要过那把尺；',
    '   控件圆角那一条和动态字体那两条 2026-10-08 跟着独立外观、独立字体一起撤了；',
    '   @font-face 那一条在里面原样通过，字体脸全页只留一份 */',
    'const rpNodeText = Object.getOwnPropertyDescriptor(Node.prototype, \'textContent\');',
    'const rpElInner = Object.getOwnPropertyDescriptor(Element.prototype, \'innerHTML\');',
    'function rpScopedStyle(el){',
    '  if(!el || el.tagName !== \'STYLE\') return el;',
    '  const put = txt => rpNodeText.set.call(el, rpScopeCss(String(txt), RP_ROOT));',
    '  Object.defineProperty(el, \'textContent\', { get(){ return rpNodeText.get.call(el); }, set:put, configurable:true });',
    '  Object.defineProperty(el, \'innerHTML\', { get(){ return rpElInner.get.call(el); }, set:put, configurable:true });',
    '  return el;',
    '}',
    '/* 递给这一家的影子：根元素、body、head 都回这一格容器，id 和选择器只在容器里找。',
    '   没点名的那些（createTextNode、fonts、activeElement…）交回真 document，',
    '   函数一律 bind 过再交：原生方法拿这层影子当 this 调会直接报错。',
    '   title 那一格吞掉：这一家开机末尾要把窗口标题写成「某某方案打字练习」，',
    '   搬进来之后那是整扇 Flow-Desk 窗口的标题，不归它管。 */',
    'function rpBag(host){',
    '  const real = document, bag = { winL:[], docL:[], timers:new Set(), ints:new Set() };',
    '  bag.w = () => host.clientWidth || real.documentElement.clientWidth;',
    '  bag.h = () => host.clientHeight || real.documentElement.clientHeight;',
    '  bag.doc = new Proxy(real, {',
    '    get(t, k){',
    '      if(k === \'documentElement\' || k === \'body\' || k === \'head\') return host;',
    '      if(k === \'title\') return \'\';',
    '      if(k === \'createElement\') return tag => rpScopedStyle(real.createElement(tag));',
    '      if(k === \'getElementById\') return id => host.querySelector(\'[id="\' + id + \'"]\');',
    '      if(k === \'querySelector\') return s => host.querySelector(s);',
    '      if(k === \'querySelectorAll\') return s => host.querySelectorAll(s);',
    '      if(k === \'contains\') return n => host.contains(n);',
    '      if(k === \'addEventListener\') return (type, fn, o) => { bag.docL.push([type, fn, o]); real.addEventListener(type, fn, o); };',
    '      if(k === \'removeEventListener\') return (type, fn, o) => real.removeEventListener(type, fn, o);',
    '      const v = t[k];',
    '      return typeof v === \'function\' ? v.bind(t) : v;',
    '    },',
    '    set(t, k, v){ if(k === \'title\') return true; t[k] = v; return true; }',
    '  });',
    '  return bag;',
    '}',
    'function rpBoot(RP){',
    'const document = RP.doc;',
    '/* 这几条从前落在「这一页」上，如今页是共用的一张：挂在窗口上的要记账，拆的时候才摘得干净；',
    '   量出来的 id 也要收，那条一秒一次的统计刷新不收就会在练习关掉之后继续跑。',
    '   真身一律走 window. 那一句，不然是自己调自己。 */',
    'function addEventListener(type, fn, o){ RP.winL.push([type, fn, o]); window.addEventListener(type, fn, o); }',
    'function setTimeout(fn, ms){ const id = window.setTimeout(fn, ms); RP.timers.add(id); return id; }',
    'function clearTimeout(id){ RP.timers.delete(id); window.clearTimeout(id); }',
    'function setInterval(fn, ms){ const id = window.setInterval(fn, ms); RP.ints.add(id); return id; }',
    'function clearInterval(id){ RP.ints.delete(id); window.clearInterval(id); }',
    RP_JS,
    '}',
    '/* 开：收一个容器，把骨架摆进去、底样式挂上，再让这一家自己跑它的开机那一段。',
    '   已经开着就先把旧的拆干净（连着按两下不能叠两份监听）。 */',
    'function rpStart(host){',
    '  if(!host || !host.appendChild) throw new Error(\'要给声笔输入法练习一个能装东西的容器\');',
    '  if(RP_HOST) rpStop();',
    '  host.classList.add(\'rp-root\');',
    '  host.innerHTML = RP_HTML;',
    '  const st = document.createElement(\'style\');',
    '  st.id = \'rp-scope\'; st.textContent = RP_CSS;',
    '  host.appendChild(st);',
    '  const bag = rpBag(host);',
    '  RP_HOST = host; RP_BAG = bag;',
    '  rpBindText();',
    '  rpBoot(bag);',
    '  return RP_KERNEL;',
    '}',
    '/* 拆：挂在窗口和真 document 上的监听逐个摘，闹钟逐个清，清单那条接线还回宿主，',
    '   最后把这一格拆空、标记抹掉。样式表跟着容器一起走，不会在宿主页面里留下第二张皮。 */',
    'function rpStop(){',
    '  const host = RP_HOST, bag = RP_BAG;',
    '  if(!host) return;',
    '  RP_HOST = null; RP_BAG = null;',
    '  for(const it of bag.winL){ try{ window.removeEventListener(it[0], it[1], it[2]); }catch(e){} }',
    '  for(const it of bag.docL){ try{ document.removeEventListener(it[0], it[1], it[2]); }catch(e){} }',
    '  bag.timers.forEach(id => window.clearTimeout(id));',
    '  bag.ints.forEach(id => window.clearInterval(id));',
    '  rpUnbindText();',
    '  host.innerHTML = \'\';',
    '  host.classList.remove(\'rp-root\');',
    '}',
    'const RP_KERNEL = {',
    '  start: host => rpStart(host),',
    '  stop: () => rpStop(),',
    '  running: () => !!RP_HOST,',
    '  version: RP_VERSION',
    '};',
    'window.RP_KERNEL = RP_KERNEL;',
    '})();'
  ].join('\n');

  return closure;
}
