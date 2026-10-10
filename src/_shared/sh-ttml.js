/* 歌词 TTML 解析：共用的一份（外19 词格）
   这一棵是从 data\plugins\music-remote\main.js 里整段搬出来的，搬的时候只改了函数名（mus* → shTtml*），
   写法、注释、判断顺序一个字没动 —— 音乐遥控器和为写的词格模式读同一把尺，不各存一份。
   为什么要有这一份：插件是运行时现 import 的 ES module，它的顶层名字外头拿不到；
   词格要读逐字时值，就得有一份两边都够得着的。组件那头由加载器随 ctx 发下来
   （见 _shared/sh-load.js 里 shSplit 那一节，同一个待遇），为写这一头直接调顶层名字。
   管的事：一行 = 一个 <p>（带 begin/end），一格 = 一个 <span>（逐字），
   注音 / 翻译 / 罗马音 / 和声各归各的 role，缺 begin 接前一段结尾、缺 end 接后一段开头，
   行尾接到「下一个时刻」而不是「下一条」。 */

function shTtmlMs(raw){
  const s = String(raw == null ? '' : raw).trim();
  if(!s) return NaN;
  if(/^\d*\.?\d+$/.test(s)) return Math.round(parseFloat(s) * 1000);
  const p = s.split(':');
  if(p.length < 2 || p.length > 3) return NaN;
  let ms = 0;
  for(let i = 0; i < p.length; i++){
    const v = parseFloat(p[i]);
    if(!isFinite(v)) return NaN;
    ms += v * Math.pow(60, p.length - 1 - i) * 1000;
  }
  return Math.round(ms);
}
/* 逐字段补齐时间：缺 begin 接前一段的结尾，缺 end 接后一段的开头，末段接到行尾 */
function shTtmlFlow(segs, lineMs, lineMs2){
  let prev = lineMs;
  for(const s of segs){
    if(!isFinite(s.ms)) s.ms = prev;
    prev = s.ms;
  }
  let next = lineMs2;
  for(let i = segs.length - 1; i >= 0; i--){
    const s = segs[i];
    s.ms2 = isFinite(s.ms2) && s.ms2 > s.ms ? s.ms2 : next;
    if(!(s.ms2 > s.ms)) s.ms2 = s.ms + 120;
    next = s.ms;
  }
  return segs;
}
/* 整首：行按时间排，行尾接到下一行的开头 */
function shTtmlClose(lines){
  const timed = lines.filter(L => isFinite(L.ms));
  if(timed.length < lines.length) return { timed:false, lines };
  lines.sort((a, b) => a.ms - b.ms);
  for(let i = 0; i < lines.length; i++){
    const L = lines[i];
    /* 行尾要接到「下一个时刻」，不是「下一条」。一个时刻挂几行是 LRC 里常见的写法
       （原文 / 翻译 / 一条 *注 同戳），从前这里取紧邻的下一条：同戳的前几行各自摊到一个
       和自己起点相同的行尾，窗口 0 毫秒，永远轮不到当「正在唱的那一行」，
       只有同戳最后一行（那条注释）独整段窗口 —— 于是高亮和滚动全钉在注释上，
       原文和翻译反倒被顶到上面去（外15 第 1 条：注释跑到最上面一行、歌词乱跳）。 */
    if(!(L.ms2 > L.ms)){
      let nx = NaN;
      for(let j = i + 1; j < lines.length; j++){ if(lines[j].ms > L.ms){ nx = lines[j].ms; break; } }
      L.ms2 = isFinite(nx) ? nx : L.ms + 4000;
    }
    shTtmlFlow(L.words, L.ms, L.ms2);
    if(L.note) shTtmlFlow(L.note, L.ms, L.ms2);
  }
  return { timed:true, lines };
}
/* ---------- 二、TTML（iTunes 逐字歌词）----------
   <p begin end itunes:key ttm:agent> 一行；子节点 <span begin end> 是逐字原文，
   <span ttm:role="x-translation"> 是翻译，<span ttm:role="x-roman"> 是罗马音注释，
   <span ttm:role="x-bg"> 是这一行里的和声（背景人声跟着主唱一起唱的那几个字）；
   <p> 上的 ttm:agent 指向文件头 <ttm:agent xml:id> 声明的那一个声部 ——
   同一个人一行、另一个人下一行 = 轮换；两个人同一时刻各占一行 = 对唱；这些都只在这一行里标，不猜。
   文件头 <head> 里还有两整块，都按 text[@for] = 行 key 挂回来：
   iTunesMetadata/transliterations/transliteration 是注音（每个字一个带起止时间的 span），
   iTunesMetadata/translations/translation 是翻译（纯文本，同一个 key 可能有两行 = 正文译法 + 一条 *注）。
   两种写法都常见，一个 .ttml 里往往只有文件头那一份，所以两种写法都得认。 */
function shTtmlAttrs(el){
  const o = {};
  for(let i = 0; i < el.attributes.length; i++){
    const a = el.attributes[i];
    o[String(a.localName || a.name).toLowerCase()] = a.value;
  }
  return o;
}
function shTtmlKids(el, fn){
  for(let i = 0; i < el.childNodes.length; i++){
    const n = el.childNodes[i];
    if(n.nodeType === 1) fn(n);
  }
}
const shTtmlLname = el => String(el.localName || el.nodeName || '').toLowerCase();
/* 子节点里认某一个名字，拿它的文字：声部名就写在 <ttm:agent><ttm:desc> 里 */
function shTtmlKid(el, name){
  let out = '';
  shTtmlKids(el, n => { if(!out && shTtmlLname(n) === name) out = String(n.textContent || '').trim(); });
  return out;
}

function shTtmlParse(text){
  let doc;
  try{ doc = new DOMParser().parseFromString(text, 'application/xml'); }
  catch(e){ return null; }
  if(!doc || doc.getElementsByTagName('parsererror').length) return null;
  const root = doc.documentElement;
  if(!root || shTtmlLname(root) !== 'tt') return null;
  const notes = {}, headTrans = {}, raw = [], agents = {};
  const walk = el => {
    const ln = shTtmlLname(el), a = shTtmlAttrs(el);
    /* 声部声明：<ttm:agent type="person" xml:id="v1"><ttm:name>RM</ttm:name></ttm:agent>。
       带名字的认名字（<ttm:name> 是标准写法，<ttm:desc> 和属性里带 name/label 的也认），
       没名字的按 type 给一个（person = 主唱，other = 和声），光板 id 不往界面上摆 */
    if(ln === 'agent' && a.id){
      const nm = shTtmlKid(el, 'name') || shTtmlKid(el, 'desc');
      agents[a.id] = { name:String(nm || a.name || a.label || (a.type === 'other' ? '和声' : '主唱')).trim(), type:a.type || 'person' };
    }
    if(ln === 'text' && a.for){
      const segs = [];
      shTtmlKids(el, s => {
        const sa = shTtmlAttrs(s), ms = shTtmlMs(sa.begin);
        if(isFinite(ms) && s.textContent) segs.push({ text:s.textContent, ms, ms2:shTtmlMs(sa.end) });
      });
      /* 带 span 的是注音（逐字打点）；光秃秃一行字的在 <translations> 里 = 这一行的翻译。
         同一个 key 出现两次是"译法 + 一条注释"，都收着，竖着摆。 */
      if(segs.length) notes[a.for] = segs;
      else{
        const t = String(el.textContent || '').trim();
        if(t)(headTrans[a.for] = headTrans[a.for] || []).push(t);
      }
    }
    if(ln === 'p'){
      const L = shTtmlLine(el, a);
      if(L) raw.push(L);
    }
    shTtmlKids(el, walk);
  };
  walk(root);
  if(!raw.length) return null;
  const lines = raw.map(L => {
    const ms = isFinite(L.ms) ? L.ms : (L.words.length && isFinite(L.words[0].ms) ? L.words[0].ms : NaN);
    if(!isFinite(ms)) return null;
    /* 注音逐字绑死：一段注音属于哪一个字／音节，落在那个字身上（w.notes），渲染一格一对。
       段数对得上就按段数对（先对不含和声的字，再对整行字 —— 两种文件都见过）；
       对不上按时间戳对：注音的起始时间落进哪个字的时间窗，就归哪个字（取开始时间不晚于它的、最靠后的那个字），
       还找不到就接在最一个有注音的字后面，不丢段。
       注音一段对应原文一字，空格却只写在原文里：把词尾的空格搬到对应的注音上，不然罗马音会连成一串。 */
    const src = notes[L.key] || null;
    if(src && src.length && L.words.length){
      const lead = L.words.filter(w => !w.bg);
      const refs = src.length === lead.length ? lead : (src.length === L.words.length ? L.words : null);
      let last = null;
      src.forEach((s, i) => {
        let w = refs ? refs[i] : null;
        if(!refs){
          for(const x of L.words) if(isFinite(x.ms) && x.ms <= s.ms && (!w || x.ms >= w.ms)) w = x;
          if(!w) w = last || L.words[0];
        }
        const gap = /\s+$/.exec(w.text);
        (w.notes = w.notes || []).push({ ms:s.ms, ms2:s.ms2, text:s.text + (gap && !/\s$/.test(s.text) ? gap[0] : '') });
        last = w;
      });
    }
    const note = src ? L.words.reduce((a, w) => a.concat(w.notes || []), []) : null;
    /* 翻译两边都认：文件头 <translations> 那份优先（同一个 key 的几行竖着排），
       没有再看行内 <span ttm:role="x-translation"> */
    const head = headTrans[L.key];
    /* 注释（* 开头那一条）不压上方，接到翻译那一侧竖着排；文件头那份译文仍旧优先，注释永远垫在最后 */
    const trans = [head && head.length ? head.join('\n') : L.trans].concat(L.anno || []).filter(Boolean).join('\n');
    return { ms, ms2:L.ms2, words:L.words, agent:L.agent || '',
      text:L.words.map(w => w.text).join(''),
      note:note && note.length ? note : null,
      noteText:note && note.length ? '' : L.roman, trans };
  }).filter(Boolean);
  if(!lines.length) return null;
  const r = shTtmlClose(lines);
  r.worded = true;
  r.fmt = 'ttml';
  /* 真有两个声部交替才把名单带上：整首只有一个声部的文件不摆声部标记 */
  const used = new Set(lines.map(L => L.agent).filter(Boolean));
  if(used.size > 1) r.agents = agents;
  return r;
}
function shTtmlLine(el, a){
  const ms = shTtmlMs(a.begin);
  const words = [];
  let trans = '', roman = '';
  const anno = [];
  for(let i = 0; i < el.childNodes.length; i++){
    const nd = el.childNodes[i];
    /* span 之间常有裸文本节点（英文歌词里就是那个空格），并进前一个字，别丢掉字距 */
    if(nd.nodeType === 3){
      const gap = String(nd.nodeValue || '');
      if(gap && words.length) words[words.length - 1].text += gap;
      else if(gap.trim() && !words.length) words.push({ text:gap, ms, ms2:shTtmlMs(a.end) });
      continue;
    }
    if(nd.nodeType !== 1) continue;
    const sa = shTtmlAttrs(nd), txt = nd.textContent || '';
    if(!txt) continue;
    if(sa.role === 'x-translation'){ trans = txt.trim(); continue; }
    /* x-roman 这一枚挂着两种东西：真罗马音（逐字对得上，该压在原文上方）和一条注释
       （* 开头，讲的是文字游戏、语法时态，和读音无关 —— 该跟在原文下面）。
       * 这个记号和本文件头那一份「译法 + 一条 *注」是同一个约定，注释并进翻译那一侧竖着排。 */
    if(sa.role === 'x-roman'){
      const t = txt.trim();
      if(/^\*/.test(t)) anno.push(t); else roman = t;
      continue;
    }
    /* 和声的字也是唱出来的词，照原位置收下、打个号：从前凡是带 role 的一律丢掉，
       等于把「跟着一起唱的那半句」从歌词里抹了 */
    if(sa.role === 'x-bg'){ words.push({ text:txt, ms:shTtmlMs(sa.begin), ms2:shTtmlMs(sa.end), bg:true }); continue; }
    if(sa.role) continue;
    if(shTtmlLname(nd) !== 'span'){ words.push({ text:txt, ms, ms2:shTtmlMs(sa.begin) }); continue; }
    words.push({ text:txt, ms:shTtmlMs(sa.begin), ms2:shTtmlMs(sa.end) });
  }
  if(!words.length) return null;
  /* 英文按词切：文件里一个词被拆成几个音节格（busy = bu / sy，mami = Ma / mi），
     相邻两格在接缝处都是西文字母或撇号、且前一格字尾没带空格 —— 并回一格，时间取首格起到末格止。
     空格是裸文本节点并进前一格字尾的，所以「字尾带空格」正是词与词的分界，不必另找标记；
     只看接缝两侧而不看整格，是因为 `that / ’ / ll` 这种撇号被单拆一格、`ll` 那格还带着词尾空格。
     韩文／汉字／假名一格一音节，不并（并了就把「唱到哪一个字」这件事糊掉了）；
     和声的字也不并 —— 它和主旋律是两层，混成一格等于把两层压成一层。 */
  const LAT = /[A-Za-zÀ-ɏ'’]/u;
  const joined = (p, w) => !p.bg && !w.bg && LAT.test(p.text.slice(-1)) && LAT.test(w.text.charAt(0)) && !/\s$/.test(p.text);
  const merged = [];
  for(const w of words){
    const p = merged[merged.length - 1];
    if(p && joined(p, w) && isFinite(p.ms) && isFinite(w.ms)){
      p.text += w.text;
      if(isFinite(w.ms2)) p.ms2 = w.ms2;
      continue;
    }
    merged.push(w);
  }
  const end = shTtmlMs(a.end);
  return { ms, ms2:end, words:merged, key:a.key || '', agent:a.agent || '', trans, roman, anno };
}

/* ---------- 往外写时刻的那几把尺（毫秒 → 串），和上面读的那一把配成一对 ----------
   从前这几句在为写（界面读数、导出 TTML、导出 LRC）和音乐遥控器（导出 LRC）各写了一遍，
   改一处只生效一半，所以收在这儿。放在文件末尾不动上面那些的行号 —— 为写有注释指着「shTtmlFlow 第 36 行」。
     shClockPad(n, w)         补零
     shTtmlClock(ms)          TTML 属性那种 HH:MM:SS.mmm
     shLrcClock(ms, frac)     歌词时标 m:ss.xxx；frac 给 2 就是 LRC 行首那档百分秒 ss.xx
     shLrcStamp(ms, inline)   把上面那句包成行首 [..] 或句内 <..>
   负数和读不出的都按 0 算，不往文件里写负时刻。
   组件那头吃的是加载器随 ctx.ttml 发下来的 clock / stamp（见 _shared/sh-load.js）。 */
function shClockPad(n, w){ return String(n).padStart(w || 2, '0'); }
function shTtmlClock(ms){
  const t = Math.max(0, Math.round(+ms || 0));
  return shClockPad(Math.floor(t / 3600000)) + ':' + shClockPad(Math.floor(t % 3600000 / 60000)) + ':' +
    shClockPad(Math.floor(t % 60000 / 1000)) + '.' + shClockPad(t % 1000, 3);
}
function shLrcClock(ms, frac){
  const t = Math.max(0, Math.round(+ms || 0));
  const f = frac === 2 ? Math.floor(t % 1000 / 10) : t % 1000;
  return Math.floor(t / 60000) + ':' + shClockPad(Math.floor(t % 60000 / 1000)) + '.' + shClockPad(f, frac || 3);
}
function shLrcStamp(ms, inline){ const s = shLrcClock(ms); return inline ? '<' + s + '>' : '[' + s + ']'; }
