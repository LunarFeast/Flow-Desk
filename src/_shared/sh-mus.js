/* ---------- 播放时钟：谁在放歌、放到第几毫秒 —— 音乐遥控器那一家往里填，别人（词格）只读 ----------
   为什么要有这一个：词格要「跟着播到哪儿」标出当前那一格，但不自建播放器（他的原话：不能直接和音乐遥控器对接吗？
   我不打算自建播放器）。而这一张页里从前没有一条能递这个数的路 —— 组件和为写各自一份 Bus（不同对象），
   players\\music.txt 里存的是歌词延迟和注音开关那一行，不是第几毫秒。所以补这一处：遥控器报，词格读。
   递的是「位置 + 那一刻的墙钟 + 倍速」这三样，读的一头自己插值，算式与遥控器卡片里那枚 nowMs() 同一套，
   两边不会各走各的。歌词延后那一档遥控器已经扣过了，这一头不许再扣第二遍。 */
const MusClock = {
  pos:0, at:0, rate:1, status:'', title:'', artist:'', dur:0, got:0,
  /* 遥控器每次 tell()（状态变了、命令下了、快照到了）顺手报一份进来 */
  set(s){
    if(!s) return;
    this.pos = Math.max(0, Number(s.pos) || 0);
    this.at = Number(s.at) || Date.now();
    this.rate = Number(s.rate) > 0 ? Number(s.rate) : 1;
    this.status = String(s.status || '');
    this.title = String(s.title || '');
    this.artist = String(s.artist || '');
    this.dur = Math.max(0, Number(s.dur) || 0);
    this.got = Date.now();
  },
  /* 正在放才往前走；暂停、断了、切歌那一瞬都只报最后知道的那一格，不自己瞎走 ——
     和遥控器「没有会话不等于唱回了开头」是同一条规矩（外15 第 1 条踩过）。 */
  now(){
    if(this.status !== 'Playing') return this.pos;
    const t = this.pos + (Date.now() - this.at) * (this.rate || 1);
    return this.dur > 0 ? Math.min(t, this.dur) : t;
  },
  live(){ return !!this.got && this.status === 'Playing'; },
  /* 歌名对不上时给读的一头看的：这一个词格是不是正配着当前这首歌 */
  match(name){
    const a = String(this.title || '').toLowerCase().replace(/\s+/g, '');
    const b = String(name || '').toLowerCase().replace(/\s+/g, '');
    return !!a && !!b && (a === b || a.indexOf(b) >= 0 || b.indexOf(a) >= 0);
  }
};

/* ---------- 歌曲标签里那份歌词的「挂号处」----------
   读标签的字节解析（mp3 的 USLT/SYLT、flac/ogg 的 TTMLLYRIC 与 UNSYNCEDLYRICS、m4a 的 ©lyr、mkv 的 Tags）
   住在音乐遥控器那一家里，它本来就要读这些才拿得到歌词。词格这边也要同一份（作者 2026-10-09 图11：
   「词格的导入新增一个从歌曲标签提取歌词」）—— 但那份解析不抄第二遍：抄一份就是两处真相，
   将来那一家支持了新的容器格式，这一份会悄悄读不到。
   所以这一节只当一个格子：那一家起来的时候把自己的读者挂上来（它的 ctx.tag，见 _shared/sh-load.js），
   别人调这一格。没挂上 = 那一家这一趟没加载，词格那一条入口自己说清楚，不假装读到了空歌词。 */
const MusTag = {
  r:null,
  use(o){ if(o && typeof o.from === 'function') this.r = o; return !!this.r; },
  get ready(){ return !!this.r; },
  from(fh, name){ return this.r ? this.r.from(fh, name) : Promise.resolve(null); }
};
