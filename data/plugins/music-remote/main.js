/* ============================================================
   中立组件 · 音乐控件（FD 桌面卡 + WNW 停靠/标签共用这一份）
   播放：Flow-Desk 程序里走 Windows 的 SMTC —— 常驻子进程把 WinRT 事件原样推上来（不轮询）。
        SMTC 是所有现代播放器都发的那一条通道（Spotify / PotPlayer / Media Player / 网页播放器 / 装了 FD 桥插件的 MusicBee），
        默认自动挑"正在放的"那一个，挑错了就自己去指定播放器；音乐控件不认具体播放器。
        页面拿事件里的 pos + 自己的墙上时钟插值；差过校准阈值（默认 0.5 秒）当场掰回真值，
        播放器 4 秒没推时间线才主动问一次（事件优先，页面不轮询）；歌词还能整体往后挪 0~800 毫秒。
        这一棵里没有主进程那层桥时（本地开发那台服务器）降级成手动选一个音频，位置直接问 <audio>（它自己会发事件）。
   歌词：内嵌优先（mp3 的 USLT/SYLT、flac/ogg 的 TTMLLYRIC / LYRICS / UNSYNCEDLYRICS、m4a 的 ©lyr、mkv/webm 的 Tags），
        没内嵌就取同目录同名的 .ttml / .lrc / .elrc —— 目录有两种：自己指的那一个，和播放器报上来的"正在放的就是这个文件"。
        手动选的歌词文件永远算数。文本一律先嗅探：开头 <?xml / <tt 按 TTML，[mm:ss 按 LRC，都不像当纯文本。
        ttml 是逐字歌词，三行 = 原文 / 注音（transliteration，没有就退到 x-roman）/ 翻译。
        有时间戳就逐字卡拉OK：一个字从 0% 填到 100%，未唱的那一档走亮度尺（浅），唱过的保持彩色。
   登记走加载器：插件清单里 type 写的是 tool，它 import 完把这份 default 交给宿主的 registerTool()
        （WNW 挂成停靠/标签视图，Flow-Desk 挂成桌面卡片）—— 组件自己一个字都不调注册。
        卡片 = 歌名·艺人 + 四按钮 + 进度条 + 当前句，⛶ 才出整页。
   ============================================================ */

/* ES module：宿主能力全从加载器给的 ctx 里取，K 在 init(ctx) 里落定。
   h()/toast()/State/Phrase/musApp 沿用原来那几个名字，只做一层转发，正文一个字不用改。
   musApp 就是 ctx.app —— 插件清单 appChannels 里点名的那十四个媒体通道由宿主发下来，
   宿主那把尺（_shared/sh-load.js 的 packApp）自己会「本框 → 父框 → 顶框」往上找桥，
   所以这个卡在 Flow-Desk 桌面上、和在 Flow-Desk 罩着开的 Why Not Write 停靠里，连的是同一个桥。 */
let K = null;
const h = (...a) => K.el(...a);
const toast = (...a) => K.toast(...a);
const State = { get:(...a) => K.state.get(...a), set:(...a) => K.state.set(...a) };
const Phrase = { out:(...a) => K.phrase.out(...a) };
const musApp = () => K.app;

/* ---------- 一、时间 ---------- */
/* TTML 解析和它那三枚时值尺（musMs / musFlow / musClose）搬进共用层了（外19 词格与这里同读一份，
   见 src/_shared/sh-ttml.js）。搬到之后这一包里真的只剩两枚还有人叫 —— 就只留这两枚同名转发，
   正文其余部分一个字不改。走 ctx 不走整页全局名，是组件包的界（_build/scan-packs.mjs 那把尺查这个）。 */
/* 秒表读数：7:04 / 1:07:04 */
function musClock(ms){
  const t = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const pad = n => (n < 10 ? '0' : '') + n;
  const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
  return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
}
/* 偏移滑杆上那句话 */
function musLag(ms){
  const v = Math.round(Number(ms) || 0);
  return v > 0 ? '歌词延后 ' + v + 'ms' : v < 0 ? '歌词提前 ' + (-v) + 'ms' : '歌词对齐';
}
const musClose = (...a) => K.ttml.close(...a);

const parseTtml = (...a) => K.ttml.parse(...a);

/* ---------- 三、LRC / eLRC（公开规范那一小块）----------
   行首 [mm:ss.xx]（可以挂好几个 = 同一句在几处重复），元数据 [ti:][ar:][by:][offset:]，
   offset 单位毫秒，正值 = 歌词比录音早半拍出（行戳减掉它）；eLRC 在句内用 <mm:ss.xx> 逐字打点。 */
function parseLrc(text){
  const src = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let offset = 0, stamped = false;
  for(const rawLine of src.split(/\r?\n/)){
    let s = rawLine.trim();
    if(!s) continue;
    /* 行首一串方括号：数字打头的当行戳，其余当元数据；一行里塞好几个也吃得下 */
    const stamps = [];
    for(;;){
      const m = /^\[([^\]]*)\]/.exec(s);
      if(!m) break;
      const t = /^(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?$/.exec(m[1].trim());
      if(t){ stamps.push(musLrcMs(t)); s = s.slice(m[0].length); continue; }
      const kv = /^([^\d][^\]:]*):(.*)$/.exec(m[1].trim());
      if(kv){
        if(kv[1].toLowerCase() === 'offset') offset = -(Number(kv[2]) || 0);   /* 规范里正值是「提前显示」，落进时间就是减 */
        s = s.slice(m[0].length); continue;
      }
      break;
    }
    s = s.trim();
    if(!stamps.length){
      /* 一个时间戳都还没出现过 = 纯文本歌词（能看不能高亮）；带戳的文件里裸行不算歌词行 */
      if(s && !stamped) rows.push({ ms:NaN, ms2:NaN, text:s, words:[{ text:s, ms:NaN, ms2:NaN }] });
      continue;
    }
    stamped = true;
    const body = s;
    /* eLRC：句内 <mm:ss.xx> 打点，第一个点之前的字属行戳 */
    const marks = [];
    let im;
    const RE = /<(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?>/g;
    while((im = RE.exec(body))) marks.push({ at:im.index, len:im[0].length, ms:musLrcMs(im) + offset });
    const first = stamps[0] + offset;
    const words = [];
    if(!marks.length) words.push({ text:body, ms:first, ms2:NaN });
    else{
      const head = body.slice(0, marks[0].at);
      if(head) words.push({ text:head, ms:first, ms2:marks[0].ms });
      for(let i = 0; i < marks.length; i++){
        const seg = body.slice(marks[i].at + marks[i].len, i + 1 < marks.length ? marks[i + 1].at : body.length);
        if(seg) words.push({ text:seg, ms:marks[i].ms, ms2:i + 1 < marks.length ? marks[i + 1].ms : NaN });
      }
    }
    if(!words.length) words.push({ text:body, ms:first, ms2:NaN });
    stamps.forEach((ms, i) => {
      /* 多个行戳 = 同一句重复；重复那几次不做逐字（没有时间对应） */
      const w = i === 0 ? words : [{ text:body, ms:ms + offset, ms2:NaN }];
      rows.push({ ms:ms + offset, ms2:NaN, text:body, words:w, plain:!marks.length && i > 0 });
    });
  }
  if(!rows.length) return null;
  const lines = rows.map(r => ({ ms:r.ms, ms2:r.ms2, words:r.words, text:r.text, note:null, noteText:'', trans:'' }));
  const r = musClose(lines);
  r.worded = lines.some(L => L.words.length > 1);
  r.fmt = musFmtLrc(rows);
  return r;
}
/* 用户拍的优先级：ttml > 逐字 lrc > 增强 lrc > 逐行 lrc（同档内嵌赢外置）。
   逐字 / 增强 的区别就在句内打点密不密：一句里被拆出三段以上算逐字，只拆一两段的算增强。 */
const MUS_FMT = { plain:0, line:1, elrc:2, word:3, ttml:4 };
function musFmtLrc(rows){
  let timed = 0, inline = 0, many = 0;
  for(const r of rows){
    if(!isFinite(r.ms)) continue;
    timed++;
    if(r.words.length > 1){ inline++; if(r.words.length >= 3) many++; }
  }
  if(!timed) return 'plain';
  if(!inline) return 'line';
  return many * 2 >= inline ? 'word' : 'elrc';
}
function musLrcMs(m){
  const frac = m[3] ? Number(String(m[3]).padEnd(3, '0').slice(0, 3)) : 0;
  return (Number(m[1]) * 60 + Number(m[2])) * 1000 + frac;
}
/* 三条嗅探，写死的：跳过 BOM 和空白，开头是 <?xml / <tt 就按 TTML；[mm:ss 就打头的是行戳，按 LRC；
   都不像当无时间轴纯文本。歌词塞在哪个字段里都先过这三条，不认字段名。 */
function musSniff(text){
  const t = String(text || '').replace(/^\uFEFF/, '').replace(/^\s+/, '');
  if(/^<\?xml/i.test(t) || /^<tt[\s/>]/i.test(t)) return 'ttml';
  if(/^\[\d{1,2}:\d{2}/.test(t)) return 'lrc';
  return 'plain';
}
/* 文本 → 统一结构：ttml 认根元素，剩下的按 lrc/elrc 读，再不行当纯文本 */
function parseLyric(text){
  const s = String(text || '');
  if(!s.trim()) return null;
  if(musSniff(s) === 'ttml'){
    const d = parseTtml(s);
    if(d) return d;
  }
  const d = parseLrc(s);
  if(d) return d;
  const lines = s.split(/\r?\n/).map(t => t.trim()).filter(Boolean)
    .map(t => ({ ms:NaN, ms2:NaN, words:[{ text:t, ms:NaN, ms2:NaN }], text:t, note:null, noteText:'', trans:'' }));
  return lines.length ? { timed:false, worded:false, fmt:'plain', lines } : null;
}

/* ---------- 四、内嵌歌词（只读文件里那一段标签，不搬整首歌）---------- */
const MUS_AUDIO = ['mp3', 'm4a', 'mp4', 'aac', 'flac', 'ogg', 'oga', 'opus', 'wav', 'wma', 'webm', 'mkv'];
const MUS_LYRIC = ['ttml', 'lrc', 'elrc', 'txt'];
/* 内嵌封面单张封顶 8MB（和读歌词文件那道上限同一档）：超了就不摆，别把内存吃穿 */
const MUS_ART_MAX = 8 * 1024 * 1024;

function musBe32(b, o){ return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0; }
function musLe32(b, o){ return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
function musSync(b, o){ return ((b[o] & 0x7f) * 2097152 + ((b[o + 1] & 0x7f) << 14) + ((b[o + 2] & 0x7f) << 7) + (b[o + 3] & 0x7f)) >>> 0; }
function musAsci(b, o, n){ let s = ''; for(let i = 0; i < n; i++) s += String.fromCharCode(b[o + i]); return s; }
function musUtf8(b, o, n){
  try{ return new TextDecoder('utf-8').decode(b.subarray(Math.max(0, o), Math.max(0, o) + n)); }
  catch(e){ return ''; }
}
/* ID3v2 的文本编码：0 拉丁、1 UTF-16 带 BOM、2 UTF-16BE、3 UTF-8 */
function musDec(b, o, n, enc){
  try{
    if(enc === 0) return new TextDecoder('latin1').decode(b.subarray(o, o + n));
    if(enc === 1) return new TextDecoder('utf-16').decode(b.subarray(o, o + n));
    if(enc === 2) return new TextDecoder('utf-16be').decode(b.subarray(o, o + n));
    return new TextDecoder('utf-8').decode(b.subarray(o, o + n));
  }catch(e){ return ''; }
}
function musZero(b, o, step){ return step === 2 ? (b[o] === 0 && b[o + 1] === 0) : b[o] === 0; }
/* 时标那一句的算式在共用层（_shared/sh-ttml.js 的 shLrcStamp），随 ctx.ttml 发下来 */
function musLrcTag(ms, inline){ return K.ttml.stamp(ms, inline); }

const MusBin = {
  async size(fh){
    try{ if(fh.size) return await fh.size(); }catch(e){}
    try{ return (await fh.getFile()).size; }catch(e){ return 0; }
  },
  async range(fh, start, len){
    try{
      if(typeof fh.readRange === 'function') return new Uint8Array(await fh.readRange(start, len));
      const f = await fh.getFile();
      return new Uint8Array(await f.slice(start, start + len).arrayBuffer());
    }catch(e){ return null; }
  }
};

const MusEmb = {
  /* 返回 { text, from }；读不到回 null（那就去取同目录同名的文件） */
  async from(fh, name){
    const ext = String(name || '').toLowerCase().split('.').pop();
    try{
      if(ext === 'mp3') return await this.mp3(fh);
      if(ext === 'flac') return await this.flac(fh);
      if(ext === 'ogg' || ext === 'oga' || ext === 'opus') return await this.ogg(fh);
      if(ext === 'm4a' || ext === 'mp4' || ext === 'm4b' || ext === 'aac') return await this.mp4(fh);
      if(ext === 'mkv' || ext === 'webm') return await this.mkv(fh);
    }catch(e){ return null; }
    return null;
  },
  /* --- mp3：ID3v2.3 / 2.4 的 USLT（纯文本）与 SYLT（逐字打点）---
     art 传一个空对象进来，同一趟走法里的 APIC（内嵌封面）就顺手收在上面，不另开一次读取 */
  async mp3(fh, art){
    const head = await MusBin.range(fh, 0, 10);
    if(!head || head.length < 10 || musAsci(head, 0, 3) !== 'ID3') return null;
    const ver = head[3], size = musSync(head, 6);
    if(!size || size > 0x0fffffff) return null;
    const body = await MusBin.range(fh, 10, size);
    if(!body) return null;
    let o = 0, uslt = null, sylt = null;
    while(o + 10 <= body.length){
      const id = musAsci(body, o, 4);
      if(!/^[A-Z0-9]{4}$/.test(id)) break;
      const sz = ver >= 4 ? musSync(body, o + 4) : musBe32(body, o + 4);
      const s = o + 10, e = s + sz;
      if(sz <= 0 || e > body.length) break;
      if(id === 'USLT') uslt = this.uslt(body.subarray(s, e));
      else if(id === 'SYLT') sylt = this.sylt(body.subarray(s, e));
      else if(id === 'APIC') this.apic(body.subarray(s, e), art);
      o = e;
    }
    if(sylt) return { text:sylt, from:'内嵌 SYLT（逐字）' };
    if(uslt) return { text:uslt, from:'内嵌 USLT' };
    return null;
  },
  uslt(f){
    if(f.length < 5) return '';
    const enc = f[0], step = (enc === 1 || enc === 2) ? 2 : 1;
    let o = 4;
    while(o + step <= f.length && !musZero(f, o, step)) o += step;
    o += step;
    return musDec(f, o, f.length - o, enc).replace(/\u0000/g, '').trim();
  },
  /* SYLT：时间戳表（u32 毫秒 + 1 字节类型）后面跟文本，段之间一个终止符、行之间两个 */
  sylt(f){
    if(f.length < 14) return '';
    const enc = f[0], step = (enc === 1 || enc === 2) ? 2 : 1;
    if(f[4] !== 2) return '';
    let o = 6;
    while(o + step <= f.length && !musZero(f, o, step)) o += step;
    o += step;
    const stamps = [];
    while(o + 4 < f.length){
      const ms = musBe32(f, o);
      if(!ms) break;
      stamps.push(ms); o += 5;
    }
    const segs = [];
    let seg = '';
    while(o < f.length){
      if(!musZero(f, o, step)){ seg += musDec(f, o, step, enc); o += step; continue; }
      o += step;
      const brk = o + step <= f.length && musZero(f, o, step);
      if(brk) o += step;
      segs.push({ text:seg, brk }); seg = '';
    }
    if(seg) segs.push({ text:seg, brk:true });
    if(!stamps.length || stamps.length !== segs.length) return '';
    const out = [];
    let line = [], lineMs = 0;
    for(let i = 0; i < segs.length; i++){
      if(!line.length) lineMs = stamps[i];
      line.push({ text:segs[i].text, ms:stamps[i] });
      if(segs[i].brk || i === segs.length - 1){
        let s = musLrcTag(line[0].ms) + line[0].text;
        for(let k = 1; k < line.length; k++) s += musLrcTag(line[k].ms, true) + line[k].text;
        out.push(s); line = [];
      }
    }
    return out.join('\n');
  },
  /* APIC（ID3v2.3 / 2.4 的内嵌图）：一个字节文本编码 → 以终止符收尾的 MIME → 一个字节图片类型
     → 以同一编码收尾的描述（可以空着）→ 剩下的整段就是图片字节。
     图片类型优先 3（封面），没有 3 取这一趟里遇到的第一张，20（艺术品）、4（背面）排在 3 后面。
     MIME 只认 jpeg / png，空串或不像图片的按 jpeg 兜（老文件里空 MIME 是常态）。
     收下来的东西挂在调用方给的那个空对象上，这里不起 URL、也不摆 */
  apic(f, out){
    if(!out || !f || f.length < 5) return;
    const enc = f[0], step = (enc === 1 || enc === 2) ? 2 : 1;
    let o = 1;
    const m0 = o;
    while(o + step <= f.length && !musZero(f, o, step)) o += step;
    const mime = musDec(f, m0, o - m0, enc).replace(/^\uFEFF/, '').trim().toLowerCase();
    o += step;
    if(o >= f.length) return;
    const type = f[o]; o += 1;
    while(o + step <= f.length && !musZero(f, o, step)) o += step;
    o += step;
    if(o >= f.length) return;
    const bytes = f.subarray(o);
    if(!bytes.length || bytes.length > MUS_ART_MAX) return;
    const rank = type === 3 ? 0 : type === 20 ? 1 : type === 4 ? 2 : 3;
    if(out.best && out.best.rank <= rank) return;
    out.best = { rank, bytes, kind:mime.replace(/^image\//, '') === 'png' ? 'image/png' : 'image/jpeg' };
  },
  /* --- flac / ogg 的注释块：LYRICS / UNSYNCEDLYRICS --- */
  vorbis(b){
    if(!b || b.length < 8) return null;
    let o = 0;
    if(musAsci(b, 0, 4) === 'fLaC') o = 4;
    const vend = musLe32(b, o); o += 4 + vend;
    if(o + 4 > b.length) return null;
    const n = musLe32(b, o); o += 4;
    /* TTMLLYRIC 是专门给 TTML 开的字段（MusicBee 那批文件就这么写），语义确定；
       lyrics 是所有播放器的公共槽，纯文本 / LRC / 甚至 TTML 都往里塞，得靠嗅探认。拍的是前者优先。 */
    let ttml = '', lyric = '', unsync = '';
    for(let i = 0; i < n && o + 4 <= b.length; i++){
      const len = musLe32(b, o); o += 4;
      const s = musUtf8(b, o, len); o += len;
      const eq = s.indexOf('=');
      if(eq < 0) continue;
      const k = s.slice(0, eq).toUpperCase(), v = s.slice(eq + 1);
      if(k === 'TTMLLYRIC' && v.trim() && !ttml) ttml = v;
      else if(k === 'LYRICS' && v.trim() && !lyric) lyric = v;
      else if(k === 'UNSYNCEDLYRICS' && v.trim() && !unsync) unsync = v;
    }
    if(ttml.trim()) return { text:ttml.trim(), from:'内嵌 TTMLLYRIC' };
    return lyric || unsync ? { text:(lyric || unsync).trim(), from:lyric ? '内嵌 LYRICS' : '内嵌 UNSYNCEDLYRICS' } : null;
  },
  async flac(fh){
    const b = await MusBin.range(fh, 0, 2 * 1024 * 1024);
    if(!b || musAsci(b, 0, 4) !== 'fLaC') return null;
    let o = 4;
    while(o + 8 <= b.length){
      const last = (b[o] & 0x80) === 0x80;
      const type = ((b[o] & 0x7f) << 16) | (b[o + 1] << 8) | b[o + 2];
      const len = musBe32(b, o + 4);
      o += 8;
      if(type === 4) return this.vorbis(b.subarray(o, o + len));
      if(last || len < 0 || o + len > b.length) break;
      o += len;
    }
    return null;
  },
  async ogg(fh){
    const b = await MusBin.range(fh, 0, 4 * 1024 * 1024);
    if(!b || musAsci(b, 0, 4) !== 'OggS') return null;
    let o = 0, cur = [], packets = [];
    while(o + 27 <= b.length && musAsci(b, o, 4) === 'OggS' && packets.length < 4){
      const nseg = b[o + 26], segStart = o + 27;
      let pos = segStart + nseg, li = 0;
      while(li < nseg && pos <= b.length){
        let len = 0, ended = false;
        while(li < nseg){ const v = b[segStart + li++]; len += v; if(v < 255){ ended = true; break; } }
        const take = Math.min(len, b.length - pos);
        cur.push(b.subarray(pos, pos + take)); pos += take;
        if(ended){ packets.push(this.cat(cur)); cur = []; }
      }
      o = pos;
    }
    if(packets.length < 2) return null;
    let p = packets[1];
    const h = musAsci(p, 0, 8);
    if(h.startsWith('vorbis')) p = p.subarray(7);
    else if(h === 'OpusTags') p = p.subarray(8);
    return this.vorbis(p);
  },
  cat(parts){
    const n = parts.reduce((a, c) => a + c.length, 0), all = new Uint8Array(n);
    let o = 0; for(const c of parts){ all.set(c, o); o += c.length; }
    return all;
  },
  /* --- m4a：moov/udta/meta/ilst 里的 ©lyr 文本盒 --- */
  async mp4(fh){
    const size = await MusBin.size(fh);
    if(!size) return null;
    let o = 0, guard = 0;
    while(o + 16 <= size && guard++ < 64){
      const hdr = await MusBin.range(fh, o, 16);
      if(!hdr || hdr.length < 16) break;
      let sz = musBe32(hdr, 0), hlen = 8;
      const type = musAsci(hdr, 4, 4);
      if(sz === 1){ sz = musBe32(hdr, 8) * 4294967296 + musBe32(hdr, 12); hlen = 16; }
      else if(sz === 0) sz = size - o;
      if(sz < hlen || !/^[\x20-\x7e\xa9]{4}$/.test(type)) break;
      if(type === 'moov'){
        const buf = await MusBin.range(fh, o, Math.min(sz, 16 * 1024 * 1024));
        if(!buf) return null;
        const t = this.mp4Lyric(new Uint8Array(buf), 0, buf.length, 0);
        return t ? { text:t, from:'内嵌 ©lyr' } : null;
      }
      o += sz;
    }
    return null;
  },
  mp4Lyric(b, from, to, depth){
    if(depth > 8) return '';
    const DOWN = ['moov', 'trak', 'mdia', 'minf', 'stbl', 'udta', 'ilst'];
    let o = from;
    while(o + 8 <= to){
      const sz = musBe32(b, o), type = musAsci(b, o + 4, 4);
      if(sz < 8 || o + sz > to) break;
      if(type === '©lyr' || type === 'lyrX' || type === 'lyrt'){
        const t = this.mp4Text(b, o + 8, o + sz);
        if(t) return t;
      }else if(DOWN.includes(type)){
        const t = this.mp4Lyric(b, o + 8 + (type === 'meta' ? 4 : 0), o + sz, depth + 1);
        if(t) return t;
      }
      o += sz;
    }
    return '';
  },
  mp4Text(b, from, to){
    let o = from;
    while(o + 16 <= to){
      const sz = musBe32(b, o), type = musAsci(b, o + 4, 4);
      if(sz < 8 || o + sz > to) break;
      if(type === 'data') return musUtf8(b, o + 16, sz - 16).trim();
      o += sz;
    }
    return '';
  },
  /* --- mkv / webm：EBML Tags/SimpleTag 里名字带 LYRICS 的那条 --- */
  async mkv(fh){
    const b = await MusBin.range(fh, 0, 8 * 1024 * 1024);
    if(!b || b.length < 4 || musBe32(b, 0) !== 0x1A45DFA3) return null;
    const found = [];
    const tags = (from, to) => {
      this.ebmlKids(b, from, to, (id, s, e) => {
        if(id !== 0x67C8) return;
        let name = '', val = '';
        this.ebmlKids(b, s, e, (i2, s2, e2) => {
          if(i2 === 0x45A3) name = musUtf8(b, s2, e2 - s2);
          else if(i2 === 0x4487) val = musUtf8(b, s2, e2 - s2);
        });
        if(val.trim()) found.push({ name:name.trim(), val });
      });
    };
    this.ebmlKids(b, 0, b.length, (id, s, e) => {
      if(id === 0x18538067 || id === 0x1549A966) this.ebmlKids(b, s, e, (i2, s2, e2) => {
        if(i2 === 0x1254C367) tags(s2, e2);
      });
    });
    const pick = found.filter(f => /lyric|歌词/i.test(f.name))[0]
      || found.filter(f => /^\[(\d{1,3}):|<tt[\s>]/i.test(f.val))[0];
    return pick ? { text:pick.val.trim(), from:'内嵌 Tags：' + (pick.name || 'LYRICS') } : null;
  },
  ebmlId(b, o){
    const c = b[o];
    if(!c) return null;
    let len = 1, mask = 0x80;
    while(!(c & mask) && len < 4){ len++; mask >>= 1; }
    if(o + len > b.length) return null;
    let id = 0;
    for(let i = 0; i < len; i++) id = id * 256 + b[o + i];
    return { id, len };
  },
  ebmlSize(b, o){
    const c = b[o];
    if(!c) return null;
    let len = 1, mask = 0x80;
    while(!(c & mask) && len < 8){ len++; mask >>= 1; }
    if(o + len > b.length) return null;
    let v = c & (mask - 1);
    for(let i = 1; i < len; i++) v = v * 256 + b[o + i];
    return { v, len };
  },
  ebmlKids(b, from, to, fn){
    let o = from, guard = 0;
    while(o + 2 <= to && guard++ < 4096){
      const id = this.ebmlId(b, o);
      if(!id) break;
      const sz = this.ebmlSize(b, o + id.len);
      if(!sz) break;
      const start = o + id.len + sz.len, end = Math.min(to, start + sz.v);
      if(start > to || end <= start) break;
      fn(id.id, start, end);
      o = end;
    }
  }
};

/* ---------- 四·五、专辑封面（只认内嵌那一张，只在内存里）----------
   跟着 MusEmb.mp3 那一趟现成的帧循环走（APIC 就在同一趟里），不另起一套解析、也不搬整首歌。
   字节 → Blob → objectURL 全在内存里：不往音乐文件夹放图、不动音乐文件自己的标签、不落一个缓存文件。
   拿不到内嵌图（不是 mp3、没内嵌、句柄没有、字节读崩了）一律安静退回那张音符占位：
   不弹条、不往控制台报错，歌词和进度那条链也不等它 —— 认回来那一趟再换上。
   只做 mp3：flac / m4a / mkv / ogg 的封面块这一轮没接。 */
const MusArt = {
  box:new Map(),      /* 歌名|艺人|路径 → objectURL；'' = 认过了，这首没内嵌图；null = 正在认 */
  curKey:'',          /* 现在摆在界面上的是哪一首 */
  url:'',             /* 现在挂在手上那一张（换歌时撤的就是它） */
  /* 记一张内存表就按这三样拼：同一首歌在同一次运行里不重复读文件 */
  key(tr){
    const p = String(tr.songPath || '') || (MusLy.audio ? String(MusLy.audio.name || '') : '');
    const t = String(tr.title || '').trim();
    if(!t && !p) return '';
    return t + '|' + String(tr.artist || '').trim() + '|' + p;
  },
  /* 来源和歌词同一个：播放器报上来的那一个文件，没有就看这台机器上手选的那份音频 */
  source(tr){
    if(tr && typeof tr.songHandle === 'function'){
      const fh = tr.songHandle();
      if(fh) return { fh, name:String(fh.name || tr.songPath || '') };
    }
    const a = MusLy.audio;
    return a && a.fh ? { fh:a.fh, name:a.name } : null;
  },
  /* 界面每趟刷新问一次这一首要摆哪张：回空串就是先摆占位图 */
  want(tr){
    const key = this.key(tr);
    if(!key) return '';
    if(key !== this.curKey){ this.drop(); this.curKey = key; }
    const hit = this.box.get(key);
    if(hit === undefined){
      /* 连句柄都还没有的时候不占位、也不记「没有」：那只是桥还没通，下一趟再认 */
      if(!this.source(tr)) return '';
      this.box.set(key, null);
      this.read(tr, key);
      return '';
    }
    if(hit === null) return this.url;
    this.url = hit;
    return hit;
  },
  async read(tr, key){
    const src = this.source(tr);
    let url = '';
    if(src){
      const art = {};
      try{ await MusEmb.mp3(src.fh, art); }catch(e){}
      if(art.best){
        try{ url = URL.createObjectURL(new Blob([art.best.bytes], { type:art.best.kind })); }
        catch(e){ url = ''; }
      }
    }
    /* 认回来歌已经换了：这张当场撤掉，那一首回头再认就是 —— 不留没人认账的 objectURL */
    if(this.curKey !== key){
      if(url){ try{ URL.revokeObjectURL(url); }catch(e){} }
      if(this.box.get(key) === null) this.box.delete(key);
      return;
    }
    this.box.set(key, url);
    this.url = url;
    if(url) Music.tell();
  },
  /* 换歌：上一首那张先撤掉，别攒着不撤（认过「这首没内嵌图」那条空记号留着，省得再读一遍） */
  drop(){
    const url = this.url;
    this.url = '';
    if(url && this.box.get(this.curKey) === url){
      try{ URL.revokeObjectURL(url); }catch(e){}
      this.box.delete(this.curKey);
    }
  },
  clear(){
    for(const v of this.box.values()) if(v){ try{ URL.revokeObjectURL(v); }catch(e){} }
    this.box.clear(); this.curKey = ''; this.url = '';
  }
};

/* ---------- 五、播放源：SMTC 事件 + 本地插值；没有系统会话那条口子时退回手选的 <audio> ---------- */
/* 桥那份（mediaState / mediaCmd / mediaPin …）从 ctx.app 拿，取道见开头那句 musApp ——
   桥只注在 Flow-Desk 那一框，这一家和宿主同在一张页里，拿到的就是同一份。 */
const MUS_VIEWS = [];
/* 校准兜底：播放器这么久没推过时间线，才主动问一次快照（毫秒） */
const CALIB_BACK = 4000;
/* 一次对齐算「真断开」的那道线（毫秒）：掰过的数比它大，或者换了歌、按了暂停播放，
   正在唱那个字的渐变才重起手；比它小只挪基准，字接着走完自己那一段 */
const JUMP_MS = 1200;
/* 歌词这一行肯不肯往回退的那道线（毫秒）：校准死区是 500，往回退得比它宽一档才压得住
   桥每两秒那一次往回掰；比 JUMP_MS 窄，是因为真掰过那道线的（拖进度条、切歌、暂停再播）
   都会 gen++，走的是另一条放行路，不归这里管。 */
const LI_BACK_MS = 700;
/* 切到间奏分隔这一条：上一句唱完到下一句开口，空过这个数就在中间摆一道分隔（毫秒）。
   这一档照他库里的真数据定的（外22 重量）：32 份侧车 ttml + 抽读 1394 个音频里挖出的内嵌 ttml，
   共 41 首带行尾时间、2514 个接缝，中位 0.22 秒，最长 45.20 秒。
   定 4 秒这一档：全库 65 处接缝、34/41 首至少看得见一道 —— 平均每首 1.6 道，既不是每两句就来一道，
   也不是一首歌碰不到（从前定的 8 秒太严：45 处 / 28 首，一半多的歌一道都见不着）。 */
const MUS_GAP_MS = 4000;
/* 歌词前后错开的最大行程（毫秒）。往两边都给：歌词比音乐快的时候得能往回调（他要的「可以往前调」）。
   这一档只存 FD 自己那本小抄，绝不允许写进歌曲文件或歌词文件（他定过的硬约束）。 */
const MUS_LAG_MS = 800;
/* 丙：三档字各留一档字号、一档粗细 —— 注音 / 原文 / 翻译分开调。
   这张表是唯一的那份名册：flags 上的键（fsNote / fwNote …）、CSS 变量（--mu-fs-note / --mu-fw-note）、
   设置框里那一行，三处都由它派生，不落第二份对照表。
   字号是乘在原来到那一档上的百分比（100 = 一个字都不动），粗细 0 = 不覆盖、跟着原来那档走。 */
const MUS_TYPE = [['note','注音'],['main','原文'],['trans','翻译']];
const muFlag = (p, k) => p + k[0].toUpperCase() + k.slice(1);
/* 粗细那几档只列这一套里真用得上的：0 = 不覆盖（原来什么样就什么样），其余是常用四档 */
const MUS_FW = [[0,'照旧'],[400,'常规'],[500,'中等'],[600,'半粗'],[700,'加粗'],[800,'特粗']];
/* 丙：那六个控件（三档 × 字号 + 粗细）只这一份 —— 齿轮对话框和整页那一屏的「字」面板都调它，
   两处改的是同一本小抄（Music.flagSet 落完 tell() 一遍，另一处开着的下一趟跟着变）。
   外21 那版是一根滑杆挂一枚下拉、行头写「字号 / 粗细」，在他看来成了「一个滑块同时调两样」（外22 第 7 条）。
   这一版一样一根滑杆、各带各的名字，粗细那根走的是 MUS_FW 的档位序号 —— 只落在真有的那些档上，滑不出 450 这种数。 */
function musTypeRows(){
  const rows = [];
  const fwAt = n => MUS_FW[Math.max(0, Math.min(MUS_FW.length - 1, Number(n) | 0))];
  const line = (name, rng, num) => h('div', { style:'display:flex;gap:8px;align-items:center' },
    [h('span', { class:'fd-hint', style:'flex:0 0 auto;min-width:2.2em' }, name), rng, num]);
  for(const t of MUS_TYPE){
    const fk = muFlag('fs', t[0]), wk = muFlag('fw', t[0]);
    const rng = h('input', { type:'range', min:'60', max:'200', step:'2', value:String(Music.flags[fk]),
      style:'flex:1 1 auto;min-width:110px', 'aria-label':t[1] + '字号' });
    const num = h('span', { class:'fd-hint', style:'flex:0 0 auto;min-width:3.2em;text-align:right' }, Music.flags[fk] + '%');
    rng.addEventListener('input', () => { num.textContent = rng.value + '%'; });
    rng.addEventListener('change', () => { Music.flagSet(fk, rng.value); });
    let wi = MUS_FW.findIndex(o => o[0] === Music.flags[wk]); if(wi < 0) wi = 0;
    const wrng = h('input', { type:'range', min:'0', max:String(MUS_FW.length - 1), step:'1', value:String(wi),
      style:'flex:1 1 auto;min-width:110px', 'aria-label':t[1] + '粗细' });
    const wnum = h('span', { class:'fd-hint', style:'flex:0 0 auto;min-width:3.2em;text-align:right' }, MUS_FW[wi][1]);
    wrng.addEventListener('input', () => { wnum.textContent = fwAt(wrng.value)[1]; });
    wrng.addEventListener('change', () => { Music.flagSet(wk, fwAt(wrng.value)[0]); });
    rows.push(h('div', { style:'display:grid;gap:5px;margin-bottom:14px' },
      [h('div', { class:'fd-hint' }, t[1]), line('字号', rng, num), line('粗细', wrng, wnum)]));
  }
  return rows;
}
const Music = {
  smtc:null, msg:'', dead:false,
  audio:null, file:null, url:'',
  at:0, pos:0, dur:0, rate:1, status:'', title:'', artist:'', album:'', app:'', can:{},
  lastRawPos:-1,
  appliedSeq:0, trackKey:'', drift:null, timer:null, booted:false, seekAt:0, offs:[],
  confirm:null,
  /* 谁在放：how=auto|pin|pin-missing，pin=指定的播放器（空串=自动挑），list=系统里所有会话，
     songPath=播放器小抄里那一行"正在放的是这个文件"（只有 Flow-Desk 程序里有） */
  how:'', pin:'', pinOk:true, musicDir:'', list:[], songPath:'',
  /* 控件上的四个数：注音 / 翻译开不开，歌词整体往后挪几毫秒（0~800，治「歌词比音乐快」），
     校准阈值几毫秒（差过这个数才把本地插值掰回播放器真值）。
     Flow-Desk 程序里存 players\music.txt —— FD 卡和 WNW 停靠读的是同一份，这边一拨那边跟着变；
     这一棵里没有那个文件夹（本地开发那台服务器）时，退回页面自己的 store（keys 还是 music-note / music-trans / music-off）。 */
  flags:{ note:true, trans:true, off:0, sync:500, fsNote:100, fsMain:100, fsTrans:100, fwNote:0, fwMain:0, fwTrans:0 },
  snapAt:0,
  /* 时刻基准换过一次就 +1（对齐了真值、拖了进度条、拨了偏移）：
     正在唱的那个字的渐变按这个号重起手，不然暂停再播它会一直停在半截 */
  gen:0,

  async init(){
    if(this.booted) return;
    this.booted = true;
    const A = musApp();
    if(A && typeof A.mediaState === 'function'){
      try{ this.onBridge(await A.mediaState()); }catch(e){}
      if(typeof A.mediaOn === 'function'){ try{ this.sub(A.mediaOn(d => this.onBridge(d))); }catch(e){} }
      if(typeof A.mediaPlayers === 'function'){ try{ this.onPlayers(await A.mediaPlayers()); }catch(e){} }
      if(typeof A.mediaOnPlayers === 'function'){ try{ this.sub(A.mediaOnPlayers(st => this.onPlayers(st))); }catch(e){} }
    }
    /* 小抄里没写过这几个开关（这台机器没有主进程那层桥，或者程序里第一次用）：拿页面自己存的那份顶上 */
    if(!A || typeof A.mediaFlag !== 'function'){
      let changed = false;
      for(const k of ['note', 'trans', 'off']){
        try{
          const v = await State.get('music-' + k, null);
          if(v == null) continue;
          const f = this.flagVal(k, v);
          if(f !== this.flags[k]){ this.flags[k] = f; changed = true; }
        }catch(e){}
      }
      if(changed) this.tell();
    }
    const vis = () => { if(!document.hidden) this.ask(); };
    document.addEventListener('visibilitychange', vis);
    this.sub(() => document.removeEventListener('visibilitychange', vis));
    /* 「改代码」存一次 = 重新 import 出一份全新的模块，它那份 booted 是全新的、够不着旧的那一份。
       旧的那一份没人喊停就永远留在页面上：每 4 秒替播放器追问一次位置，问回来的还照样掰基准 ——
       改几回代码，追问的份数越攒越多，进度被硬掰回去的次数也越多（外15 第 1 条：越放越窜）。
       宿主重载某一家之前会广播一句 pack:reload 并带上那一家的编号，这一家自己听见就把自己
       那几条订阅当场退掉。走的是 ctx.bus，不往 window 上挂东西。 */
    const rid = K && K.pack ? K.pack.id : '';
    if(K && K.bus && typeof K.bus.on === 'function' && rid){
      try{ K.bus.on('pack:reload', x => { if(String(x) === rid){ this.teardown(); volTeardown(); } }); }catch(e){}
    }
  },
  /* 记下欠下的退订，teardown 时一条一条还 */
  sub(off){ if(typeof off === 'function') this.offs.push(off); return off; },
  teardown(){
    clearTimeout(this.drift); clearTimeout(this.timer);
    this.drift = this.timer = null;
    clearTimeout(this.confirm); this.confirm = null;
    while(this.offs.length){ const f = this.offs.pop(); try{ f(); }catch(e){} }
    volTeardown();
    /* 封面那些图只在内存里：这一家收掉了要把手上那张撤干净，不然改几回代码就多攒几份没人认账的 */
    MusArt.clear();
  },
  /* 一个开关的原始值 → 页面里用的值：note/trans 认布尔（文件里是 1/0），off/sync 认整数，
     fs*（字号，百分比，100 = 照旧）和 fw*（粗细，0 = 不覆盖）也认整数 */
  flagVal(k, raw){
    if(k === 'off') return Math.max(-MUS_LAG_MS, Math.min(MUS_LAG_MS, Math.round(Number(raw) || 0)));
    if(k === 'sync') return Math.max(0, Math.round(Number(raw) || 0)) || 500;
    if(/^fs/.test(k)) return Math.max(60, Math.min(200, Math.round(Number(raw) || 0))) || 100;
    if(/^fw/.test(k)) return Math.max(0, Math.min(900, Math.round(Number(raw) || 0)));
    return raw !== false && raw !== 0 && raw !== '0' && raw !== 'false';
  },
  /* 广播里那份 flags（可能没有）盖上来，变了才说 */
  mergeFlags(f){
    if(!f || typeof f !== 'object') return false;
    let changed = false;
    for(const k of ['note', 'trans', 'off', 'sync', 'fsNote', 'fsMain', 'fsTrans', 'fwNote', 'fwMain', 'fwTrans']){
      if(!(k in f)) continue;
      /* 正拖着滑杆的时候别拿文件里那个旧数把它抢回去（松手那下 change 才写文件） */
      const ae = document.activeElement;
      if(k === 'off' && ae && ae.classList && ae.classList.contains('mu-lag-r')) continue;
      const v = this.flagVal(k, f[k]);
      if(v !== this.flags[k]){ this.flags[k] = v; if(k === 'off') this.gen++; changed = true; }
    }
    return changed;
  },
  /* 改一个开关：先就地生效（按钮当场变），再写小抄；这条通道没接上就落页面自己的 store */
  async flagSet(k, v){
    const val = this.flagVal(k, v);
    const old = this.flags[k];
    this.flags[k] = val;
    if(k === 'off') this.gen++;
    if(old !== val) this.tell();
    const A = musApp();
    if(A && typeof A.mediaFlag === 'function'){ try{ await A.mediaFlag(k, val); }catch(e){} return; }
    try{ await State.set('music-' + k, val); }catch(e){}
  },
  deadband(){ const n = Number(this.flags.sync); return n > 0 ? n : 500; },
  offsetMs(){ return Number(this.flags.off) || 0; },
  /* 歌词用的时刻 = 播放时刻整体往后挪 off 毫秒；进度条和读数不挪，挪了就跟播放器对不上 */
  lyricMs(){ return Math.max(0, this.nowMs() - this.offsetMs()); },
  /* 小抄变了（他自己改过 pin.txt、或插件写了新路径）：认一下，底部那行说明跟着换 */
  onPlayers(st){
    if(!st) return;
    const v = (st.pin !== undefined || st.mbPath !== undefined || st.music !== undefined) ? st : (st.state || {});
    const pin = String(v.pin || ''), p = String(v.mbPath || ''), md = String(v.music || '');
    let changed = false;
    if(pin !== this.pin){ this.pin = pin; changed = true; }
    if(md !== this.musicDir){ this.musicDir = md; MusLy.useDir(md); changed = true; }
    if(p !== this.songPath){
      this.songPath = p; this._song = null; changed = true;
      /* 路径是插件后写的，歌名先到：补一次这首歌的歌词，判过的结果不能接着赖着 */
      if(this.trackKey && MusLy.cache.delete(this.trackKey)) this.loadLyric();
    }
    /* 注音 / 翻译 / 偏移：另一端拨了开关，这边当场跟着变（同一份 music.txt） */
    if(this.mergeFlags(v.flags)) changed = true;
    if(changed) this.tell();
  },
  /* 正在放的那个文件 → 句柄形状（Flow-Desk 程序里才有；包一次留着，换歌再包） */
  songHandle(){
    const A = musApp();
    if(!this.songPath || !A || typeof A.mediaFile !== 'function') return null;
    if(!this._song || this._song.p !== this.songPath){
      const fh = A.mediaFile(this.songPath);
      this._song = fh ? { p:this.songPath, fh, dir:typeof A.mediaFolder === 'function' ? A.mediaFolder(this.songPath) : null } : null;
    }
    return this._song ? this._song.fh : null;
  },
  songFolder(){ this.songHandle(); return this._song ? this._song.dir : null; },
  hasBridge(){ const A = musApp(); return !!(A && typeof A.mediaState === 'function'); },
  /* Chromium 会给页面里 <audio> 的播放也注册一个 SMTC 会话：app 就是本程序，标题就是网页标题。
     那是我们自己放的那首，位置本来就由 audio 报上来，别让它把卡上的歌名盖成「Flow-Desk」。 */
  isSelf(st){
    const A = musApp();
    if(!A || !A.label) return false;
    const norm = s => String(s || '').toLowerCase().replace(/\.exe$/, '');
    return norm(st.app) === norm(A.label);
  },
  onBridge(d){
    if(!d) return;
    if(typeof d.msg === 'string') this.msg = d.msg;
    if(d.ev && d.ev.ev === 'bye') this.dead = true;
    /* 指定了却没开会话时 state 是空的，可 who / how / pin / list 还挂在 ev 上：照样认，底部那行得说真话 */
    const prov = d.ev || d.state;
    if(prov){
      if(typeof prov.how === 'string') this.how = prov.how;
      if(typeof prov.pin === 'string') this.pin = prov.pin;
      if(typeof prov.pinOk === 'boolean') this.pinOk = prov.pinOk;
      if(Array.isArray(prov.list)) this.list = prov.list;
    }
    /* 命令回显 / 重复事件都带着上一份快照，seq 没变就别拿它盖掉刚按下去的那一下。
       没带 seq 的对象根本不是快照（旧版 main 会把 {"ev":"cmd","ok":true} 当状态发过来），一律不 apply。 */
    if(d.state && typeof d.state.seq === 'number' && d.state.seq !== this.appliedSeq){ this.apply(d.state); return; }
    /* 会话断了（切歌那一瞬、播放器报 Changing、桥没连上）只撤会话和状态，pos / dur 留着。
       从前这里连 dur 一起清成 0：进度条当场归零、歌词跳回第一行，一秒后真值回来又跳回去 ——
       那就是「进度乱窜」（外15 第 1 条）。断没断由 live() 和状态那一行说，不归进度管。 */
    if(!d.state && d.ev && (d.ev.session === null || d.ev.ok === false)){ this.smtc = null; this.status = ''; }
    this.tell();
  },
  apply(st){
    if(this.isSelf(st)) return;
    const had = !!this.smtc, oldStatus = this.status;
    this.smtc = st; this.dead = false; this.appliedSeq = st.seq; this.snapAt = Date.now();
    /* 真值落过一次，上面那一问就不必了 */
    if(this.confirm){ clearTimeout(this.confirm); this.confirm = null; }
    const p = Math.max(0, Number(st.pos) || 0), wall = Number(st.at) || Date.now();
    /* 校准：状态没换、差又没过阈值（默认 0.5 秒）就接着走本地插值，不为一点来回抖；
       差过了阈值当场掰回播放器真值 —— 「歌词跑得比音乐快」就是这么被拽回来的。
       「状态没换」这一条认过渡态：播放器切歌、加载那一档报的是 Changing，光比字符串就不相等，
       闸门整个撤掉、pos 当场被那份旧值拽回去 —— 进度乱窜的另一条来路（外15 第 1 条）。 */
    const newStatus = String(st.status || '');
    const samePlay = newStatus === oldStatus || newStatus === 'Changing' || oldStatus === 'Changing' || !newStatus;
    /* 外27 己组：位置没动的那一份快照不带校准信息，别拿它换基准。
       SMTC 里存着的是播放器上一次推上来的位置（MusicBee 那座桥约每 2 秒推一次），而会话重扫、歌名变了、
       命令回显、还有我们自己问的那一次 snapshot，都会把这一份旧位置连同一个新墙钟一起送上来。
       拿它重锚就等于把钟往后拽 —— 拽多少正好是这份位置旧了多久：2026-10-07 那份只读探针实录到一张
       命令回显，位置停在 26660 一个字没动、墙钟已经走了 1,459 毫秒，基准一换歌词当场往回跳 1.5 秒，
       下一张真推送又把它拽回去 ——「播着播着不同步了，然后啪一下对上」就是这两下。
       判法只认「正在放 + 状态没翻 + 位置和上一张一模一样」；真在放而位置不动，那必然是旧值。 */
    const stalePos = had && samePlay && newStatus === 'Playing' && p === this.lastRawPos;
    this.lastRawPos = p;
    const guess = this.pos + (wall - this.at) * (this.rate || 1);
    const diff = Math.abs(p - guess);
    /* 刚拖过进度条：播放器往往要过几秒才把新位置报上来，那几秒里位置接着按点的那儿走，别的字段照收 */
    const seekHold = this.seekAt && Date.now() - this.seekAt < 8000 && diff > 2000;
    const inBand = had && samePlay && diff <= this.deadband();
    if(!stalePos && !seekHold && !inBand){
      this.pos = p; this.at = wall;
      /* 换了基准不等于重起渐变：只有这一趟是真断开才 gen++ —— 头一份快照、状态翻了
         （暂停再播要重起手）、或者一次掰过 JUMP_MS。桥每两秒推一次播放器真值，差个几百
         毫秒是常态，从前每趟都换号，正在唱那个字就被按新比例重摆再重新起手，看上去就是
         字色一跳、行首那个圆点闪一下。小差只挪基准，那一个字让 CSS 自己走完，下一个字边界自然对回来。 */
      if(!had || !samePlay || diff > JUMP_MS) this.gen++;
    }
    this.dur = Math.max(0, Number(st.dur) || 0);
    this.rate = Number(st.rate) || 1;
    this.status = String(st.status || '');
    this.title = String(st.title || ''); this.artist = String(st.artist || ''); this.album = String(st.album || '');
    this.app = String(st.app || ''); this.can = st.can || {};
    this.plan();
    const key = 'smtc|' + this.app + '|' + this.title + '|' + this.artist;
    if(key !== this.trackKey){ this.trackKey = key; this.lastRawPos = -1; this.loadLyric(); }
    this.tell();
  },
  /* 校准的两条腿。一条是播放器自己会推：MusicBee 那座桥每 2 秒推一次时间线，别的播放器看各自性子。
     另一条是这张一次性的表：4 秒里一个快照都没收到（有的播放器开场推一次就没下文了）才主动问一次，
     不然起点差那一点就得跟完整首歌。收到快照 apply 会重排它，推得勤这个表基本不响 —— 事件优先，页面里不装轮询。 */
  plan(){
    clearTimeout(this.drift); this.drift = null;
    if(this.audio || !this.smtc) return;
    if(this.status !== 'Playing' || !(this.dur > 0)) return;
    const end = (this.dur - this.pos) / (this.rate || 1);
    const wait = Math.max(300, Math.min(CALIB_BACK, end + 500));
    this.drift = setTimeout(() => {
      this.drift = null;
      if(Date.now() - this.snapAt < CALIB_BACK) return;
      this.ask();
      this.plan();
    }, wait);
  },
  ask(){ const A = musApp(); if(A && A.mediaCmd) try{ A.mediaCmd('snapshot'); }catch(e){} },
  live(){ return !!(this.smtc || this.audio); },
  playing(){ return this.audio ? !this.audio.paused : this.status === 'Playing'; },
  nowMs(){
    if(this.audio) return Math.round((this.audio.currentTime || 0) * 1000);
    /* 没有会话不等于唱回了开头：接着报最后知道的那一格，等下一份真值来对（外15 第 1 条） */
    if(!this.smtc) return this.pos || 0;
    if(this.status !== 'Playing') return this.pos;
    const t = this.pos + (Date.now() - this.at) * (this.rate || 1);
    return this.dur > 0 ? Math.min(t, this.dur) : t;
  },
  canDo(name){
    if(this.audio) return ['play', 'pause', 'toggle', 'seek', 'stop'].includes(name);
    if(!this.smtc) return false;
    const k = { play:'p', pause:'x', toggle:'t', next:'n', prev:'v', stop:'s', seek:'k' }[name];
    return !k || this.can[k] !== false;
  },
  async cmd(name, arg){
    if(this.audio){
      const a = this.audio;
      try{
        if(name === 'play' || (name === 'toggle' && a.paused)) await a.play();
        else if(name === 'pause' || name === 'toggle') a.pause();
        else if(name === 'stop'){ a.pause(); a.currentTime = 0; }
        else if(name === 'seek') a.currentTime = Math.max(0, Number(arg) || 0) / 1000;
        else toast('手动选择的音频在当前播放队列中没有上一首 / 下一首');
      }catch(e){ toast('播放控制没执行：' + ((e && e.message) || e)); }
      this.tell();
      return;
    }
    const A = musApp();
    if(!A || !A.mediaCmd){ toast('该页面未连接系统播放器'); return; }
    /* 先把界面按到按下去的那一格，再等回信。从前这两笔乐观更新写在 await 后面：手指一抬
       那道拖动闸门就清空了，回信落地之前的那一趟刷新读的还是旧位置 —— 进度条先弹回原处、
       再跳到新处，看上去就是「进度乱窜」（外15 第 1 条）。命令真没送到，末尾去问一次真值掰回来。 */
    if(name === 'seek'){ this.pos = Math.max(0, Number(arg) || 0); this.at = Date.now(); this.seekAt = Date.now(); this.gen++; this.plan(); }
    if(name === 'play' || name === 'pause' || name === 'toggle'){
      const want = name === 'play' ? true : name === 'pause' ? false : !this.playing();
      this.pos = this.nowMs(); this.at = Date.now(); this.gen++;
      this.status = want ? 'Playing' : 'Paused';
      this.plan();
      /* 乐观翻面之后必须有人来验：播放器状态没变就不会再推快照，那个谎就没人收 ——
         现场是 MusicBee 里装的还是旧插件、不读命令文件，按下播放以后进度条空跑了一整首
         （外17 甲-2）。所以过 700 毫秒没等到真值改口，就主动问一次快照，让真状态按回去；
         中途只要落过一份快照（apply）就说明真值来过了，这一问撤掉。 */
      clearTimeout(this.confirm); this.confirm = setTimeout(() => { this.confirm = null; this.ask(); }, 700);
    }
    this.tell();
    let r = { ok:true };
    try{ r = await A.mediaCmd(name, name === 'seek' ? (Number(arg) || 0) : 0); }
    catch(e){ r = { ok:false, msg:String((e && e.message) || e) }; }
    if(r && r.ok === false){ toast(r.msg || '命令未送达'); this.ask(); }
  },
  loadLyric(){ MusLy.load(this).catch(() => {}); },
  /* 这一棵里没有主进程那层桥（本地开发那台服务器）：选一个音频，位置问 <audio> 自己（它自己会发事件，不用我们问） */
  async useFile(fh){
    if(!this.audio){
      this.audio = new Audio();
      this.audio.preload = 'metadata';
      for(const ev of ['play', 'pause', 'ended', 'timeupdate', 'durationchange'])
        this.audio.addEventListener(ev, () => {
          if(ev === 'durationchange') this.dur = Math.round((this.audio.duration || 0) * 1000);
          this.tell();
        });
    }
    this.file = fh;
    const f = await fh.getFile();
    if(this.url) URL.revokeObjectURL(this.url);
    this.audio.src = this.url = URL.createObjectURL(f);
    this.title = fh.name.replace(/\.[^.]+$/, ''); this.artist = ''; this.album = ''; this.app = '';
    this.smtc = null;
    this.dur = 0; this.pos = 0; this.status = '';
    this.trackKey = 'file|' + fh.name;
    MusLy.audio = { fh, name:fh.name };
    MusLy.load(this);
    this.tell();
  },
  /* 重画节拍：下一次边界和 250ms 取早的那个，纯本地，一次都不问播放器 */
  pump(){
    clearTimeout(this.timer); this.timer = null;
    for(let i = MUS_VIEWS.length - 1; i >= 0; i--) if(!MUS_VIEWS[i].host.isConnected) MUS_VIEWS.splice(i, 1);
    if(!MUS_VIEWS.length || !this.live() || !this.playing()) return;
    let next = Date.now() + 250;
    for(const v of MUS_VIEWS){ const b = v.nextAt(); if(b < next) next = b; }
    if(this.dur > 0){ const stop = this.at + (this.dur - this.pos) / (this.rate || 1); if(stop < next) next = stop; }
    const wait = Math.max(30, Math.min(250, next - Date.now()));
    this.timer = setTimeout(() => this.tell(), wait);
  },
  tell(){
    for(const v of MUS_VIEWS.slice()){
      if(!v.host.isConnected){ const i = MUS_VIEWS.indexOf(v); if(i >= 0) MUS_VIEWS.splice(i, 1); continue; }
      try{ v.update(); }catch(e){}
    }
    /* 顺手把时钟递给页面上那一个公共的钟（_shared/sh-mus.js）：词格那一档要跟的就是这一份。
       只递位置 + 那一刻的墙钟 + 倍速这三样，读的一头自己插值，算法与这边 nowMs() 同一套。 */
    try{ K.mus && K.mus.set({ pos:this.pos, at:this.at, rate:this.rate, status:this.status,
      title:this.title, artist:this.artist, dur:this.dur }); }catch(e){}
    this.pump();
  }
};

/* ---------- 六、歌词从哪来 ---------- */
const MusLy = {
  dir:null, dirPath:'', dirName:'', files:[], handles:new Map(), scanned:false,
  manual:null, manualName:'',
  audio:null,          /* 手动选的音频：内嵌歌词直接从这里读 */
  doc:null, docKey:'', src:'',
  cache:new Map(),
  loadSeq:0,

  async restore(){
    if(this.rest) return;
    this.rest = true;
    try{
      const hd = await State.get('music-dir', null);
      /* 小抄里已经指过目录（dirPath）就别碰 this.dir —— 那是 useDir() 刚包好的句柄，
         覆盖成 null 会让「同目录同名」和穿透子文件夹一起熄火 */
      if(!this.dirPath && !this.dir) this.dir = (hd && typeof hd.values === 'function') ? hd : null;
      if(!this.dirPath) this.dirName = (await State.get('music-dir-name', '')) || (this.dir && this.dir.name) || '';
      const mh = await State.get('music-ly', null);
      if(!this.manual) this.manual = (mh && typeof mh.getFile === 'function') ? mh : null;
      if(!this.manualName) this.manualName = (await State.get('music-ly-name', '')) || (this.manual && this.manual.name) || '';
    }catch(e){ /* 读小抄失败不影响已经指好的目录 */ }
  },
  async pickDir(){
    const A = musApp();
    /* Flow-Desk 程序里：让主进程弹原生对话框，挑完写进 musicdir.txt —— FD 卡和 WNW 停靠读的是同一行 */
    if(A && typeof A.mediaDirPick === 'function'){
      let r = null;
      try{ r = await A.mediaDirPick(); }catch(e){ toast('文件夹未打开' + ((e && e.message) || e)); return; }
      if(!r || r.ok === false){ toast(r && r.msg || '文件夹选择失败'); return; }
      if(!r.music) return;                       /* 取消了：原来指的那个接着用 */
      Music.musicDir = r.music;
      this.useDir(r.music);
      return;
    }
    let dir = null;
    try{ dir = await window.showDirectoryPicker({ id:'music-dir' }); }
    catch(e){ return; }
    this.dir = dir; this.dirName = dir.name || ''; this.dirPath = '';
    this.files = []; this.handles = new Map(); this.cache = new Map(); this.scanned = false;
    State.set('music-dir', dir); State.set('music-dir-name', this.dirName);
    await Music.loadLyric();
    Music.tell();
  },
  /* 小抄里那一行音乐文件夹 → 目录句柄。换目录 = 之前扫出来的那份清单和判过的结果全部作废 */
  useDir(p){
    const A = musApp();
    const path = String(p || '').trim();
    const dir = path && A && typeof A.mediaDirHandle === 'function' ? A.mediaDirHandle(path) : null;
    if(!path){
      if(!this.dirPath) return;
      this.dirPath = ''; this.dir = null; this.dirName = '';
    }else{
      if(!dir || path === this.dirPath) return;
      this.dirPath = path; this.dir = dir;
      this.dirName = path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || path;
    }
    this.files = []; this.handles = new Map(); this.cache = new Map(); this.scanned = false;
    Music.loadLyric(); Music.tell();
  },
  async pickLyric(){
    let fh = null;
    try{
      const [h] = await window.showOpenFilePicker({ multiple:false,
        types:[{ description:'歌词', accept:{ 'text/plain':['.ttml', '.lrc', '.elrc', '.txt'] } }] });
      fh = h;
    }catch(e){ return; }
    this.manual = fh; this.manualName = fh.name;
    State.set('music-ly', fh); State.set('music-ly-name', fh.name);
    this.cache = new Map();
    await Music.loadLyric();
    Music.tell();
  },
  clearLyric(){
    this.manual = null; this.manualName = '';
    State.set('music-ly', null); State.set('music-ly-name', '');
    this.cache = new Map();
    Music.loadLyric(); Music.tell();
  },
  /* 穿透子文件夹：歌常常按专辑/歌手分了一层又一层，只扫顶层等于没扫。
     浅层先进来（同名文件算浅层那份），最深 6 层、总共 8000 个封顶，够任何一台机器的曲库了 */
  async list(){
    if(!this.dir) return;
    if(this.scanned) return;
    this.scanned = true;
    await this.walk(this.dir, 0);
  },
  async walk(dir, depth){
    if(depth > 6 || this.files.length >= 8000) return;
    for await (const fh of dir.values()){
      if(this.files.length >= 8000) return;
      if(fh.kind === 'directory'){
        if(!fh.name || fh.name.charAt(0) === '.') continue;
        await this.walk(fh, depth + 1);
        continue;
      }
      if(fh.kind !== 'file' || this.handles.has(fh.name)) continue;
      this.files.push(fh.name);
      this.handles.set(fh.name, fh);
    }
  },
  /* 往目录里放了新歌词文件后重扫一遍：连同判过的结果一起忘掉 */
  async rescan(){
    this.files = []; this.handles = new Map(); this.cache = new Map(); this.scanned = false;
    await Music.loadLyric();
    Music.tell();
  },
  async readText(fh){
    if(!fh) return '';
    try{
      const size = await MusBin.size(fh);
      if(!size || size > 8 * 1024 * 1024) return '';
      const f = await fh.getFile();
      return await f.text();
    }catch(e){ return ''; }
  },
  take(key, doc, src){
    this.doc = doc; this.docKey = key; this.src = src; this.cache.set(key, { doc, src });
    Music.tell();
  },
  /* 换歌不在开头先把上一首的歌词抹掉。找一份歌词要读内嵌、扫目录、最多比对三份同名文件，
     这一百来毫秒里卡上原本是一片空的：换歌看着就是「先闪一下空白再出来」，卡片那一格的
     高度也跟着塌一次再撑回来。现在改成旧的先摆着，新的到手那一次才整棵树换上 —— 只换一次。
     连切几首时先出发的那一份可能后回来，用号数认：不是最新那一趟的结果就丢掉。 */
  async load(tr){
    await this.restore();
    const key = tr.trackKey;
    const seq = ++this.loadSeq;
    const stale = () => seq !== this.loadSeq;
    if(!key){ this.doc = null; this.docKey = ''; this.src = ''; Music.tell(); return; }
    const hit = this.cache.get(key);
    if(hit){ this.doc = hit.doc; this.docKey = key; this.src = hit.src; Music.tell(); return; }
    /* 手动选的那份永远算数，排在所有自动规则前面 */
    if(this.manual){
      const t = await this.readText(this.manual);
      const d = t && parseLyric(t);
      if(d){ if(stale()) return; this.take(key, d, '手动选的歌词：' + this.manualName); return; }
    }
    /* 每一份都先收着，按拍好的档次挑：ttml > 逐字 lrc > 增强 lrc > 逐行 lrc，同档内嵌赢外置 */
    const cand = [];
    const rank = c => MUS_FMT[c.doc.fmt || 'plain'] * 2 + (c.embed ? 1 : 0);
    const addEmbed = async (fh, name) => {
      if(!fh) return;
      const emb = await MusEmb.from(fh, name);
      if(!emb) return;
      const d = parseLyric(emb.text);
      if(d) cand.push({ doc:d, src:emb.from + '（' + name + '）', embed:true });
    };
    /* 内嵌：先看手上这份音频（这台机器上自己选出来的那份），再看小抄报的那一个文件，最后看目录里配出来的那份 */
    if(this.audio) await addEmbed(this.audio.fh, this.audio.name);
    const song = Music.songHandle();
    if(song) await addEmbed(song, song.name);
    await this.list();
    const score = n => musScore(n, tr.title, tr.artist);
    let audio = '', audioS = 0;
    for(const n of this.files){ if(!MUS_AUDIO.includes(n.toLowerCase().split('.').pop())) continue; const s = score(n); if(s > audioS){ audioS = s; audio = n; } }
    if(audio && audioS >= 4) await addEmbed(this.handles.get(audio), audio);
    /* 同名歌词文件：并列最高分的几份都读进来比（一份 .lrc 一份 .ttml 时，档次说了算） */
    const outs = [];
    for(const n of this.files){ if(!MUS_LYRIC.includes(n.toLowerCase().split('.').pop())) continue; const s = score(n); if(s >= 4) outs.push({ n, s }); }
    outs.sort((a, b) => b.s - a.s);
    for(const o of outs.slice(0, 3)){
      const t = await this.readText(this.handles.get(o.n));
      const d = t && parseLyric(t);
      if(d) cand.push({ doc:d, src:'同目录同名：' + o.n, embed:false });
    }
    /* 正在放的那一首旁边：同名换个后缀就是歌词，没指音乐目录也认（这一条走的是播放器报上来的路径） */
    const sdir = Music.songFolder();
    if(song && sdir){
      const bn = song.name.replace(/\.[^.]+$/, '');
      for(const x of MUS_LYRIC){
        let fh = null;
        try{ fh = await sdir.getFileHandle(bn + '.' + x); }catch(e){ continue; }
        const t = await this.readText(fh);
        const d = t && parseLyric(t);
        if(d) cand.push({ doc:d, src:'同目录同名：' + fh.name, embed:false });
      }
    }
    if(cand.length){
      if(stale()) return;
      let best = cand[0];
      for(const c of cand) if(rank(c) > rank(best)) best = c;
      this.take(key, best.doc, best.src);
      return;
    }
    if(stale()) return;
    /* 这一首确实没有歌词：到这一步才把上一首那份撤掉，并且记下「这份对应的就是当前这一首」 */
    this.doc = null; this.docKey = key;
    const who = audio || (song ? song.name : '');
    const ext = who ? who.toLowerCase().split('.').pop() : '';
    this.src = !this.dir && !song
      ? (this.audio ? '这首歌里面没有歌词文本，选一选歌词文件'
        : '没指音乐目录，读不到歌词 —— 点这个卡上的齿轮设置指一个音乐文件夹，或者展开整页点「选一个文件夹」')
      : who
      ? (['m4a', 'mp4', 'mkv', 'webm'].includes(ext)
        ? '这首歌的歌词在内嵌字幕轨里 —— 这种轨不读，放同名 .ttml / .lrc 就行'
        : '读到了音频，但里面没有歌词文本')
      : '目录里没有「' + (tr.title || '当前这首歌') + '」';
    Music.tell();
  }
};
/* 文件名 ↔ 歌名·艺人：归一化后比，够像才算同一首 */
function musNorm(s){
  return String(s || '').toLowerCase().replace(/[^0-9a-z\u4e00-\u9fff\uac00-\ud7af\u3040-\u30ff]+/g, '');
}
function musScore(name, title, artist){
  const a = musNorm(name.replace(/\.[^.]+$/, '')), t = musNorm(title), r = musNorm(artist);
  if(!a || !t) return 0;
  if(a === t) return 6;
  if(a.startsWith(t) || a.endsWith(t)) return 5;
  if(a.includes(t) || (t.includes(a) && a.length >= 4)) return 4;
  if(r && a.includes(r) && a.length >= 3) return 2;
  return 0;
}

/* ---------- 七、界面 ---------- */
/* 播放器名：路径和 .exe 都剥掉，卡上只留认得出的那一截 */
function musPlayer(app){
  const s = String(app || '').replace(/[\\/]+$/, '');
  if(!s) return '';
  return s.split(/[\\/]/).pop().replace(/\.(exe|app)$/i, '');
}
/* 状态说人话：进度条在走 + 这句「播放中」，才看得出来是真在放 */
const MUS_ST = { Playing:'播放中', Paused:'暂停', Stopped:'停了', Changing:'切换中', Opened:'刚打开' };
/* 谁在放这首歌 —— 自动挑的、指定的、还是自己喂的音频 */
function musWho(){
  if(Music.audio) return '自己选的音频';
  const p = musPlayer(Music.app);
  if(!p) return '';
  const how = Music.how === 'pin' ? '指定的播放器' : '自动挑的播放器';
  return p + '（' + how + (Music.status ? ' · ' + (MUS_ST[Music.status] || Music.status) : '') + '）';
}
/* 四个控制键：Word 那种纯线条图标，只描边不填充，颜色跟着字色走 */
const MUS_ICO = {
  prev:'M4.5 4 L4.5 14 M16 4 L8.5 9 16 14 Z',
  next:'M15.5 4 L15.5 14 M4 4 L11.5 9 4 14 Z',
  play:'M6 3.5 L15.5 9 6 14.5 Z',
  pause:'M6.5 4 L6.5 14 M12.5 4 L12.5 14',
  /* 注音 = 一条横线（歌词那行）上头三个注音符；翻译 = 文 / A，跟 Chrome 那个换语言记号同一个意思 */
  note:'M4 13.8 L16 13.8 M6.6 4.6 L6.6 9.8 M10 4.6 L10 9.8 M13.4 4.6 L13.4 9.8',
  trans:'M7.4 3.6 L7.4 4.8 M4.2 6.6 L10.6 6.6 M8.9 7.8 L4.7 14 M6.6 9 L10.3 14' +
        ' M13.1 14 L15.2 7.9 17.3 14 M13.9 11.8 L16.5 11.8',
  /* 系统音量：喇叭 + 两道音波；静音：喇叭 + 一个叉 */
  vol:'M3.5 7 L3.5 11 L6.5 11 L10.5 14.5 L10.5 3.5 L6.5 7 Z M13 6.5 Q15 9 13 11.5 M15.4 4.2 Q18.2 9 15.4 13.8',
  mute:'M3.5 7 L3.5 11 L6.5 11 L10.5 14.5 L10.5 3.5 L6.5 7 Z M13.5 6.8 L18.5 11.8 M18.5 6.8 L13.5 11.8'
};
function musIcoMarkup(d){
  return '<svg class="mu-ico" viewBox="0 0 20 18" aria-hidden="true">' +
    '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.6" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
/* 拿不到内嵌封面时摆的那张音符：一个实心符头 + 一根符杆 + 一面符尾，和上面那排出厂线稿同一个口径。
   这一段只写在文件里，界面上画一画就完 —— 不另开一张图片文件、不从网上取，也不写进音乐文件。
   单色，颜色吃 --text-light（那一排淡档字色），不拟物、不渐变、不阴影 */
const MUS_ART_NOTE = '<svg class="mu-art-note" viewBox="0 0 20 18" aria-hidden="true">'
  + '<ellipse cx="7.4" cy="12.8" rx="4" ry="2.9" transform="rotate(-20 7.4 12.8)" fill="currentColor"/>'
  + '<path d="M10.7 12.4 L10.7 3.1 L11.8 3.1 L11.8 12.4 Z" fill="currentColor"/>'
  + '<path d="M11.8 3.1 C14.9 3.9 16.5 5.9 16 8.8 C15.6 6.6 14.2 5.2 11.8 4.7 Z" fill="currentColor"/>'
  + '</svg>';
/* 声部名单：按文件里第一次出现的先后排，第 0 号用强调色、往后依次掺字色。
   只有一个声部（或整首没标 ttm:agent）时返回空 —— 那时界面上不摆声部标记。 */
function musVoices(d){
  const ag = d && d.agents;
  if(!ag) return [];
  const ids = [];
  for(const L of d.lines) if(L.agent && ids.indexOf(L.agent) < 0) ids.push(L.agent);
  if(ids.length < 2) return [];
  return ids.map((id, i) => ({ id, i, name:String((ag[id] && ag[id].name) || '').trim() || ('声部 ' + (i + 1)) }));
}
/* ---------- 系统音量（两端共用一份状态） ----------
   滑杆动的是 Windows 系统主音量，不是页面里某个音频的旋钮：主进程常驻的音量监视器
   读写的是系统本身，硬件音量键、托盘合成器、别的程序改音量都会由系统推事件回来 —— 页面不轮询。
   拖动时每一格都报最新值，主进程 90 毫秒合并写一次；显示值以系统的回声为准。
   静音那档：系统接口对「静音」不发事件（微软的接口就这样），所以这边下命令、那边回声一条
   最新状态；别的程序动的静音跟着下一次音量事件或下一次一次性读取补上。 */
const Vol = { ok:false, msg:'', vol:null, muted:false, fans:[] };
let volBooted = false, volOff = null;
function volApply(d){
  if(!d) return;
  Vol.ok = !!d.supported; Vol.msg = String(d.msg || '');
  if(d.state){ Vol.vol = Math.max(0, Math.min(100, Math.round(Number(d.state.vol) || 0))); Vol.muted = !!d.state.muted; }
  for(const fn of Vol.fans.slice()){ try{ fn(); }catch(e){ console.error(e); } }
}
function volBoot(){
  if(volBooted) return;
  const A = musApp();
  if(!A || typeof A.volGet !== 'function' || typeof A.volOn !== 'function') return;
  volBooted = true;
  try{ volOff = A.volOn(volApply); }catch(e){}
  try{ A.volGet().then(volApply).catch(() => {}); }catch(e){}
}
/* 和 Music.teardown 同一个道理：这一家重载之后，旧那一份要把音量那条订阅退掉 ——
   不然每改一回代码就多一份常驻订阅，往同一批界面上刷同一件事 */
function volTeardown(){
  if(typeof volOff === 'function'){ try{ volOff(); }catch(e){} }
  volOff = null; volBooted = false;
}
/* 摊开／收回的两道线（像素）：进 300、出 240，不写一道 —— 展开那一副本身就比小卡高，
   量到的高度会自己把自己顶过线，一道线会叫它在两档之间来回弹。 */
const MUS_IN = 300, MUS_OUT = 240;
class MusicView{
  constructor(host, ctx){
    this.host = host;
    this.full = !!(ctx.expanded || ctx.where === 'pane');
    /* 外32 图9（作者：「音乐遥控器拖大就在首页原地摊开」）：桌面上这一张卡归卡高说了算。
       开机、拖完那一下重新挂上来时先照此刻的卡高定档 —— 观察器那第一趟要等一次渲染更新才送到，
       等它就先铺错一档。宿主递来的挂载上下文里只有 expanded 这一位（见 _fd/src/fd8-tools.js 的 native 那一段），
       所以量的是节点，不是格数。 */
    if(ctx.where === undefined && !this.full && host.clientHeight >= MUS_IN) this.full = true;
    this.li = -1; this.wi = -1;
    /* 上一次为「正在唱这一行」滚过去的是第几行：叠着唱收口那一下手会落回还在唱的前一行，
       那一落不许再把整列往回拽（外32 图10 的「弹动」就是这个来回） */
    this.滚到 = -1;
    /* 记下当前这一行是在哪一版时间基准上认下的：基准换了号（拖条、换歌、暂停再播、一次掰过 JUMP_MS）
       就是人在真翻，歌词跟着往回走；没换号的那几百毫秒回退是校准，不算 */
    this.liGen = -1;
    this.cache = {};
    this.list = null; this.rows = [];
    this.stick = 0;
    /* 打字机那一趟：每帧只写一个 scrollTop，crawlTo 是这一帧该落的格子，
       给 scroll 事件认「这一趟是我们自己发的」用 */
    this.crawling = 0; this.crawlTo = null; this.padHalf = -1;
    /* 一段 = 一行成为当前那一刻 → 下一趟换行那一刻；segKey 是「这一段开过没有」的记号，geo 是这一段的两个头和两个时刻 */
    this.segKey = ''; this.geo = null;
    /* 这一句内已经走到哪儿的记号：换段或换基准才重摆，时间被校准往回拽时不带着它退 */
    this.crawlKey = ''; this.crawlP = 0;
    this.cover = null; this.artUrl = '';
    /* 丙：手动字号/粗细只放开展屏那一屏和为写右栏停靠那一档 —— Flow-Desk 桌面上那一张小卡
       维持「照卡片大小自动缩」，不给他手动调（2026-10-05 他定的：「算了，卡片就用现在的确定大小吧」）。
       这一位不成立时 typeVars 一个变量都不写，CSS 里那些 var(--mu-fs-*,1) 就全按 1 落回原样。
       外32 图9 之后桌面上这一张拖过线会原地摊开成整页那一副 —— 那一副就是 full，那两根跟着放开，
       收回小卡又照自动缩，跟这一条不冲突。 */
    this.typed = this.full || ctx.where === 'dock';
    /* ③ 记一笔「这一张是挂在为写右栏停靠里的」：那一栏多宽归停靠自己定，窄的时候整页那一套
       为封面列做的居中补偿会把歌词挤扁，CSS 要按这一位分档。 */
    this.inDock = ctx.where === 'dock';
    /* 丁-2 立的是停靠那一条：缩到哪一档由面板高度说 —— 拖高了就摊开成整页那一副
       （歌词一列一列往下摆、打字机那一趟跟着走），拖矮了收回小卡。
       外32 图9 把同一条规矩也交给 FD 桌面上那一张（作者：「音乐遥控器拖大就在首页原地摊开」）：
       从前桌面这一张只看外壳那一档「占到整块栅格四分之一面积」才算展开（64×36 的 25% = 576 格，
       比如 24×24），而它出厂只有 16×7 = 112 格 —— 拖到能看的大小也够不着那条线，看着就是这一档没了。
       数还是停靠那一对（MUS_IN / MUS_OUT），不另起一把尺。整页那一屏（pane）本来就 full，不挂观察器。
       拖这一趟外壳会整屏重画、把这一张重新挂一遍，所以顶上那句先照此刻卡高把档定对，
       这里只管挂上之后的增减。 */
    this.ro = null;
    const 看大小 = (ctx.where === 'dock' || ctx.where === undefined);
    if(看大小 && typeof ResizeObserver !== 'undefined'){
      this.ro = new ResizeObserver(() => {
        const hh = this.host.clientHeight;
        const want = this.full ? hh >= MUS_OUT : hh >= MUS_IN;
        if(want === this.full) return;
        this.full = want;
        /* 手动字号那一档跟着 full 走：桌面上这张一摊开就是整页那一副，该给得动那两根滑杆 */
        this.typed = this.full || ctx.where === 'dock';
        this.lyKey = '';
        this.draw();
      });
      this.ro.observe(this.host);
    }
  }
  dispose(){
    if(this.ro){ try{ this.ro.disconnect(); }catch(e){} this.ro = null; }
    /* 收摊先把打字机那一趟停掉：这一趟是照着 this.list 排的，卡撤了还一帧帧写就没人认账了 */
    if(this.crawling){ try{ cancelAnimationFrame(this.crawling); }catch(e){} }
    this.crawling = 0; this.crawlTo = null; this.padHalf = -1;
    this.rows = [];
    this.list = null;
    /* 音量状态那份广播撤卡要销掉，不然卡没了 paint 还挂着、引用着一堆旧节点 */
    if(this.volOff){ try{ this.volOff(); }catch(e){} this.volOff = null; }
  }
  /* 下一次该重画的时刻：歌词的字/行边界和行尾，算完再换算成墙上时钟 —— pump 拿的是"几点钟"，
     这里读回来的是"歌里第几毫秒"，不换算的话差值永远是负数，重画会一路挤成 30ms 一趟 */
  nextAt(){
    const d = MusLy.doc;
    if(!d || !d.timed) return Infinity;
    const base = Date.now(), t = Music.lyricMs();
    let best = Infinity;
    const L = d.lines[this.li];
    if(L){
      for(const w of L.words) if(w.ms > t && w.ms < best) best = w.ms;
      if(L.note) for(const w of L.note) if(w.ms > t && w.ms < best) best = w.ms;
      if(L.ms2 > t && L.ms2 < best) best = L.ms2;
    }
    const after = d.lines.slice(this.li + 1).find(x => x.ms > t);
    if(after && after.ms < best) best = after.ms;
    if(!isFinite(best)) best = t + 2000;
    return base + (best - t);
  }
  draw(){
    const host = this.host;
    /* 重画先把文本那本小账清掉（外27 图4：展开那一档开头不见了歌名歌手）。
       setText 是「和上次一样就一个字都不写」，可这一趟把节点全换成新的了 —— 小账里那句「已经写过」
       对着的是一堆摘下来的旧节点，新节点上什么都没有，行就空着：换歌、拖进度条这些改动文字的还能写上，
       歌名歌手一个字没变，就永远写不上。收起再展开、停靠拖过那一档，走的都是这条路。 */
    this.cache = {};
    /* 审查第 20 条当场判完：同一形状的账还有四本 —— rows / lyKey / btnKey / toolKey 三本没问题
       （rows 由 repaint 整批重建，lyKey 在末尾钉成 null 逼它重建，btnKey/toolKey 是这一趟现设的），
       只有 typeSig 这一本和上面那本是同一个病：字号粗细没改过就一个变量都不写，
       可这一趟的 .mu 是新的，那些 --mu-fs-* 落不到它身上 —— 重画一次，手动调过的三档字号当场回到默认。 */
    this.typeSig = '';
    host.innerHTML = '';
    const wrap = h('div', { class:'mu' + (this.full ? ' mu-full' : ' mu-mini') + (this.inDock ? ' mu-dock' : '') });
    /* 专辑封面：方形，占一整列摆在这一块的最左边，顶到歌名那一行。三种长相共用这一个摆法
       （FD 桌面小卡和为写右栏停靠都走 .mu-mini，整页走 .mu-full，大小各跟各那一档的字号）
       一开始只摆那张音符，不摆一块灰 —— 内嵌图认回来才换上，换歌先撤掉 */
    this.cover = h('div', { class:'mu-cover mu-ph', 'aria-hidden':'true', html:MUS_ART_NOTE });
    this.artUrl = '';
    /* 歌名 + 艺人 */
    this.tEl = h('div', { class:'mu-t' });
    this.aEl = h('div', { class:'mu-a' });
    wrap.appendChild(h('div', { class:'mu-id' }, [this.tEl, this.aEl]));
    /* 控制 + 进度条：上一首 / 播放暂停（一个，看当前状态换图标）/ 下一首，再加两个显隐开关 */
    const btn = (label, cmd, d) => h('button', { class:'mu-btn', 'data-look-ctl':'', title:label, 'aria-label':label,
      html:musIcoMarkup(d), onclick:() => Music.cmd(cmd) });
    this.bPrev = btn('上一首', 'prev', MUS_ICO.prev);
    this.bTog = btn('播放 / 暂停', 'toggle', MUS_ICO.play);
    this.bNext = btn('下一首', 'next', MUS_ICO.next);
    /* 注音 / 翻译：卡片顶那一排两个，FD 卡和 WNW 停靠共用同一份开关（players\music.txt） */
    this.bNote = this.flagBtn('note', '注音');
    this.bTrans = this.flagBtn('trans', '翻译');
    /* 连不上系统播放器时才有这个：手动喂一个音频 */
    this.bPick = h('button', { class:'mu-btn mu-pick', 'data-look-ctl':'', 'data-look-edge':'', onclick:() => this.pickAudio() }, '手动选择音频');
    /* 系统音量：滑杆 + 一键静音，摆在同一排（没有主进程音量通道时这一段整个不摆） */
    this.volWrap = this.volumeField();
    this.btns = h('div', { class:'mu-btns' });
    wrap.appendChild(this.btns);
    this.setButtons();
    this.fill = h('div', { class:'mu-fill' });
    this.bar = h('div', { class:'mu-bar' }, this.fill);
    this.time = h('span', { class:'mu-time' });
    const row = h('div', { class:'mu-bar-row', 'data-nograb':'1' }, [this.bar, this.time]);
    this.bindBar();
    wrap.appendChild(row);
    /* 演唱者一行：摆在进度条和歌词之间。ttml 里标了声部就报声部（对唱那两个并列），
       没标的文件报这首歌的艺人 —— 这一行永远说得出「现在是谁在唱」 */
    this.whoEl = h('div', { class:'mu-who' });
    wrap.appendChild(this.whoEl);
    /* 当前句 / 整页歌词 */
    if(this.full){
      this.list = h('div', { class:'mu-list', 'data-nograb':'' });
      /* 只有「真的滚了」才算接管。从前这一条认的是按下：点一行看仔细（点行本来就不跳转）
         也被当成接管，8 秒内歌词不跟、8 秒后一步猛冲 —— 那就是「歌词乱跳」里最难看的那一下
         （外15 第 1 条）。自己发起的那趟 smooth 也会一路发 scroll，靠 autoTo 那一段认出来，
         不算用户接管。滚轮那一条留着：它一定意味着人在翻。 */
      this.list.addEventListener('wheel', () => { this.stick = Date.now(); }, { passive:true });
      /* 「人在翻」和「我们自己那趟动画」发的都是同一个 scroll 事件，只能按走向分：
         越滚越靠近落点 = 我们自己那趟，不算接管；离落点越走越远 = 人在拖，这一趟才算。
         从前认的是「离上次发起不到 900 毫秒」这种时间窗 —— smooth 那一趟一跑过 900 毫秒，
         自己的尾巴就被判成人在翻，于是 2.5 秒不跟，下一趟隔着一整屏走 far 那条立即落位：
         憋一下然后猛冲，正是「歌词乱跳」里最难看的那一下。 */
      this.list.addEventListener('scroll', () => {
        const t = this.list.scrollTop, to = this.crawlTo != null ? this.crawlTo : this.autoTo;
        if(to == null){ this.stick = Date.now(); return; }
        /* 打字机那一趟每帧都在写新的落点，所以它不需要谁替它清账：离落点近就是自己 */
        if(Math.abs(t - to) < 24){ if(this.crawlTo == null) this.autoTo = null; return; }
        if(Math.abs(t - to) > Math.abs((this.lastTop == null ? to : this.lastTop) - to)) this.stick = Date.now();
        this.lastTop = t;
      }, { passive:true });
      this.toolsEl = h('div', { class:'mu-tools' });
      wrap.appendChild(this.toolsEl);
      /* 丙：「字」那一枚开合的面板，摆在工具排和歌词之间 —— 改一档字眼看一行，不用关框再看。 */
      this.typeEl = h('div', { class:'mu-typep' });
      wrap.appendChild(this.typeEl);
      wrap.appendChild(this.list);
      this.setTools();
    }else{
      /* 卡片就四块：歌名艺人、控制（含注音翻译两个开关）、进度条、当前句 —— 挑目录选歌词这些整页才摆。
         当前句这一格挂 data-nograb：歌词那一片按下去只归歌词自己（看字、等它自己换行），
         不顶着手把它当成拖卡片的起点；卡片要挪去标题和控制那一排按。 */
      this.cur = h('div', { class:'mu-cur', 'data-nograb':'' });
      wrap.appendChild(this.cur);
    }
    this.srcEl = h('div', { class:'mu-src' });
    wrap.appendChild(this.srcEl);
    /* 外面这一层只管横着排：左边封面一整列，右边还是原来那一竖列，一个字没动 */
    this.shell = h('div', { class:'mu-shell' + (this.full ? ' mu-shell-full' : '') + (this.inDock ? ' mu-dock-shell' : '') }, [this.cover, wrap]);
    host.appendChild(this.shell);
    this.wrap = wrap;
    this.lyKey = null;
    this.update();
  }
  setButtons(){
    this.btnKey = Music.smtc ? 's' : 'f';
    this.btns.innerHTML = '';
    this.btns.append(this.bPrev, this.bTog, this.bNext, this.bNote, this.bTrans);
    if(this.btnKey === 'f') this.btns.append(this.bPick);
    if(this.volWrap) this.btns.append(this.volWrap);
  }
  /* 一个显隐开关：图标 button，关着就淡下去，按下去改的是那一行小抄（两端一起变） */
  flagBtn(which, label){
    const b = h('button', { class:'mu-btn mu-flag', 'data-look-ctl':'', title:label + '：开', 'aria-label':label,
      html:musIcoMarkup(MUS_ICO[which]), onclick:() => Music.flagSet(which, !Music.flags[which]) });
    b.dataset.k = which;
    return b;
  }
  /* 两个开关的亮暗：只看那一份共用状态，谁改的都一样 */
  /* 丙：把那六个数落成这一块自己的 CSS 变量。写在 .mu 身上不是写在全页身上 ——
     FD 桌面那张、为写停靠那张、整页那一屏各拿一份，谁调都不串到别人那儿去。
     update 那一趟每 250ms 走一次，所以先比一个签名，数没变就一个属性都不碰。 */
  typeVars(){
    if(!this.wrap || !this.typed) return;
    const f = Music.flags;
    const sig = MUS_TYPE.map(t => f[muFlag('fs', t[0])] + '/' + f[muFlag('fw', t[0])]).join('|');
    if(sig === this.typeSig) return;
    this.typeSig = sig;
    for(const t of MUS_TYPE){
      this.wrap.style.setProperty('--mu-fs-' + t[0], (f[muFlag('fs', t[0])] || 100) / 100);
      this.wrap.style.setProperty('--mu-fw-' + t[0], f[muFlag('fw', t[0])] > 0 ? String(f[muFlag('fw', t[0])]) : 'inherit');
    }
  }
  syncFlags(){
    for(const b of [this.bNote, this.bTrans]){
      if(!b) continue;
      const on = !!Music.flags[b.dataset.k];
      const label = b.dataset.k === 'note' ? '注音' : '翻译';
      b.classList.toggle('mu-dim', !on);
      const t = label + '：' + (on ? '开' : '关');
      if(b.title !== t){ b.title = t; b.setAttribute('aria-label', t); }
    }
  }
  toolSig(){
    return (!Music.smtc ? 'f' : 's') + (Music.audio ? 'a' : '') + '|' + MusLy.dirName + '|' + MusLy.manualName;
  }
  setTools(){
    if(!this.full || !this.toolsEl) return;
    this.toolKey = this.toolSig();
    const b = (label, onclick) => h('button', { class:'wnw-btn mini', onclick }, label);
    const out = [];
    /* 连不上系统播放器就自己喂一个音频，喂完还能换 */
    if(!Music.smtc) out.push(b(Music.audio ? '换音频' : '选音频', () => this.pickAudio()));
    out.push(b(MusLy.dirName ? '音乐目录：' + MusLy.dirName : '指一次音乐目录', () => MusLy.pickDir()));
    if(MusLy.dirName) out.push(b('重扫目录', () => MusLy.rescan()));
    out.push(b(MusLy.manual ? '换歌词文件：' + MusLy.manualName : '选歌词文件', () => MusLy.pickLyric()));
    if(MusLy.manual) out.push(b('不用手动歌词', () => MusLy.clearLyric()));
    /* 丙：那六个控件从前只藏在齿轮那一框里 —— 整页这一屏调字得先收起来再点齿轮，
       改一档看一行要开合一趟。这里就地给一枚「字」，面板与对话框同一份构造。 */
    this.bType = b('字', () => this.typePanel());
    this.bType.title = '调三档字的字号与粗细（注音 / 原文 / 翻译）';
    if(this.typeEl && this.typeEl.classList.contains('on')) this.bType.classList.add('on');
    out.push(this.bType);
    /* 歌词比音乐快还是慢：往右是把整首歌词往后挪、往左是往前挪，两端各 800 毫秒，
       挪完这份也写小抄（两端同一个数） */
    out.push(this.offsetField());
    /* 一个会话都没有 = 监听不上，把装插件这件事就地递到手上（两端同一个入口） */
    if(Music.hasBridge() && !Music.list.length){
      const bf = musBridgeField();
      if(bf) out.push(bf);
    }
    this.toolsEl.innerHTML = '';
    this.toolsEl.append(...out);
  }
  /* 丙：「字」开合上面那张面板。每次开都按小抄重建那六个控件 —— 齿轮那一框（或为写停靠）
     改过之后再开就是新的数，不必为这张面板另挂监听。 */
  typePanel(){
    if(!this.typeEl) return;
    const on = this.typeEl.classList.toggle('on');
    if(on){ this.typeEl.innerHTML = ''; this.typeEl.append(...musTypeRows()); }
    if(this.bType) this.bType.classList.toggle('on', on);
  }
  offsetField(){
    const lab = h('span', { class:'mu-lag-t' });
    /* 行程往两边各给 MUS_LAG_MS：当中那一格是对齐（0），往左是歌词提前、往右是延后 */
    const rng = h('input', { class:'mu-lag-r', type:'range', min:String(-MUS_LAG_MS), max:String(MUS_LAG_MS), step:'25',
      value:String(Music.offsetMs()), 'aria-label':'歌词提前或延后' });
    const val = () => Math.max(-MUS_LAG_MS, Math.min(MUS_LAG_MS, Math.round(Number(rng.value) || 0)));
    lab.textContent = musLag(Music.offsetMs());
    /* 拖着的时候只改本地这个数（歌词当场跟着挪），松手才写小抄 —— 一路写就是几十次文件改动 */
    rng.addEventListener('input', () => {
      Music.flags.off = val(); Music.gen++; Music.tell();
      lab.textContent = musLag(Music.flags.off);
    });
    rng.addEventListener('change', () => { Music.flagSet('off', val()); });
    this.offRng = rng; this.offLab = lab;
    /* 一键回到初始延迟（外26 第 6 条）：拨过好几档之后想退回「歌词照文件里那一份时刻走」，
       不用再慢慢把滑杆拖回正中那一格 —— 归零同时写小抄，另一端也跟着走。
       外27 图5：这个从前是图标按钮那一档（mu-btn）再自己压一号字，摆在清秀按钮下面一头高一头矮，
       光写「归零」也不知道归的是哪个零 —— 换成上面那一排同一种 wnw-btn mini，字写全。 */
    const rst = h('button', { class:'wnw-btn mini mu-lag-rst', type:'button', 'data-nograb':'1',
      title:'一键回到初始延迟（0 毫秒：歌词照文件里那一份时刻走）', 'aria-label':'时间偏移归零',
      onclick:() => { rng.value = '0'; Music.flags.off = 0; Music.gen++; Music.tell();
        lab.textContent = musLag(0); Music.flagSet('off', 0); } }, '时间偏移归零');
    return h('span', { class:'mu-lag-wrap', 'data-nograb':'1' }, [h('label', { class:'mu-lag' }, [rng, lab]), rst]);
  }
  /* 系统音量一排：滑杆步进 1 动的是 Windows 主音量（不是页面音频的旋钮）。
     滚轮在滑杆上 = 一格一档；滑杆上按中键 = 切换静音；边上再摆一个一键静音的图标按钮。
     显示值听系统的回声（谁改的都算：硬件键、托盘合成器、别的程序），拖动途中滑杆先跟着手走。 */
  volumeField(){
    const A = musApp();
    if(!A || typeof A.volSet !== 'function' || typeof A.volGet !== 'function') return null;
    volBoot();
    const clamp = v => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
    const rng = h('input', { class:'mu-vol-r', type:'range', min:'0', max:'100', step:'1', value:'50',
      title:'系统音量', 'aria-label':'系统音量' });
    const ico = h('button', { class:'mu-btn mu-vol-m', 'data-look-ctl':'', title:'静音 / 取消静音', 'aria-label':'静音 / 取消静音',
      html:musIcoMarkup(MUS_ICO.vol) });
    const act = p => { try{ if(p && typeof p.then === 'function') p.then(r => { if(r && r.ok === false && r.msg) toast(r.msg); }).catch(() => {}); }catch(e){} };
    const send = v => { act(A.volSet(v)); };
    const paint = () => {
      const v = Vol.vol;
      /* 系统音量这条路走不通（这台机器取不到 Core Audio 那个 COM 类，或监听重起三次还是没起来）：
         整排收掉，不摆一根拖了没反应的滑杆 —— 他 2026-10-08 那句「控制不了音量还摆个虚假按钮？？？」。
         原因主进程那句中文进了日志；这里只负责不骗人。 */
      wrap.classList.toggle('mu-off', !Vol.ok);
      wrap.classList.toggle('mu-dim', v == null);
      if(v != null && rng !== document.activeElement && Number(rng.value) !== v) rng.value = String(v);
      const want = Vol.muted ? MUS_ICO.mute : MUS_ICO.vol;
      if(ico._k !== want){ ico._k = want; ico.innerHTML = musIcoMarkup(want); }
      ico.classList.toggle('mu-dim', !Vol.muted);
      const lab = Vol.muted ? '已经静音：点一下取消静音' : '点一下静音（在滑杆上按鼠标中键也一样）';
      if(ico.title !== lab){ ico.title = lab; ico.setAttribute('aria-label', lab); }
    };
    Vol.fans.push(paint);
    this.volOff = () => { const i = Vol.fans.indexOf(paint); if(i >= 0) Vol.fans.splice(i, 1); };
    rng.addEventListener('input', () => { Vol.vol = clamp(rng.value); send(Vol.vol); paint(); });
    rng.addEventListener('change', () => { if(Vol.vol != null) send(clamp(rng.value)); });
    /* 滚轮一档一格：拦下来说清楚这一下归滑杆，不让卡片拿去干别的 */
    rng.addEventListener('wheel', e => {
      e.preventDefault(); e.stopPropagation();
      const step = e.deltaY < 0 || e.deltaX > 0 ? 1 : -1;
      const v = clamp((Vol.vol == null ? clamp(rng.value) : Vol.vol) + step);
      rng.value = String(v); Vol.vol = v; send(v); paint();
    }, { passive:false });
    /* 中键按下 = 切换静音（浏览器默认会把这一下当成自动滚动，必须拦） */
    rng.addEventListener('pointerdown', e => {
      if(e.button !== 1) return;
      e.preventDefault(); e.stopPropagation();
      act(A.volMute(2));
    });
    ico.addEventListener('click', () => act(A.volMute(2)));
    const wrap = h('div', { class:'mu-vol', 'data-nograb':'1' }, [ico, rng]);
    paint();
    return wrap;
  }
  pickAudio(){
    window.showOpenFilePicker({ multiple:false, types:[{ description:'音频',
      accept:{ 'audio/*':MUS_AUDIO.map(x => '.' + x) } }] })
      .then(async ([fh]) => { await Music.useFile(fh); })
      .catch(e => { if(e && e.name !== 'AbortError') toast(String(e.message || e)); });
  }
  bindBar(){
    const at = ev => {
      const r = this.bar.getBoundingClientRect();
      if(!r.width) return;
      const p = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      this.drag = p * Music.dur;
      this.fill.style.width = (p * 100).toFixed(2) + '%';
    };
    this.bar.addEventListener('pointerdown', ev => {
      if(!this.seekable()) return;
      this.bar.setPointerCapture(ev.pointerId);
      at(ev);
      const mv = e => at(e);
      const up = e => {
        this.bar.removeEventListener('pointermove', mv);
        this.bar.removeEventListener('pointerup', up);
        this.bar.removeEventListener('pointercancel', up);
        if(this.drag != null) Music.cmd('seek', Math.round(this.drag));
        this.drag = null;
      };
      this.bar.addEventListener('pointermove', mv);
      this.bar.addEventListener('pointerup', up);
      this.bar.addEventListener('pointercancel', up);
    });
  }
  seekable(){ return Music.dur > 0 && Music.canDo('seek'); }
  /* 读数只换字、不换节点。textContent 是把里面那个文本节点整个换掉（浏览器实测：一发 childList 记录，
     加删各一），而 Flow-Desk 桌面那张卡正是拿 childList 决定「内容变了，重量一遍字号」
     （fd8-tools.js 的 fitLive → fitBox 读 clientHeight / clientWidth / scrollHeight = 整页重排）。
     于是秒表每跳一次，白搭一趟整页重排 —— 而 "0:12 / 2:58" 这一串是定长的，永远动不了卡片的高度。
     原节点在、且只有它一个，就直接改它的值（同一台浏览器实测：零条记录）。 */
  setText(k, el, v){
    if(this.cache[k] === v) return;
    this.cache[k] = v;
    const t = el.firstChild;
    if(t && t.nodeType === 3 && !t.nextSibling) t.nodeValue = v; else el.textContent = v;
  }
  checkTools(){
    if(this.btnKey !== (Music.smtc ? 's' : 'f')) this.setButtons();
    if(this.full && this.toolKey !== this.toolSig()) this.setTools();
  }
  hint(live){
    const tail = t => t + (MusLy.doc && !MusLy.doc.timed && MusLy.doc.lines.length ? '（没有时间戳，整页看全文）' : '');
    /* 监测成功的时候卡片上不再摆这一行（那行是"哪台在放 + 歌词打哪儿来"，只在出问题时说话）；
       整页想知道来路，照旧摆。 */
    if(live) return this.full ? [musWho(), MusLy.src && tail(MusLy.src)].filter(Boolean).join(' · ') : '';
    if(Music.dead) return '系统播放器没连上：' + (Music.msg || '子进程没起来');
    if(Music.hasBridge()){
      const p = musPlayer(Music.pin);
      if(p && !Music.pinOk) return '指定的播放器「' + p + '」此刻没有会话 —— 要么把它打开，要么到设置里换回自动挑';
      if(p) return '指定的播放器「' + p + '」此刻没在放 —— 播一首就有了';
      return '系统里此刻没有正在放的歌 —— 播一首就有了（设置里可以指定播放器）';
    }
    return '这里读不到系统播放器：点「选音频」自己放一首';
  }
  update(){
    this.checkTools();
    this.syncFlags();
    this.typeVars();
    const d = MusLy.doc, live = Music.live(), ms = Music.nowMs(), lms = Music.lyricMs(), dur = Music.dur;
    /* 另一个窗口把偏移拨了：这个滑杆跟着走（正拖着它的时候别抢） */
    if(this.offRng && this.offRng !== document.activeElement){
      const v = String(Music.offsetMs());
      if(this.offRng.value !== v) this.offRng.value = v;
      this.setText('lag', this.offLab, musLag(Music.offsetMs()));
    }
    /* 文本类：变了才写，免得每 250ms 抖一次 */
    this.setText('title', this.tEl, Music.title || '没有播放中的歌');
    this.setText('artist', this.aEl, [Music.artist, Music.album].filter(Boolean).join(' · '));
    /* 封面跟着歌名·艺人走：这一趟问一次，没变就一个字都不动（认图那趟是异步的，不等它） */
    this.syncArt();
    const playing = Music.playing();
    /* 一个按钮两副面孔：放着就摆暂停，停着就摆播放 */
    if(this.cache.playing !== playing){
      this.cache.playing = playing;
      this.bTog.innerHTML = musIcoMarkup(MUS_ICO[playing ? 'pause' : 'play']);
      this.bTog.title = playing ? Phrase.out('暂停') : Phrase.out('播放');
      this.bTog.setAttribute('aria-label', this.bTog.title);
      this.bTog.classList.toggle('on', playing);
    }
    this.bPrev.disabled = !live || !Music.canDo('prev');
    this.bNext.disabled = !live || !Music.canDo('next');
    this.bTog.disabled = !live || (!Music.canDo('toggle') && !Music.canDo('play') && !Music.canDo('pause'));
    this.bar.classList.toggle('mu-off', !this.seekable());
    /* 进度条 + 读数：手正拖着的时候别跟它抢 */
    if(this.drag == null){
      this.fill.style.width = (dur > 0 ? Math.max(0, Math.min(100, ms / dur * 100)) : 0).toFixed(2) + '%';
    }
    this.setText('time', this.time, dur > 0 ? musClock(ms) + ' / ' + musClock(dur) : '');
    /* 歌词换没换：按「卡上摆的这份歌词」认，不按「播放器现在放的是哪一首」认。
       从前这里拼的是 Music.trackKey —— 换歌那一瞬歌名先到、歌词还在路上（找词要读内嵌、扫目录），
       这个串就先变了，于是拿旧歌词重铺一次，紧接着 load 把 doc 清空又铺一次，最后新词到了再铺一次：
       一次换歌三次重铺，卡片那一格跟着塌一下撑回来，看着就是闪。现在只在真正换词时铺一次。 */
    if(this.wrap) this.wrap.classList.toggle('mu-ka', !!(d && d.timed));
    const key = (MusLy.docKey || '') + '|' + (MusLy.src || '') + '|' + (d ? d.lines.length : 0)
      + '|' + (Music.flags.note ? 1 : 0) + (Music.flags.trans ? 1 : 0);
    if(this.lyKey !== key){ this.lyKey = key; this.repaint(); }
    /* 卡上还是上一首的歌词、时间已经是这一首的了：这一刻别点旧词里的行，
       不然 act 会在上一首歌词里乱跳一格。新词铺上那一次再点亮。 */
    if(d && d.timed && MusLy.docKey === Music.trackKey) this.highlight(lms);
    /* 整页那一屏的打字机：这一趟排上了就自己一帧一帧走，停着 / 被人在翻它自己会散 */
    if(this.full) this.crawl();
    const src = this.hint(live);
    if(this.cache.src !== src){
      this.cache.src = src;
      this.srcEl.textContent = src;
      this.srcEl.style.display = src ? '' : 'none';
      this.srcEl.classList.toggle('mu-warn', !live);
    }
  }
  /* 专辑封面：只在这一张换了的时候动一下 DOM。认回来的那趟再换上，图没解出来就一直摆那张音符，
     不弹条也不报错 —— 封面这条路和歌词、进度各走各的，谁都不等谁 */
  syncArt(){
    if(!this.cover) return;
    const url = MusArt.want(Music);
    if(url === this.artUrl) return;
    this.artUrl = url;
    /* 底下那张音符先顶着（没内嵌图、或者图没解出来就一直看得见它），上面这一张是透明的，解出来才淡上来 */
    this.cover.className = 'mu-cover mu-ph';
    this.cover.innerHTML = MUS_ART_NOTE;
    if(!url) return;
    const img = h('img', { class:'mu-art', alt:'',
      onerror:() => { this.cover.classList.add('mu-ph'); } });
    img.onload = () => { if(this.artUrl === url) this.cover.classList.remove('mu-ph'); };
    img.src = url;                 /* objectURL：图只活在内存里，磁盘上什么都没写 */
    this.cover.appendChild(img);
  }
  /* 整棵歌词树只在换歌 / 换开关时重画 */
  repaint(){
    const d = MusLy.doc;
    this.li = -1; this.wi = -1; this.滚到 = -1;
    this.vos = musVoices(d);
    if(this.full){
      this.list.innerHTML = '';
      this.rows = [];
      this.gaps = []; this.gapLive = -1; this.gapSec = -1;
      if(!d || !d.lines.length){ this.setWho(null); this.list.appendChild(h('div', { class:'mu-none' }, '歌词不存在')); return; }
      const frag = document.createDocumentFragment();
      /* 左右轮换（图6 那一屏的读法）：同一个声部连着唱的这一截算一段，段与段换一边 ——
         不用看名字、光看这一句落在哪一边就知道换人了。没标声部的那几行跟着上面那一段走，
         不另起一段；整首一处声部也没标的一律摆成 mu-seg0（不偏不倚）。 */
      let seg = -1, lastAg = null;
      for(let i = 0; i < d.lines.length; i++){
        const L = d.lines[i], p = i ? d.lines[i - 1] : null;
        if(L.agent && L.agent !== lastAg){ seg++; lastAg = L.agent; }
        /* 乙-2：上一句唱完到这一句开口空得太久 = 一段间奏，中间摆一道分隔（写上空档多长）。
           光多留一段白不行 —— 那一屏本来就在滚，看不出来是间奏还是滚得快。
           只认文件真写了结束时间的那种：普通 LRC 一句的结尾是照下一句开口倒推的，
           那种"空档"永远是 0，硬摆分隔等于编。
           外22 第 2 轮（他的第 3 条「时间做成动态的，倒计时」）：这一道要能算 ——
           记下它的起止挂在 this.gaps 上，正活在其中的那一道改摆「还剩多久」，其余各道摆这段的总长。 */
        if(p && L.ms - p.ms2 >= MUS_GAP_MS){
          const g = h('div', { class:'mu-gap' }, '间奏 ' + musClock(L.ms - p.ms2));
          this.gaps.push({ el:g, from:p.ms2, to:L.ms });
          frag.appendChild(g);
        }
        /* 换人的那一行前面摆一枚声部标记，同一人连着唱的不重复标 */
        const r = this.lineNode(L, i, !!d.agents && L.agent && (!p || p.agent !== L.agent));
        r.row.classList.add(seg < 0 ? 'mu-seg0' : (seg % 2 ? 'mu-right' : 'mu-left'));
        this.rows.push(r);
        frag.appendChild(r.row);
      }
      this.list.appendChild(frag);
      /* 甲-5：切歌落点 —— 重画完直接把第一行摆到垂直正中，不等下一趟。
         两笔非做不可：半屏空档（padList）从前只有打字机那一趟会补，而换歌刚落地那一屏
         往往是停着的（桥先报 Stopped pos=0），打字机不排 → 第一行只能贴在框顶上；
         落点这一趟走 force，绕开「已经看得见」那一判 —— 刚重建的内容 scrollTop=0，
         按那一判会以为第一行已经摆好了。
         只管真在开头的时候（第一句开口前两秒内）：中途换注音 / 翻译开关也走这一趟重画，
         那时候位置在歌当中，硬拽回第一行就是往回跳。 */
      if(this.rows[0] && Music.lyricMs() < (d.lines[0].ms || 0) + 2000){
        this.padList();
        this.li = 0; this.liGen = Music.gen;
        this.scrollTo(this.rows[0].row, true);
      }
      return;
    }
    /* 卡片：整首歌词一次铺进同一格（叠放，见 CSS 里 .mu-mini .mu-cur 那一段），
       换行只改「哪一行露出来」—— 格子高度等于全歌最高那一行，换行不动它一根手指头。
       FD 卡片自己管缩放（fitBox 量内容高度配字号）：这一格恒定，整卡字号就钉死在一档，
       宁可整体偏小，也不许换句时跳一下。演唱者那一行先按「没标声部」报一次（就是这首歌的艺人），
       换行时 highlight 再换成声部名 —— 刚换歌、歌词还没到第一句的那一段里，这一行也不能空着。 */
    if(this.cur){
      this.cur.innerHTML = '';
      this.rows = [];
      if(d && d.timed && d.lines.length){
        const frag = document.createDocumentFragment();
        for(let i = 0; i < d.lines.length; i++){
          const r = this.lineNode(d.lines[i], i, null, true);
          this.rows.push(r);
          frag.appendChild(r.row);
        }
        this.cur.appendChild(frag);
      }
    }
    if(!this.full) this.setWho(null);
  }
  /* 声部 id → 名字 + 第几号色位（顺序按文件里第一次出现的先后，稳定） */
  voice(id){
    const v = (this.vos || []).find(x => x.id === id);
    return v || null;
  }
  /* 演唱者那一行：换行 / 换歌才算一次，不跟着每个字跑。
     摆法和整页歌词行首那枚声部标记同一套（实心点 = 第一声部、空心环 = 第二声部），
     对唱就把两枚并列；文件里没标声部的报这首歌的艺人 —— 这一行永远说得出「现在是谁在唱」。 */
  setWho(L){
    const el = this.whoEl;
    if(!el) return;
    const d = MusLy.doc, ag = d && d.agents;
    const parts = [];
    if(L && ag){
      const me = this.voice(L.agent);
      if(me && parts.indexOf(me) < 0) parts.push(me);
      /* 同一时刻两条不同声部都张着嘴 = 对唱，两个名字并列摆 */
      for(const o of d.lines){
        if(o === L || !o.agent || o.agent === L.agent) continue;
        if(o.ms < L.ms2 - 40 && L.ms < o.ms2 - 40){
          const v = this.voice(o.agent);
          if(v && parts.indexOf(v) < 0) parts.push(v);
        }
      }
    }
    if(!parts.length){
      const nm = String(Music.artist || '').trim();
      if(nm) parts.push({ name:nm, i:-1 });
    }
    const sig = parts.map(p => p.i + ':' + p.name).join('|');
    if(this.cache.who !== sig){
      this.cache.who = sig;
      el.className = 'mu-who' + (parts.length > 1 ? ' duet' : '');
      el.innerHTML = '';
      parts.forEach((p, n) => {
        if(n) el.appendChild(h('span', { class:'mu-and' }, '/'));
        el.appendChild(h('span', { class:'mu-vo' + (p.i < 0 ? ' nov' : ' v' + p.i) },
          [h('i'), h('span', {}, p.name)]));
      });
    }
    el.style.display = parts.length ? '' : 'none';
  }
  wordSpans(words, into, cls){
    const out = [];
    for(const w of words){
      const s = h('span', { class:cls + (w.bg ? ' bg' : '') }, w.text);
      into.appendChild(s);
      out.push(s);
    }
    return out;
  }
  /* keep：卡片那一格用 —— 注音、翻译这两行这一句没有也照样占一格，
     不然换到一句没翻译的，整块高度缩一截，卡片跟着跳（同一档开关下高度恒定）。
     整页歌词不占：那一片是流式排的，空行会看出窟窿。 */
  lineNode(L, i, vo, keep){
    const row = h('div', { class:'mu-line' });
    const v = vo ? this.voice(L.agent) : null;
    if(v){
      /* 轮换：换人的那一行前头摆一枚声部标记 —— 实心圆点是第一声部，空心圆环是第二声部，
         光看形状也知道换人，不用只靠颜色分辨 */
      row.appendChild(h('div', { class:'mu-vo v' + v.i }, [h('i'), h('span', {}, v.name)]));
      row.classList.add('v' + v.i);
    }
    const main = h('div', { class:'mu-main' });
    const extra = [];
    let ws;
    if(Music.flags.note && L.note){
      /* 逐字对应：一个字／音节一格 —— 注音在上、歌词在下，同竖同格；
         格宽由列内较宽的那件自己顶开（注音宽就宽给注音，字宽就宽给字），
         既不让注音被挤小看不清，也不把字间撑出大缝 */
      main.classList.add('mu-pair');
      ws = [];
      for(const w of L.words){
        const cell = h('span', { class:'mu-p' });
        const segs = w.notes || [];
        const slot = h('span', { class:'mu-pn' });
        const el = h('span', { class:'mu-w' + (w.bg ? ' bg' : '') }, w.text);
        if(segs.length){
          const nEl = h('span', { class:'mu-w nu' }, segs.map(s => s.text).join(' '));
          slot.appendChild(nEl);
          extra.push({ el:slot, spans:[nEl], segs:[{ ms:segs[0].ms, ms2:segs[segs.length - 1].ms2, text:'' }] });
        }
        cell.appendChild(slot); cell.appendChild(el);
        main.appendChild(cell);
        ws.push(el);
      }
    }else{
      ws = this.wordSpans(L.words, main, 'mu-w');
      /* 整行罗马音兜底（ttml 只有行级 x-roman、没逐字打点）：对不到字，仍单独摆一行在上方 */
      if(Music.flags.note && (L.noteText || keep)){
        const n = h('div', { class:'mu-note' });
        n.textContent = L.noteText || '';
        row.appendChild(n);
      }
    }
    row.appendChild(main);
    if(Music.flags.trans && (L.trans || keep)){
      /* 文件头那份翻译可能一个 key 挂两行（译法 + 一条 *注），竖着排 */
      const ts = String(L.trans || '').split('\n').filter(t => t.trim());
      if(!ts.length) row.appendChild(h('div', { class:'mu-trans' }));
      for(const t of ts) row.appendChild(h('div', { class:'mu-trans' }, t));
    }
    return { i, L, row, ws, extra };
  }
  /* 行状态：正在唱的那一行 act，开口已到、又不当这一行的转「已唱」中间色（不掉灰），没轮到的一律不动。
     sung 从前按「数组里排在当前这一行前面」判：行序就是时间序时不会错，可两条嗓子叠着唱的时候
     当前那一格会落到排在后面的那一行上（和声 12~13 挂在主唱 10~14 当中 —— 按「谁在唱优先」挑，
     12.5 落和声，13.2 和声收口又回主唱）。那一摆一收就是两下错：后面的和声先从「未唱」跳成「已唱」、
     再掉回「未唱」，前面的主唱明明还在唱却整行染成已唱；.mu-line 上挂着 opacity .18s 的过渡，
     跳一下就是一次看得见的闪烁（外32 图10「时间重叠复杂的唱段，弹动、闪烁、『正在唱』的片段有时出错」）。
     现在一律按这一行自己的开口时刻判，数组里排第几不参与。 */
  rowStates(li, ms){
    for(let i = 0; i < this.rows.length; i++){
      const r = this.rows[i];
      if(!r || !r.row) continue;
      const act = i === li, sung = !act && isFinite(r.L.ms) && ms >= r.L.ms;
      if(r._sung !== sung){ r._sung = sung; r.row.classList.toggle('sung', sung); }
      if(r._act !== act){ r._act = act; r.row.classList.toggle('act', act); }
    }
  }
  /* 摆哪一行：只往前走。往回退要过两道闸 —— ① 时间基准换了号（拖进度条、换歌、暂停再播、
     一次掰过 JUMP_MS，这几样都 gen++）；② 时间倒回得比这一行起点还早 LI_BACK_MS 那一截
     （人在往回拖带子）。其余的回退一律按住不动。
     为什么非这样不可：播放器报上来的位置本身带噪声，摆着不动的这一行一退、过一会儿又追回来，
     来回倒就是主人看见的「歌词乱跳」，展开那一屏字大、还带着滚动，最扎眼。
     （这一段从前写的是「那座桥每两秒把位置盖一次基准，所以时间每隔一会儿就被往回拽一次」——
     2026-10-05 用一份只读探针量过，那句是错的：桥报的位置和墙钟之差一直在 ±90 毫秒里晃，
     500 毫秒死区一路没触发过，只有"暂停→播放"那一下是 -1982 毫秒。闸留着有用（挡噪声和人为回拖），
     但它挡的不是一个每两秒发生一次的事；LI_BACK_MS 那 700 毫秒的口子因此几乎只为人往回拖带子而开。） */
  lineAt(ms, lines){
    /* 一行都还没唱到 = 落第一行，不是「无行可选」。从前整页那一档起 -1：换歌那一下桥先推的是
       Stopped + pos=0（歌名还是上一首的），-1 挑不出行、也就不滚，界面停在上一首的尾巴上 ——
       他说的「切过来落在结尾」就是这一格。卡片那一档一直是 0，两边并成同一口径。 */
    const end = L => (isFinite(L.ms2) && L.ms2 > L.ms ? L.ms2 : L.ms);
    /* 挑哪一行的准（他图 4 那一条）：开口已经到了的那些行里，正在唱的那一行优先 —— 两行叠着唱时和声与主唱都张着口；
       都收口了、或都在唱，就取开口最晚的那一行。从前是按「文件里写在后面」取最后一行，可他库里这三份逐字文件
       行序和时间序对不上（一共 6 处，和声那行写在主唱后面、开口却更早），于是会挑到一行早就唱完的，界面看着就是往后拽。
       卡片那一档和整页那一档并成这一条准：整页从前多一层「先看谁在唱」，那是这条准的一个特例。 */
    let raw = -1;
    for(let i = 0; i < lines.length; i++){
      const L = lines[i];
      if(!isFinite(L.ms) || L.ms > ms) continue;
      if(raw < 0){ raw = i; continue; }
      const 唱 = ms < end(L), 当前唱 = ms < end(lines[raw]);
      if(唱 && !当前唱) raw = i;
      else if(唱 === 当前唱 && L.ms > lines[raw].ms) raw = i;
    }
    if(raw < 0) return 0;
    const cur = this.li, cL = lines[cur];
    if(cur < 0 || !cL) return raw;
    /* 往后一认要过闸：候选比当前这行开口更晚（往前走）就认；开口更早但正在唱、而当前那行已经收口的也认
       （就是上面那个结，光按先后认会把正在唱的那一行压住）；余下那种往后退的，要等位置真退回当前行开口之前才算 */
    if(lines[raw].ms >= cL.ms || (ms < end(lines[raw]) && ms >= end(cL))) return raw;
    if(Music.gen !== this.liGen) return raw;
    return ms < cL.ms - LI_BACK_MS ? raw : cur;
  }
  highlight(ms){
    const d = MusLy.doc;
    /* 没歌词、或者歌词没带时间戳：演唱者那一行退回报这首歌的艺人，不空着 */
    if(!d || !d.timed){ this.setWho(null); return; }
    if(this.full){
      const li = this.lineAt(ms, d.lines);
      if(li !== this.li){
        const 换了基准 = Music.gen !== this.liGen;
        this.li = li; this.liGen = Music.gen;
        this.rowStates(li, ms);
        /* 落回还在唱的前一行（叠着唱收口那一下）不往回滚：整列来回拽就是「弹动」。
           基准换了号那一趟照旧滚 —— 那一次是人在真翻位置，整屏得跟着新位置归位。 */
        if(li >= 0 && this.rows[li] && (换了基准 || li > this.滚到)){
          this.滚到 = li;
          /* 打字机那一趟正在驱动这一列的时候，换行不再另发一次滚动：那一段的终点本来就是「下一句正中」，
             两趟一起写就是忽快忽慢 —— 帧级仿真里那一笔 -21.7 像素的倒退，就是这一趟写完、下一帧打字机按自己的数又拽回去。
             基准换了号那一次例外（人在真翻），打字机没在跑的每一档（卡片、暂停、人在翻）也照旧走这一趟。 */
          if(换了基准 || !this.crawling) this.scrollTo(this.rows[li].row);
        }
        this.wi = -1;
        this.setWho(d.lines[li] || null);
      }
      if(this.rows[li]) this.mark(this.rows[li], ms);
      this.gapTick(ms);
      return;
    }
    /* 卡片摆的是叠好的那一摞：换行只是把「露出来」的记号挪一行 —— DOM 不拆不建、
       格子高度纹丝不动，卡片整体缩放就不会被顶一下；行内逐字交给渐变 */
    const li = this.lineAt(ms, d.lines);
    if(li !== this.li){
      const old = this.rows[this.li];
      if(old && old.row) old.row.classList.remove('act');
      const r = this.rows[li];
      if(r && r.row){
        this.li = li; this.liGen = Music.gen;
        r.row.classList.add('act'); r._act = true;
        this.wi = -1;
        /* 换行顺带把演唱者那一行改成这一行的声部（对唱就并列两个名字） */
        this.setWho(d.lines[li] || null);
      }
    }
    const cur = this.rows[li];
    if(cur) this.mark(cur, ms);
  }
  /* 只改这一个节点的文字，且走「文本节点的值」那一笔：textContent 会连着拆一次子节点、
     建一次文本节点（ MutationObserver 记两条 childList），而这一屏的打字机正每帧读这一棵树的几何 ——
     多出来的那两条记录会被观察器接去算重排（外21 第三批量到的那条每秒 166 趟就是这么来的）。 */
  gapPut(g, s){
    if(g.txt === s) return;
    g.txt = s;
    const t = g.el.firstChild;
    if(t && t.nodeType === 3 && !t.nextSibling) t.nodeValue = s; else g.el.textContent = s;
  }
  /* 乙-2 的倒计时：分隔里那道时间要跟着走 —— 正卡在其中那一截的分隔摆「还剩多久」，
     其余各截仍旧摆这段间奏的总长（不活的那些没必要每拍跟着改字）。
     谁在活：拿当前时刻在 [这一道起, 下一道开口) 里认，一首也就几道，一趟扫完不费什么。
     换到别的道、或同一道上秒数变了，才动那一次 DOM。 */
  gapTick(ms){
    const G = this.gaps;
    if(!G || !G.length) return;
    let live = -1;
    for(let i = 0; i < G.length; i++){ if(ms >= G[i].from && ms < G[i].to){ live = i; break; } }
    if(live === this.gapLive && live >= 0){
      const g = G[live], s = Math.ceil((g.to - ms) / 1000);
      if(s !== this.gapSec){ this.gapSec = s; this.gapPut(g, '间奏 ' + musClock(s * 1000)); }
      return;
    }
    const prev = G[this.gapLive];
    if(prev){ prev.el.classList.remove('now'); this.gapPut(prev, '间奏 ' + musClock(prev.to - prev.from)); }
    this.gapLive = live;
    if(live < 0){ this.gapSec = -1; return; }
    const g = G[live];
    g.el.classList.add('now');
    this.gapSec = Math.ceil((g.to - ms) / 1000);
    this.gapPut(g, '间奏 ' + musClock(this.gapSec * 1000));
  }
  /* 逐字：一个字两层渐变裁在字面上，上层从左往右填，填到哪儿唱到哪儿，唱过的保持满色。
     一趟里要起手的字先攒进 pend：起点全部写完 → 强制布局只做一次 → 再一起挂动画。
     从前是每个字各来一发 void offsetWidth，署名行那种密字（一世心上长安第 5 行 90 格 / 540 毫秒）
     一拍里要跨过五六个字，一秒三十多拍就是**一百六十多趟整页重排** —— 外18 乙组「启动后第一首歌卡、
     切歌后好转」「拖进度条有一点点」两处都对得上：开头那两行正是歌名和署名，拖完进度条则是整行的字
     同时换基准（gen）要重摆。一次改一处的写法留着，只是把"问浏览器要一个新布局"合并成一次。 */
  mark(node, ms){
    const L = node.L, run = Music.playing(), gen = Music.gen, pend = [];
    for(let i = 0; i < node.ws.length && i < L.words.length; i++) this.fillWord(node.ws[i], L.words[i], ms, run, gen, pend);
    for(const ex of node.extra){
      if(!ex.spans) continue;
      for(let i = 0; i < ex.spans.length && i < ex.segs.length; i++) this.fillWord(ex.spans[i], ex.segs[i], ms, run, gen, pend);
    }
    if(!pend.length) return;
    void pend[0].el.offsetWidth;                    /* 上面那些起点一次性落地，下面挂的动画才有得走 */
    for(const it of pend){
      it.el.style.transition = 'background-size ' + it.dur + 'ms linear';
      it.el.style.backgroundSize = '100% 100%, 100% 100%';
    }
  }
  /* st：0 还没唱 / 1 正在唱 / 2 唱完。gen 是时刻基准的号 —— 对齐真值、拖条、暂停再播、拨偏移
     都会换号，换了就按当前比例重摆再接着走，不然那个字会一路停在半截。
     要起手的字只写起点并把活记进 pend（第四、五个参数），动画由 mark 那一趟统一挂。 */
  fillWord(el, w, ms, run, gen, pend){
    if(!isFinite(w.ms)) return;
    const end = isFinite(w.ms2) && w.ms2 > w.ms ? w.ms2 : w.ms + 120;
    const st = ms >= end ? 2 : ms >= w.ms ? 1 : 0;
    if(st !== 1){
      if(el._wf !== st){
        el._wf = st; el._wg = gen;
        el.style.transition = 'none';
        el.style.backgroundSize = (st ? 100 : 0) + '% 100%, 100% 100%';
      }
      return;
    }
    /* 正在唱、又是这一轮基准里第一次碰到它：起手让 CSS 自己走完；
       暂停状态每趟都重摆一次，不然按下去那一下动画还在跑，字会多唱半截 */
    if(el._wf === 1 && el._wg === gen && run) return;
    const p = Math.max(0, Math.min(100, (ms - w.ms) / Math.max(1, end - w.ms) * 100)).toFixed(2);
    el._wf = 1; el._wg = gen;
    el.style.transition = 'none';
    el.style.backgroundSize = p + '% 100%, 100% 100%';
    if(!run){ return; }                                  /* 停着的时候摆在这儿就行，别让它自己走 */
    pend.push({ el, dur: Math.max(1, Math.round(end - ms)) });
  }
  /* 上下各留半屏空档：不然第一句和最后一句永远走不到正中。
     从前只有打字机那一趟会补 —— 于是换歌刚落地、还没开播的那一屏（桥先报 Stopped pos=0，
     歌词文件还在读）第一行只能贴在框子顶上，看着就是"没居中"。抽成一处，重画的时候也补。 */
  padList(){
    const box = this.list;
    if(!box) return;
    const half = Math.max(0, Math.round(box.clientHeight / 2) - 10);
    if(half === this.padHalf) return;
    this.padHalf = half;
    box.style.paddingTop = half + 'px';
    box.style.paddingBottom = half + 'px';
    this.geoKey = '';      /* 内边距一变，每一行正中落在哪儿就全换数了：那把几何尺别再拿旧的 */
  }
  scrollTo(el, force){
    const box = this.list;
    if(!box || !el) return;
    /* force = 换歌重画那一趟：内容是全新的，下面三道早退一道都不算，也不走 smooth
       （从上一首的尾巴滑过来会拖成一趟长动画）。 */
    if(!force && this.stick && Date.now() - this.stick < 2500) return;
    /* 行的高度和「这一行到滚动内容顶有多远」必须同一把尺量。从前这里用 el.offsetTop，
       可 .mu-list 不是定位元素，offsetParent 一路退到卡片（.fd-card 是 absolute）或停靠面板
       （.wnw-pane 是 relative）—— 那个数白白带着列表上方所有排的总高，说明行、演唱者行
       一显隐、工具行一折行它还会变。拿它去和 box.scrollTop 比，「已经看得见」这一判
       系统性错位：要么该滚的不滚，要么一步冲过头（外15 第 1 条：歌词乱跳）。
       改成两个矩形之差换算进内容坐标，和 offsetParent 是谁无关。 */
    const eb = el.getBoundingClientRect(), bb = box.getBoundingClientRect();
    const top = eb.top - bb.top + box.scrollTop, hh = eb.height;
    if(!force && top >= box.scrollTop + 6 && top + hh <= box.scrollTop + box.clientHeight - 6) return;
    const to = Math.max(0, top - box.clientHeight / 2 + hh / 2);
    /* smooth 那一趟还在半路时 box.scrollTop 读的是中途值，下一趟（最密 250ms 就有一趟）
       一判就当已经到位、不滚了，落点被反复改写。自己发起的那一趟先记一笔：
       落点没挪开 8 像素、还在动画这几百毫秒里，就不要再发一次。 */
    if(!force && this.autoTo != null && Math.abs(this.autoTo - to) < 8 && Date.now() - this.autoAt < 1200) return;
    this.autoTo = to; this.autoAt = Date.now();
    this.lastTop = box.scrollTop;      /* 起点先记一笔：上面那个 scroll 判走向要拿它比 */
    /* 隔着一整屏以上就别再 smooth 飞过去：那是「憋了一会儿然后猛冲」的样子。
       直接落到该在的那一格，下一行照常平滑跟（外15 第 1 条） */
    const far = force || Math.abs(to - box.scrollTop) > box.clientHeight;
    this.crawlSet = null;      /* 这一趟是换行发起的滚动，不是打字机那一趟 —— 记的数别再拿来自比 */
    box.scrollTo({ top:to, behavior:far ? 'auto' : 'smooth' });
  }
  /* 打字机那一下（整页那一屏，图5 图6 要的就是这个）：不再一句一冲，
     而是让当前这一句从正中慢慢往上走、走到头正好把下一句接进正中。
     每帧写的只有一个 scrollTop，时间读的还是那一份本地插值 —— 一次都不额外去问播放器；
     不在整页、停着、或者人在翻（stick 那 2.5 秒）的时候这一趟不排，下一趟由 update 重新起。 */
  /* 下一趟换行发生在哪一刻、轮到谁（打字机那一段的终点）：把比现在晚的每一个「开口」当候选，
     拿挑行那颗准挨个问一遍，第一个答案不再是当前这一行的候选，就是真会换行的那一刻。
     只认开口、不认行尾：滚动要赶到的是「下一句该在正中」那一格，而高亮会因为叠唱收口
     落回一行早就唱完的（22500 那一下从主唱落回和声），跟着那种回跳去赶终点，
     就等于拿 91 毫秒去走一整行的路 —— 帧级仿真里那五笔 11 像素一帧的大台阶就是这么来的。
     为什么非问不可：这一屏的进度从前按「行尾」算，换行却按挑行那颗准发生 —— 两个时刻对不上，
     换行那一帧就必然跳一下（往哪边跳看谁早谁晚）。问一次的成本在换段那一下，不在每帧。 */
  下一趟(从现在){
    const d = MusLy.doc, 点 = [];
    for(const L of d.lines) if(isFinite(L.ms) && L.ms > 从现在) 点.push(L.ms);
    点.sort((a, b) => a - b);
    for(const t of 点){ const j = this.lineAt(t + 1, d.lines); if(j !== this.li) return { t1: t, j }; }
    return null;
  }
  crawl(){
    if(this.crawling) return;
    const step = () => {
      this.crawling = 0;
      const box = this.list;
      if(!box || !this.full || !box.isConnected) return;
      const d = MusLy.doc, r = this.rows[this.li];
      const key = this.li + '|' + Music.gen, now = Date.now();
      /* 该不该量 DOM 的判断放在最前：换句、换基准、重画过（行节点换了对象）、或者距上次量过 250 毫秒。
         那 250 毫秒是给"拉大拉小窗口"留的口子 —— 最坏晚四分之一秒归位，这一屏本来就在连续滚，看不出来；
         换来的是每秒最多四趟量 DOM，而不是每帧一趟。 */
      const due = this.geoKey !== key || this.geoRow !== (r && r.row) || now - (this.geoAt || 0) >= 250;
      if(due){
        this.geoAt = now;
        this.padList();
      }
      if(!d || !d.timed || !r || !r.row || !Music.playing() || (this.stick && Date.now() - this.stick < 2500)){ this.crawlTo = null; this.crawlSet = null; return; }
      const ms = Music.lyricMs();
      /* 一段 = 从「这一行成为当前」那一刻的落点，走到「下一趟真会换行的那一刻」新那一行的正中。
         两头同一把尺（内容坐标）、同一个时刻表（挑行那颗准算出来的那一刻），所以换行那一帧必然接得上。
         从前这一段是按「行尾」算进度、按挑行那颗准换行 —— 两个时刻对不上，换行那一帧就必然跳一下：
         行尾晚于换行，进度没走完就被下一行接走（往前冲一截 = 变速）；行尾早于换行，进度先顶到 1 停住，
         换行那一刻新起点又比它低（往回落一截 = 上下弹动）。帧级仿真量的就是这两笔：台阶比 65、倒退 -21.7 像素。 */
      let 要量 = due;
      if(this.segKey !== key){
        const 计 = this.下一趟(ms);
        /* 起点取上一段真正写下的那一格；换行那一下刚由 scrollTo 发起过，就取它的落点（动画还在半路时读 DOM 读到的是中途值） */
        const 起 = this.crawlSet != null ? this.crawlSet
          : (this.autoTo != null && Date.now() - this.autoAt < 1200 ? this.autoTo : box.scrollTop);
        this.segKey = key;
        this.geo = { s0: 起, t0: ms, t1: 计 ? 计.t1 : ms + 4000, j: 计 ? 计.j : this.li };
        要量 = true;              /* 换段这一帧就得把终点量出来，不然 p 乘的是没量过的数 */
      }
      /* 终点的几何每 250 毫秒重量一次（拉大拉小窗口、行一折行它跟着变）；量 DOM 的口径和从前一样是三个矩形之差 */
      if(要量){
        const b = box.getBoundingClientRect();
        const 中 = i => {
          const rr = this.rows[i]; if(!rr || !rr.row) return null;
          const a = rr.row.getBoundingClientRect();
          return a.top - b.top + box.scrollTop + a.height / 2 - box.clientHeight / 2;
        };
        const g = this.geo;
        /* 终点必须在起点下面：量出来不在下面的（终点那一行已经过去了、或者位置被拖到别处去了）退而求其次走下一行，
           再不行就原地不动 —— 宁可停着等下一句开口，也不许拿一小截时间去赶一整行的路（那就是看得见的猛冲） */
        let s1 = 中(g.j);
        if(s1 == null || s1 <= g.s0){
          const n = 中(this.li + 1);
          s1 = (n != null && n > g.s0) ? n : g.s0;
        }
        g.s1 = s1; this.geoKey = key; this.geoRow = r.row;
      }
      const g = this.geo;
      let p = Math.max(0, Math.min(1, (ms - g.t0) / Math.max(1, g.t1 - g.t0)));
      /* 这一段内的进度也只许往前走：播放器报上来的位置带噪声（2026-10-05 只读探针量过，和墙钟之差在 ±90 毫秒里晃，
         500 毫秒死区一路没触发），一跟着退屏幕上就倒退半格再弹回来。换段、换基准才重摆起点。 */
      if(key !== this.crawlKey){ this.crawlKey = key; this.crawlP = p; }
      else if(p < this.crawlP) p = this.crawlP;
      else this.crawlP = p;
      const to = g.s0 + (g.s1 - g.s0) * p;
      /* 整列的落点也只许往前走：叠着唱那一段手会落回还在唱的前一行（主唱 → 和声 → 主唱），
         那一落照写就是把整列往回拽 —— 基准换了号（拖条 / 换歌 / 暂停再播）那一次不算，那一次是人在真翻位置。 */
      const 回拽 = this.crawlGen === Music.gen && this.crawlSet != null && to < this.crawlSet;
      this.crawlGen = Music.gen;
      this.crawlTo = 回拽 ? this.crawlSet : to;
      /* 上一帧写到哪儿自己记着，别再回头读 box.scrollTop —— 那是每帧一次强制布局。
         门槛从前是 0.5 像素，可比一帧走的还大：整页一句 3 秒走 60 像素，一帧才 0.33 像素 ——
         于是两三帧才动一次、一次两三个像素，那就是「卡顿」。放到 0.05，一帧一帧照着走。 */
      if(Math.abs((this.crawlSet == null ? box.scrollTop : this.crawlSet) - this.crawlTo) > 0.05){
        this.crawlSet = this.crawlTo; box.scrollTop = this.crawlTo;
      }
      this.crawling = requestAnimationFrame(step);
    };
    this.crawling = requestAnimationFrame(step);
  }
}

/* ---------- 八、播放器指定 ----------
   自动挑「正在放的那一个」不准的时候，自己点定一个播放器。
   选出来的名字只写进 %LOCALAPPDATA%\Flow-Desk\players\pin.txt 这一行明文：
   FD 设置里改，WNW 停靠读到的是同一个值，两边不用对表。 */
function musPlayerField(){
  const A = musApp();
  if(!A || typeof A.mediaPin !== 'function') return null;
  const sel = h('select', { class:'mu-sel' });
  const out = h('div', { class:'mu-pin' }, [sel]);
  let sig = '';
  const draw = () => {
    const apps = [];
    const add = a => { a = String(a || ''); if(a && !apps.includes(a)) apps.push(a); };
    for(const s of Music.list) add(s && s.app);
    add(Music.pin);
    const next = Music.pin + '|' + apps.join('|');
    if(next === sig) return;
    sig = next;
    sel.innerHTML = '';
    sel.appendChild(h('option', { value:'', selected:!Music.pin }, '自动选择正在播放内容'));
    for(const a of apps) sel.appendChild(h('option', { value:a, selected:a === Music.pin, title:a }, musPlayer(a)));
    if(Music.pin && !apps.includes(Music.pin)) sel.appendChild(h('option', { value:Music.pin, selected:true }, musPlayer(Music.pin)));
    sel.value = Music.pin;
  };
  sel.addEventListener('change', async () => {
    const r = await A.mediaPin(sel.value);
    if(r && r.ok === false){ toast(r.msg || '指定未写入'); return; }
    Music.pin = sel.value; sig = ''; draw();
    Music.ask();
  });
  Music.init();
  draw();
  /* 会话列表是随事件来的：多挂一个听众，面板开着时新开的播放器也能进下拉。面板一关就自己摘掉 */
  const off = A.mediaOn ? A.mediaOn(() => { if(!sel.isConnected){ try{ off && off(); }catch(e){} return; } draw(); }) : null;
  return out;
}

/* 音乐文件夹：歌词的「同目录同名」往这里找，子文件夹一层层穿透下去。
   Flow-Desk 程序里这一行存的是 %LOCALAPPDATA%\Flow-Desk\players\musicdir.txt，FD 卡和 WNW 停靠读同一行；
   这一棵里没有主进程那层桥时（本地开发那台服务器）存不了绝对路径，退成页面自己那次 showDirectoryPicker。 */
function musDirField(){
  const A = musApp();
  const out = h('div', { class:'mu-pin' });
  const btn = (label, onclick) => h('button', { class:'wnw-btn mini', onclick }, label);
  const clear = () => {
    MusLy.dir = null; MusLy.dirName = ''; MusLy.dirPath = '';
    MusLy.files = []; MusLy.handles = new Map(); MusLy.cache = new Map(); MusLy.scanned = false;
    State.set('music-dir', null); State.set('music-dir-name', '');
    Music.loadLyric(); Music.tell();
  };
  const draw = () => {
    const shown = Music.musicDir || MusLy.dirName || '';
    out.innerHTML = '';
    out.appendChild(h('span', { class:'mu-dirpath', title:shown || '尚未指定' },
      shown || '尚未指定（识别歌词无需指定）'));
    out.appendChild(btn(shown ? '更换文件夹' : '选择文件夹', async () => { await MusLy.pickDir(); draw(); }));
    if(shown) out.appendChild(btn('不指定', async () => {
      if(A && typeof A.mediaDirSet === 'function'){
        const r = await A.mediaDirSet('');
        if(r && r.ok === false){ toast(r.msg || '未写入'); return; }
        Music.musicDir = '';
      }
      clear(); draw();
    }));
  };
  Music.init();
  draw();
  return out;
}

/* ---------- 九、监听插件 ----------
   MusicBee 本体一个字都不往系统的媒体控件写，所以光靠 SMTC 永远监不到它 —— 得给它装一个插件。
   这个按钮做的事：让主进程去找 MusicBee 装在哪，把**本包里**那个 mb_FlowDesk.dll（插件清单
   assets.bridge 点的名，`landAsset` 读的是活的 data\components\music-remote\，resources\app\plugin\
   那一份只是这棵树上还没有组件文件夹时的出厂兜底）拷进它的 Plugins\（同名先留 .bak），
   装完重启 MusicBee 生效。
   它调的是 MusicBee 自己的插件 API，所以只治 MusicBee 这一家；
   Spotify / PotPlayer / 媒体播放器 / 网页播放器那些本来就自己发 SMTC，不需要插件。 */
function musBridgeField(){
  const A = musApp();
  if(!A || typeof A.mediaBridge !== 'function') return null;
  const tip = '如果无法监听本地播放器，安装此插件（MusicBee 本体不往外报进度，装完要重启它；别的播放器不需要）';
  const out = h('div', { class:'mu-pin' });
  const st = h('span', { class:'mu-bridge' }, tip);
  const btn = h('button', { class:'wnw-btn mini', title:tip }, '安装监听插件');
  btn.addEventListener('click', async () => {
    btn.disabled = true; st.textContent = '在找 MusicBee 装在哪…';
    let r = null;
    try{ r = await A.mediaBridge(); }catch(e){ r = { ok:false, msg:String((e && e.message) || e) }; }
    btn.disabled = false;
    st.textContent = (r && r.msg) || '没成，再点一次试试';
    if(r && r.ok){ Music.ask(); toast('插件已安装，已适配MusicBee监听'); }
  });
  out.append(btn, st);
  return out;
}

export default {
  icon:'♪',
  desc:'系统播放器的歌名·进度·播放控制，歌词认 ttml 逐字三行 / lrc / elrc',
  /* band：整页那一屏要的是中间一条竖带，不是一面墙（外16 甲-3「展开的面板也要收」） */
  card:{ minW:10, minH:4, def:{ w:16, h:7 }, native:true, band:true, noName:true, wait:'正在连系统播放器…' },
  init(ctx){
    K = ctx;
    /* 把这一家的标签读者挂到共用那一格上：词格的「从歌曲标签提取歌词」用的就是下面这一份 MusEmb，
       不在词格那头再抄一份 ID3 / Vorbis / MP4 / Matroska 的字节解析（作者 2026-10-09 图11） */
    if(K.tag) K.tag.use(MusEmb);
    K.style(MUS_CSS);
    /* 加载器读 def.ready 决定何时摆卡：连不上系统播放器也照常铺，卡里自己说清楚 */
    this.ready = Music.init();
  },
  /* 齿轮对话框：原来垫在「设置 · 组件」里的三行搬回这一个包自己（FD 卡与 WNW 停靠共用这一份）。
     这一棵里没有系统会话那条口子（本地开发那台服务器），指定播放器 / 监听插件两行返回 null，这里就不摆。 */
  settings(C){
    const c = Object.assign({}, C, K);
    const rows = [];
    const add = (label, node) => {
      if(node) rows.push(c.el('div', { style:'display:grid;gap:6px;margin-bottom:14px' },
        [c.el('div', { class:'fd-hint' }, label), node]));
    };
    add('指定播放器', musPlayerField());
    add('音乐文件夹', musDirField());
    add('监听插件', musBridgeField());
    /* 丙：三档字分开调，一行一档 —— 这一排的构造与整页那一屏的「字」面板共用 musTypeRows()，
       不写第二份。松手才写小抄（change 不是 input）：一路拖着就一路写盘，那本文件是两边共读的。 */
    for(const r of musTypeRows()) rows.push(r);
    if(!rows.length) return;
    c.dialog.open('设置 · ' + c.pack.name,
      c.el('div', { style:'min-width:min(560px,88vw)' }, rows),
      [c.el('button', { class:'fd-btn primary', onclick:() => c.dialog.close() }, '好')]);
  },
  mount(host, ctx){
    const v = new MusicView(host, ctx || {});
    MUS_VIEWS.push(v);
    v.draw();
    if(MusLy.doc || !MusLy.src) Music.loadLyric();
    /* 挂一处音乐就报一笔账（主进程数着这些账起/收后台监听）：卡撤了账也销，
       最后一处销完，那个隐藏的 PowerShell 子进程就跟着收 —— 监听跟着功能走。 */
    const A = musApp();
    const hold = !!(A && typeof A.mediaHold === 'function' && typeof A.mediaRelease === 'function');
    if(hold){ try{ A.mediaHold(); }catch(e){} }
    let paid = hold;
    return { unmount(){
      v.dispose();
      if(paid){ paid = false; try{ A.mediaRelease(); }catch(e){} }
    } };
  }
};

const MUS_CSS = `
.mu{display:flex;flex-direction:column;gap:.45em;min-height:0;font-size:1em;line-height:1.4}
.mu-id{min-width:0}
.mu-t{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mu-mini .mu-t{font-size:1.12em}
.mu-a{color:var(--text-light);font-size:.85em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* 专辑封面那一列：外层只管横着排（左边封面、右边原来那一竖列），顶对齐到歌名那一行。
   大小一律 em：FD 小卡里 fitBox 那套把 --fit 乘在这一层字号上、为写那两档乘的是 --vsc，
   em 跟着一起缩 —— 封面永远等于「这一档字号的两行字高」，整页那一档大一些，不钉一个像素数。
   边框不在外观层那份描边名单里，按这一家别处的写法钉 1px 走 --ctl-edge */
.mu-shell{display:flex;align-items:flex-start;gap:.5em;min-width:0;min-height:0;width:100%}
.mu-shell>.mu{flex:1 1 auto;min-width:0;min-height:0}
.mu-shell-full{height:100%;align-items:stretch}
.mu-cover{position:relative;align-self:flex-start;flex:0 0 auto;width:2.75em;height:2.75em;overflow:hidden;
  display:flex;align-items:center;justify-content:center;
  border-radius:var(--r-btn,5px);border:1px solid var(--ctl-edge,var(--input-border))}
.mu-shell-full .mu-cover{width:6em;height:6em}
/* 内嵌图没认回来（或者解不出来）那一段：这一张是透明的，底下那张音符顶着，不闪一块灰 */
.mu-art{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .16s ease}
.mu-cover:not(.mu-ph) .mu-art{opacity:1}
.mu-cover:not(.mu-ph) .mu-art-note{display:none}
.mu-art-note{width:54%;height:54%;flex:0 0 auto;color:var(--text-light)}
.mu-btns{display:flex;gap:.4em;align-items:center}
/* 按钮的边框交给外观层（挂 data-look-ctl / data-look-edge，见 _shared/sh-look.js 末尾那段说明）：
   这一排只摆图片的不给常驻细边，免得一个一个圈起来把那一行切碎；「手动选择音频」那个文字按钮给。
   悬停和选中那两档的状态色留在这里 —— 类名带状态的选择器比外观层那一条重一级，压得住。 */
.mu-btn{flex:0 1 auto;min-width:0;padding:.2em .6em;white-space:nowrap;
  background:var(--btn-bg);color:var(--text);border-radius:var(--r-btn,5px);cursor:pointer;line-height:1.3}
.mu-btn:not(.mu-pick){width:2.15em;height:2.15em;padding:0;display:inline-flex;align-items:center;justify-content:center}
.mu-ico{width:1.15em;height:1.15em;display:block}
.mu-btn:hover:not(:disabled){border-color:var(--text)}
.mu-btn.on{background:var(--accent-light);border-color:var(--loaded-border);color:var(--accent-text,var(--accent))}
.mu-btn:disabled{opacity:.4;cursor:default}
/* 注音 / 翻译两个：关着的那个淡下去，不用读字也知道现在是什么档 */
.mu-btn.mu-dim{opacity:.42}
.mu-bar-row{display:flex;gap:.6em;align-items:center;min-width:0}
/* 进度条那一槽：底色是「一条压在某块面上的缝」，不是控件边框 —— 走分隔线那一族，
   从前吃 --input-border，换到深一点的配色上那条缝跟卡面糊成一块 */
.mu-bar{position:relative;flex:1 1 auto;min-width:0;height:.5em;border-radius:var(--r-pill,5px);background:var(--hair-color);cursor:pointer}
.mu-bar.mu-off{cursor:default;opacity:.5}
.mu-fill{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:var(--r-pill,5px);background:var(--accent)}
.mu-time{flex:0 0 auto;font-variant-numeric:tabular-nums;color:var(--text-light);font-size:.78em}
.mu-cur{min-height:1.5em;font-size:1.05em;overflow:hidden}
.mu-src{color:var(--text-light);font-size:.75em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.85}
.mu-src.mu-warn{color:var(--accent-text,var(--accent))}
.mu-none{opacity:.5}
/* 指定播放器那一栏：设置面板里的原生下拉，跟着控件圆角走 */
.mu-pin{display:flex;gap:.5em;align-items:center;flex-wrap:wrap}
.mu-dirpath{max-width:min(420px,60vw);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-size:.9em;color:var(--muted)}
/* 下拉是原生 select：外观层那三份名单里本来就有裸 select（边框、底色、焦点框），
   这里再写一遍边框和底色只会跟它打架，只留尺寸和圆角 */
.mu-sel{max-width:min(300px,60vw);padding:.25em .4em;border-radius:var(--r-btn,5px);font:inherit}
.mu-sel:hover{border-color:var(--text)}
.mu-lag{display:inline-flex;gap:.4em;align-items:center;font-size:.82em;color:var(--text-light)}
/* 归零那一个：挂在 label 外面（label 里塞按钮，点它会顺带把滑杆抢去激活）。
   从前这里压过 font-size:.78em 和一圈小内距 —— 外27 图5 说的「高度不和谐」就是它：上面那一排清秀按钮
   是 1em，它自己缩一号，两排摆在一起一头高一头矮。现在按钮本身照上面那一排走，只留不许折行。 */
.mu-lag-wrap{display:inline-flex;gap:.35em;align-items:center}
.mu-lag-rst{white-space:nowrap}
.mu-lag-r{width:110px;accent-color:var(--accent);cursor:pointer}
/* 系统音量一排：静音图标 + 滑杆（边框底色交给外观层 data-look-ctl，滑杆是裸控件本来就有人管） */
.mu-vol{display:inline-flex;align-items:center;gap:.35em;min-width:0}
/* 系统音量取不到时整排收掉。不能用 hidden 那个属性：上面这条 display:inline-flex 会把它顶掉 */
.mu-vol.mu-off{display:none}
.mu-vol.mu-dim{opacity:.45}
.mu-vol-r{width:96px;min-width:0;accent-color:var(--accent);cursor:pointer}
.mu-mini .mu-vol-r{width:64px}
.mu-bridge{font-size:.82em;color:var(--text-light);max-width:min(520px,60vw);line-height:1.35}
.mu-tools{display:flex;gap:.6em;align-items:center;flex-wrap:wrap;padding-bottom:.3em}
/* 丙：「字」那张面板 —— 收着的时候一点位置都不占；撑开时宽度和齿轮那一框同一档（560px），
   两处同样的六个控件，滑杆行程也就一样长，不至于一屏宽的面板上拖一格跳三档。 */
.mu-typep{display:none;flex:0 0 auto}
.mu-typep.on{display:block;max-width:min(560px,100%);padding:.1em 0 .5em}
.mu-list{flex:1 1 auto;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:.15em;padding-right:2px}
/* 没带时间戳的歌词只有亮度两档，逐字那套走下面 .mu-ka。
   这把尺从前压在整行（.mu-line）上，翻译那一行跟着一起亮一起暗 —— 他 2026-10-08 要的是
   「翻译/注释始终浅色字，不跟随播放变色」，而父级的 opacity 孩子没法抵消，所以尺子挪到
   原文和注音那两块身上（两个数值一个字没改：没唱到 .42、正在唱 1）。
   翻译那一行（.mu-trans —— 文件头那份译法和 *注 都摆在这儿）从此恒定，只剩它自己的浅色字。 */
.mu-line{transition:opacity .18s;padding:.18em 0}
.mu-line .mu-main,.mu-line .mu-note{opacity:.42;transition:opacity .18s}
.mu-line.act .mu-main,.mu-line.act .mu-note{opacity:1}
/* 外34 图10「自选颜色后，首页遥控器歌词又变成三种颜色」：原文这一块从来没说自己该是什么色，
   于是一路继承到卡片正文（--text）。内置那两套里 正文 和 浅色 挨得近，看不出来；自选颜色之后
   三个来源能拉开三种色相（正文 / 浅色 / 强调），一块歌词上就成了三种颜色。
   现在钉死和他定的那三档同一个来源：没唱到 = 浅色，唱到 = 强调，唱过 = 保持强调（不往淡里退）。
   逐字那一路不受牵连 —— 字在 .mu-w 里是 color:transparent 裁渐变，这一块的色它看不见。 */
.mu-line .mu-main{color:var(--text-light)}
.mu-line.act .mu-main,.mu-line.sung .mu-main{color:var(--accent);opacity:1}
/* 丙：三档字的字号一律乘在原来那一档上（--mu-fs-*，1 = 一个字不动），粗细 0 走 inherit 等于不覆盖。
   变量由 MusicView.typeVars 写在 .mu 身上，一处一份，别处不受牵连。 */
.mu-main{font-size:calc(1.05em * var(--mu-fs-main,1));font-weight:var(--mu-fw-main,inherit)}
/* 当前行不再单独放大一档。外13 那条「歌词字号恒定」当时只改到卡片，整页和停靠这一路还留着
   1.22em + 加粗：一换行整列重排一次，行高和它到滚动内容顶的距离跟着变，
   滚动判定和落点每换一行漂一回 —— 看上去就是歌词乱跳（外15 第 1 条）。
   「正在唱哪一行」交给亮度那两档（.mu-line / .mu-line.act）和逐字填充，不靠字号。 */
.mu-w{opacity:.55}
.mu-line.act .mu-w{opacity:.7}
.mu-note{font-size:calc(.82em * var(--mu-fs-note,1));font-weight:var(--mu-fw-note,inherit);color:var(--text-light);letter-spacing:.14em}
.mu-trans{font-size:calc(.86em * var(--mu-fs-trans,1));font-weight:var(--mu-fw-trans,inherit);color:var(--text-light)}
.mu-note .mu-w{opacity:.6}
/* 逐字对应：一个字／音节一格，注音在上歌词在下竖着排；inline-flex 列的格宽自己取
   两件里较宽的那一件 —— 注音宽就宽给注音，字宽就宽给字，不平均摊、不硬算字符数。
   注音字号保持 .82em 这一档（正文注音档位的下限），行放大时它跟着行一起放大。
   列与列之间留一道缝：这里不写 column-gap 时相邻两格的间距实测是 0px，注音比字窄的那些歌
   （英文／韩文一个字母一格的，以及整首没注音的）字就贴成一串，看不出哪里是一格。
   用 em 不用 px：卡片那一档缩放和整页放大都跟着字号走，不落第二个数。 */
.mu-pair{display:flex;flex-wrap:wrap;column-gap:.32em}
.mu-p{display:inline-flex;flex-direction:column;align-items:stretch;max-width:100%}
.mu-p .mu-w{text-align:center;white-space:pre-wrap;overflow-wrap:break-word}
/* 逐字格里的注音和整行那一档注音是同一档字，吃同一个 --mu-fs-note；min-height 也一起乘，
   不然字号调大以后格子里那行字会被原来那个高度夹掉 */
.mu-pn{font-size:calc(.82em * var(--mu-fs-note,1));font-weight:var(--mu-fw-note,inherit);color:var(--text-light);
  min-height:calc(1.2em * var(--mu-fs-note,1));display:flex;align-items:center;justify-content:center}
.mu-pn .mu-w{opacity:.6}
/* 逐字卡拉OK（带时间戳的歌词才走这套）：一个字裁两层渐变，上层是「唱到的」颜色，从 0% 填到 100%，
   下层是「还没唱到」的颜色 —— 唱过的字保持满色，整行唱完由 .sung 把这两层一起换成「已唱」那一档彩色。
   三档的分工钉死：未唱 = 浅，唱到 = 灰底上推彩色，唱过 = 保持彩色（不再往淡里退）。
   浅这一档不另掺灰、不自己算色：用上面那条 .mu-line 的亮度尺（opacity），跟没戳那套同一把，
   深浅主题、卡片 / 停靠 / 整页三个宿主都不用各给一个数。 */
.mu{--mu-next:var(--text-light);--mu-cur:var(--accent);--mu-sung:var(--accent)}
.mu-ka .mu-line.act .mu-main,.mu-ka .mu-line.act .mu-note,.mu-ka .mu-line.sung .mu-main,.mu-ka .mu-line.sung .mu-note{opacity:1}
.mu-ka .mu-w{opacity:1;color:transparent;
  background-image:linear-gradient(var(--mu-f,var(--mu-next)),var(--mu-f,var(--mu-next))),
    linear-gradient(var(--mu-b,var(--mu-next)),var(--mu-b,var(--mu-next)));
  background-repeat:no-repeat;background-position:0 0;background-size:100% 100%,100% 100%;
  -webkit-background-clip:text;background-clip:text}
/* 正文那档 .mu-line.act .mu-w 的 opacity:.7 是给没戳那套压亮度的，逐字这一路会把它连彩色一起稀释
   （彩色的那一截被压成淡彩，看着就成了"唱到的比唱过的还浅"），这里改回 1。 */
.mu-ka .mu-line.act .mu-w{opacity:1}
.mu-ka .mu-line.act{--mu-f:var(--mu-cur);--mu-b:var(--mu-next)}
.mu-ka .mu-line.sung{--mu-f:var(--mu-sung);--mu-b:var(--mu-sung)}
/* 注音、翻译两行从前在这里各配一档（没唱到 .5 / 正在唱 .92 / 唱过 .62），叠在整行那把亮度尺上头。
   尺子挪到 .mu-main / .mu-note 之后这三档不再要了：注音本来就在这两块里头，跟着行走一档就够；
   翻译那一行按他 2026-10-08 那句「始终浅色、不跟随播放变色」—— 这里一律不给档。 */
/* 演唱者轮换 / 对唱 / 和声：这三样各给一个自己的形状，不靠颜色单独说话。
   声部标记 = 一枚点 + 名字：实心点是第一声部，空心环是第二声部，往后圆角方块、方块环接着排；
   颜色吃色位那五档（外观层按与卡面 3:1 保过的那一枚 --slot-N-dot），深浅底都读得出来。 */
.mu-vo{display:inline-flex;align-items:center;gap:.35em;font-size:.74em;line-height:1.35;color:var(--text-light)}
.mu-vo i{flex:0 0 auto;width:.52em;height:.52em;border-radius:50%;background:var(--mu-vo-c,var(--accent))}
.mu-vo.v1 i{border-radius:50%;background:transparent;box-shadow:inset 0 0 0 2px var(--mu-vo-c,var(--accent))}
.mu-vo.v2 i{border-radius:.14em}
.mu-vo.v3 i{border-radius:.14em;background:transparent;box-shadow:inset 0 0 0 2px var(--mu-vo-c,var(--accent))}
.mu-vo.v0{--mu-vo-c:var(--slot-1-dot,var(--accent))}
.mu-vo.v1{--mu-vo-c:var(--slot-2-dot,var(--accent))}
.mu-vo.v2{--mu-vo-c:var(--slot-3-dot,var(--accent))}
.mu-vo.v3{--mu-vo-c:var(--slot-4-dot,var(--accent))}
.mu-vo.v4{--mu-vo-c:var(--slot-5-dot,var(--accent))}
/* 文件里整首没标声部：演唱者那一行只报艺人名字，不摆点（没得区分就不摆标记） */
.mu-vo.nov i{display:none}
/* 行首那一枚只在换了人的那一行出现 */
.mu-line .mu-vo{margin-bottom:.12em}
/* 演唱者那一行：摆在进度条和歌词之间，卡片和整页都有一行。对唱两枚并列、中间一道斜杠。 */
.mu-who{display:flex;align-items:center;gap:.45em;flex-wrap:wrap;font-size:.82em;min-height:1.3em;color:var(--text-light)}
.mu-who .mu-vo{font-size:1em}
.mu-and{opacity:.5}
/* 和声（ttml 里 ttm:role="x-bg" 的那些字）：小一档、淡一档，字底压一条细线 ——
   逐字那套里它不吃强调色，唱到了也只填「已唱」那一档，和主旋律分开 */
.mu-w.bg{font-size:.86em;opacity:.5;text-decoration:underline;
  text-decoration-color:color-mix(in srgb,var(--text) 32%,transparent);text-underline-offset:.2em}
.mu-line.act .mu-w.bg{opacity:.55}
.mu-ka .mu-w.bg{--mu-f:var(--mu-sung);--mu-b:var(--mu-next)}
/* 小卡：框窄了就让注音和翻译自己换行，别一行截断；当前这一行三行都摆（原文／注音／翻译）。
   这一句没有注音或翻译时那一格照样占着（lineNode 的 keep），所以同一档开关下这块高度是定的，
   换句不跳；把开关关掉才是真的撤掉那一格，行高三行变两行。 */
.mu-mini{justify-content:center}
.mu-mini .mu-line{opacity:1;padding:0}
.mu-mini .mu-line.act .mu-main{font-size:1.1em}
.mu-mini .mu-note,.mu-mini .mu-trans{white-space:normal;overflow-wrap:break-word;min-height:1.15em}
/* 小卡当前句：整首歌词叠在同一格（grid-area 1/1），只有 act 那一行露出来。
   这一格的高度 = 全歌最高那一行，换行只挪可见记号、不动 DOM —— FD 卡片量高配字号的
   那套缩放（fitBox）读到的永远是同一个高度，整卡字号钉死一档，宁可整体偏小也不跳。
   act 那行的加急放大提前铺给全摞每一行（不然 act 一换、字宽一变、行高一变，又白跳一次）。 */
.mu-mini .mu-cur{display:grid;align-content:center;justify-items:stretch}
.mu-mini .mu-cur .mu-line{grid-area:1/1;visibility:hidden}
.mu-mini .mu-cur .mu-line.act{visibility:visible}
/* 卡片那一档当前行的放大照旧乘在 --mu-fs-main 上（原来那 1.1em 是相对值，不乘的话调字号它不动）；
   700 这一档不加变量 —— 卡片就靠这一行加粗认「现在唱这句」，是他定的样子，不跟着调。 */
.mu-mini .mu-cur .mu-line .mu-main{font-size:calc(1.1em * var(--mu-fs-main,1));font-weight:700}
/* 演唱者那一行在卡片上钉死一行：对唱名字长就截尾，不许换行 —— 换一行高度就变，缩放就跟着跳 */
.mu-mini .mu-who{flex-wrap:nowrap;overflow:hidden;white-space:nowrap}
/* 整页：顶上控制区不吃高度，歌词自己滚 */
.mu-full{height:100%;padding:2px}
.mu-full .mu-id{flex:0 0 auto}
.mu-full .mu-t{font-size:1.3em}
/* 整页那一屏改成桌面歌词那一档（外16 甲-3）：不再横着铺满一整屏，中间只留一条竖带，
   一段靠一边、段与段左右轮换，当前这一句由 crawl 那一趟钉在带子的垂直正中慢慢走。
   行本身按内容宽收（align-self 才分得出左右），逐字那一档是 flex 排的，
   text-align 管不着它，单独给一句 justify-content。 */
/* 滚动条这一档整页用不上：打字机自己会带着走，露一条在右边就是个人工痕迹（外17 乙-2）。
   左右换边那两档原来贴着带子的边，看着像被切掉半个字，两边各让出一格。
   两边留白不等（外17 丙-2）也是这一档：歌词块是在 .mu 那一竖列里居中的，而这一列的左边
   还压着封面那一整列（6em 宽 + .5em 间距），于是居中居的是「扣掉封面列之后」的中 ——
   字面离面板右边只剩一点，离左边多出一整列封面。把这一截补进右内边距，字面才回到面板正中。
   46em 那一道上限撤掉了（外27 图12）：面板本来就能水平拖宽（外17 乙-6），拖宽了歌词区却还钉在
   46em 上，右边空出一大片 —— 他要的是「拉宽时歌词区宽度跟着变宽」。现在这一列跟着面板走，
   带子的样子由面板自己的宽度决定，不再另有一道尺。 */
.mu-full .mu-list{width:100%;margin-inline:auto;overscroll-behavior:contain;
  padding-left:1.1em;padding-right:calc(1.1em + 6em + .5em);scrollbar-width:none}
.mu-full .mu-list::-webkit-scrollbar{width:0;height:0;display:none}
.mu-full .mu-line{max-width:100%}
.mu-full .mu-line.mu-left{align-self:flex-start;text-align:left}
.mu-full .mu-line.mu-right{align-self:flex-end;text-align:right}
.mu-full .mu-line.mu-seg0{align-self:center;text-align:center}
.mu-full .mu-line.mu-right .mu-pair{justify-content:flex-end}
/* 乙-2 间奏分隔：一道虚线，当中写这段空档多长。单独一格、不算歌词行（this.rows 不收它），
   所以逐行落点、打字机那把尺都照旧按歌词的序号数。 */
.mu-gap{display:flex;align-items:center;gap:.7em;flex:0 0 auto;margin:.55em 0;
  font-size:.8em;color:var(--text-light);opacity:.72}
.mu-gap::before,.mu-gap::after{content:'';flex:1 1 auto;min-width:1.2em;
  border-top:1px dashed var(--hair-color,var(--card-border))}
/* 正在走的那一道：摆的是还剩多久，所以要读得清 —— 其余各道仍旧淡淡的。
   数字按等宽落，秒数一跳不至于把这一行的宽度抖来抖去（这一屏是竖着滚的，宽度一变就是一次重排）。 */
.mu-gap.now{opacity:.95;color:var(--text);font-variant-numeric:tabular-nums}
/* ③ 停靠那一栏本来就窄：上面那两条为「左边压着封面一整列」做的居中补偿（6em + .5em 再补一份），
   在这一栏里会把歌词挤成一小条 —— 320 像素宽的栏算下来字面只剩七十来像素，就是他说的「太窄」。
   这一档封面那一列整个不占位，歌词撑满栏宽、左右只留一线缝；整页那一屏不受牵连，补偿照旧。 */
.mu-shell-full.mu-dock-shell .mu-cover{display:none}
.mu-full.mu-dock .mu-list{max-width:100%;padding-left:2px;padding-right:2px}
`;

/* 原来「十、设置 · 组件」里垫的那三行（指定播放器 / 音乐文件夹 / 监听插件）
   已搬进上面 export default 的 settings(C)：这一个包自己的齿轮对话框，FD 卡和 WNW 停靠共用。 */
