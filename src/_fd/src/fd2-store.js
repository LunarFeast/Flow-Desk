/* ============================================================
   FD 数据层 fd.storage
   三个后端，接口完全一致：
     dir  —— File System Access 授权的真实目录（用户自己选的，明文文件）
     app  —— Electron：数据\userdata-fd\ 那一份，明文文件，不用授权也不用选
     idb  —— IndexedDB 镜像：目录没选、exe 旁边那份明文也不在这儿时先存在这儿，可以一键导出成明文
   优先级：用户选过的目录 > 数据\userdata-fd\ 里的明文 > 镜像。
   设置（工具记忆那批 set-* 键）始终存 IndexedDB：授权之前就要能记住上次的选择。
   外观（色卡 + 卡片质感 / 背景 / 圆角 / 字体）是同一份明文 appearance.json，走上面这三个后端。
   IndexedDB 那一层（idbOpen / idbRun / IDB 这个按键值取放的薄壳）住在 _shared/sh-store.js，
   和为写共用一份 —— 从前这里也养着一套自己的，两份同名不同形，一处补了截止时间另一处照旧悬着。
   ============================================================ */
const META = { db:'fd-meta', store:'kv' };
const MIRROR = { db:'fd-files', store:'files' };

const Store = {
  dir:null,            // FileSystemDirectoryHandle
  appDir:'',           // Electron：数据\userdata-fd\，明文文件默认落这儿
  cache:new Map(),     // rel -> 已解析对象（内存镜像，UI 同步读）
  dirty:new Set(),
  flushTimer:null,

  backend(){ return this.dir ? 'dir' : (this.appDir ? 'app' : 'idb'); },
  dirName(){ return this.dir ? this.dir.name : (this.appDir || ''); },

  /* ---------- exe 里：用户目录就是数据目录，不用问也不用选 ---------- */
  async appInit(){
    if(!window.FD_APP || !window.FD_APP.dataRead) return false;
    try{ this.appDir = await window.FD_APP.dataDir() || ''; }catch(e){ this.appDir = ''; }
    return !!this.appDir;
  },
  /* 首次进 exe：镜像期攒下的数据搬成 数据\userdata-fd\ 里的明文，搬之前原样各留一份 *.old.json */
  async migrateToApp(){
    if(!this.appDir || this.dir) return 0;
    const A = window.FD_APP;
    if(await A.dataRead('migrate.json')) return 0;
    let n = 0;
    for(const rel of Packs.dataFiles(['appearance.json','palette.json','settings.json','layout.json','phrases.json'])){
      const v = await IDB.get(MIRROR.db, MIRROR.store, rel);
      if(v === undefined) continue;
      const text = JSON.stringify(v.value, null, 2);
      await A.dataWrite(rel.replace(/\.json$/, '.old.json'), text);
      await A.dataWrite(rel, text);
      n++;
    }
    await A.dataWrite('migrate.json', JSON.stringify({ at:new Date().toISOString(), moved:n }, null, 2));
    return n;
  },

  /* ---------- 启动时尝试恢复上次授权 ---------- */
  async restore(){
    try{
      const h = await IDB.get(META.db, META.store, 'dirHandle');
      if(!h || !h.queryPermission) return false;
      let st = await h.queryPermission({ mode:'readwrite' });
      if(st !== 'granted') return false;   // 需要用户手势才能再要权限，界面给"连接目录"按钮
      this.dir = h;
      return true;
    }catch(e){ return false; }
  },
  async connect(){
    const h = await window.showDirectoryPicker({ mode:'readwrite', id:'fd-data' });
    /* 提示用户选 FD 数据根目录；子目录 fd/ 由程序自建 */
    this.dir = h;
    await IDB.put(META.db, META.store, h, 'dirHandle');
    await this.migrateMirrorToDir();
    return h.name;
  },
  async forget(){
    this.dir = null;
    await IDB.del(META.db, META.store, 'dirHandle');
  },
  /* 首次连接：把镜像期攒下的数据写进真实目录，之后以目录为准 */
  async migrateMirrorToDir(){
    for(const rel of Packs.dataFiles(['appearance.json','palette.json','settings.json','layout.json','phrases.json'])){
      const v = await IDB.get(MIRROR.db, MIRROR.store, rel);
      if(v !== undefined){ await this.rawWrite(rel, JSON.stringify(v.value, null, 2)); await IDB.del(MIRROR.db, MIRROR.store, rel); }
    }
  },

  /* ---------- 原始读写 ---------- */
  async sub(rel, create){
    const parts = rel.split('/').filter(Boolean);
    let d = this.dir;
    for(let i = 0; i < parts.length - 1; i++) d = await d.getDirectoryHandle(parts[i], { create:!!create });
    return d;
  },
  async rawRead(rel){
    if(this.dir){
      try{
        const parent = await this.sub(rel, false);
        const fh = await parent.getFileHandle(rel.split('/').pop(), { create:false });
        return await (await fh.getFile()).text();
      }catch(e){ return null; }
    }
    if(this.appDir) return await window.FD_APP.dataRead(rel);
    const v = await IDB.get(MIRROR.db, MIRROR.store, rel);
    return v === undefined ? null : JSON.stringify(v.value);
  },
  async rawWrite(rel, text){
    if(this.dir){
      const parent = await this.sub(rel, true);
      const fh = await parent.getFileHandle(rel.split('/').pop(), { create:true });
      const w = await fh.createWritable();
      await w.write(text); await w.close();
      return;
    }
    if(this.appDir){ await window.FD_APP.dataWrite(rel, text); return; }
    await IDB.put(MIRROR.db, MIRROR.store, { value:JSON.parse(text), at:Date.now() }, rel);
  },
  async rawList(relDir){
    if(this.dir){
      const d = relDir ? await this.sub(relDir + '/x', false) : this.dir;
      const out = [];
      for await (const [name, h] of d.entries()) if(h.kind === 'file') out.push(name);
      return out.sort();
    }
    /* 用户目录里还混着 Chromium 自己的东西（DIPS / lockfile / Preferences），FD 的明文只有 json */
    if(this.appDir) return (await window.FD_APP.dataList()).filter(n => n.endsWith('.json') && (!relDir || n.startsWith(relDir))).sort();
    return (await IDB.keys(MIRROR.db, MIRROR.store, relDir)).sort();
  },

  /* ---------- 面向 widget 的 JSON 接口（带内存缓存 + 合并写盘） ---------- */
  async loadJSON(rel, fallback){
    if(this.cache.has(rel)) return this.cache.get(rel);
    const t = await this.rawRead(rel);
    let v = fallback;
    if(t !== null){ try{ v = JSON.parse(t); }catch(e){ console.warn('FD 数据文件解析失败：' + rel); } }
    this.cache.set(rel, v);
    return v;
  },
  saveJSON(rel, obj){
    this.cache.set(rel, obj);
    this.dirty.add(rel);
    clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flush(), 600);
  },
  async flush(){
    const list = [...this.dirty]; this.dirty.clear();
    for(const rel of list){
      try{ await this.rawWrite(rel, JSON.stringify(this.cache.get(rel), null, 2)); }
      catch(e){ this.dirty.add(rel); toast('写入失败：' + rel + '（' + e.message + '）'); }
    }
  },
  /* 设置：始终双写（IDB 保证授权前也在） */
  async saveSetting(key, val){ await IDB.put(META.db, META.store, val, 'set-' + key); },
  async loadSetting(key, fb){ const v = await IDB.get(META.db, META.store, 'set-' + key); return v === undefined ? fb : v; }
};
