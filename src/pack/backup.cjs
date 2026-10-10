/* 定期备份：把用户数据这一层整份抄到他指定的文件夹里，一份一个时间戳文件夹。
   为什么单独一颗（不在 main.cjs 里就地写）：这一颗要能被自检脚本拿真的临时目录跑一遍 ——
   他这一批点名要「同步测试一下数据保护」，量不了的东西不算做完。
   所以 fs / path / now 都是递进来的，这颗自己不认识 Electron。

   三条硬规矩（照他定下的口径）：
   ① 一份要么是齐的、要么根本不存在：先写成 <时间戳>.正在写，全抄完了才改名成 <时间戳>，
      中途崩了只留一颗没改名的半成品，上一份完整的那份一个字节没动；
   ② 收旧份只收自己造的那几颗：文件夹名要合 FD-年-月-日-时分 这一式、里头还得有备份清单，
      两条都中才算「我抄的那一份」，他自己在那个文件夹里放的东西一律不碰；
   ③ 抄不动的文件一声不响不行：哪一个失败了列进清单的「没抄上」那一节，页面上报出个数。 */

const STAMP_RE = /^FD-\d{4}-\d{2}-\d{2}-\d{4}$/;
const MANIFEST = '备份清单.txt';
const DOING = '.正在写';

/* 时间戳：本地时分的写法（不是 ISO 的 UTC），他看的是自己表上的那一个时刻 */
function stampOf(d){
  const p = n => String(n).padStart(2, '0');
  return 'FD-' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
}

module.exports = function makeBackup(opt){
  const fs = opt.fs, path = opt.path, now = opt.now || (() => new Date());
  const logOf = opt.log || (() => {});

  /* ---------- 一、要抄哪些文件：每个根走一遍树，跳过的名单自己给 ---------- */
  async function walk(dir, base, skip, 错){
    const out = [];
    let ent = [];
    try{ ent = await fs.promises.readdir(dir, { withFileTypes:true }); }
    catch(e){ 错.push('读不到这一处：' + dir + ' · ' + (e && e.message || e)); return out; }
    for(const x of ent.sort((a, b) => a.name < b.name ? -1 : 1)){
      const rel = base ? base + '/' + x.name : x.name;
      if(skip && skip.includes(x.name)) continue;
      const p = path.join(dir, x.name);
      if(x.isDirectory()){ out.push(...await walk(p, rel, skip, 错)); continue; }
      if(!x.isFile()) continue;                 /* 链接、管道这类不抄 */
      out.push({ rel, p, name:x.name });
    }
    return out;
  }
  /* 一份计划：每个根归到哪一个子文件夹名底下（data / 用户配置 / 外加的那几个用它们自己的名字） */
  async function plan(cfg, roots){
    const job = [], 错 = [];
    for(const r of roots){
      if(!r || !r.dir) continue;
      let has = true;
      try{ await fs.promises.stat(r.dir); }catch(e){ has = false; }
      if(!has){ 错.push(r.label + '：那一处读不到（' + r.dir + '）'); continue; }
      const items = await walk(r.dir, '', cfg.skip || [], 错);
      job.push({ label:r.label, from:r.dir, items });
    }
    return { job, 错, 数:job.reduce((a, j) => a + j.items.length, 0) };
  }
  /* ---------- 二、抄：先落进 .正在写 那一颗，齐了再改名 ---------- */
  /* 落点跑在被抄的其中一处里面 → 抄出来的东西又被自己抄进去，越抄越大，这一趟当场拒 */
  function 在里子(p, dir){
    const a = path.resolve(p), b = path.resolve(dir);
    return a === b || a.startsWith(b + path.sep);
  }
  async function run(cfg, roots){
    const 时 = now(), 名 = stampOf(时);
    const dest = String(cfg.dest || '').trim();
    if(!dest) return { ok:false, msg:'还没定备份到哪一个文件夹' };
    for(const r of (roots || [])) if(r && r.dir && 在里子(dest, r.dir))
      return { ok:false, msg:'备份的落点跑在「' + r.label + '」那一处里面（' + r.dir + '），换个文件夹再来' };
    const 成品 = path.join(dest, 名), 草稿 = 成品 + DOING;
    const p = await plan(cfg, roots);
    if(!p.数) return { ok:false, msg:'一处都没读到，什么都没抄', 错:p.错, 数:0 };
    await fs.promises.mkdir(草稿, { recursive:true });
    let 抄 = 0, 字 = 0; const 坏 = [];
    const 清 = ['Flow-Desk 备份清单', '抄的时间：' + 时.toLocaleString(), '备份到：' + dest,
      '留几份：' + (cfg.keep || ''), ''];
    for(const j of p.job){
      清.push('—— ' + j.label + ' · 源：' + j.from + ' · ' + j.items.length + ' 个文件');
      for(const it of j.items){
        const to = path.join(草稿, j.label, ...String(it.rel).split('/'));
        try{
          const buf = await fs.promises.readFile(it.p);
          await fs.promises.mkdir(path.dirname(to), { recursive:true });
          await fs.promises.writeFile(to, buf);
          抄++; 字 += buf.length;
          清.push('  ' + j.label + '/' + it.rel + '\t' + buf.length);
        }
        catch(e){ 坏.push(j.label + '/' + it.rel + ' · ' + (e && e.message || e)); }
      }
      清.push('');
    }
    if(坏.length){ 清.push('—— 没抄上的 ' + 坏.length + ' 个：'); for(const b of 坏) 清.push('  ' + b); }
    /* 清单最后一个落：半成品那一颗里没有清单，收旧份那一头就认不出它、也就不会当成成品 */
    try{
      await fs.promises.writeFile(path.join(草稿, MANIFEST), 清.join('\n'), 'utf8');
      await fs.promises.rename(草稿, 成品);
    }
    catch(e){
      return { ok:false, msg:'这一份没收住：' + (e && e.message || e), 目录:草稿, 抄:抄, 字:字, 坏:坏, 错:p.错.concat(String(e && e.message || e)) };
    }
    const 收 = await prune(dest, cfg.keep);
    /* 多大这一句别写死 KB：几十个字的一份试抄出来报「0 KB」，看着就像没抄东西 */
    const 大 = 字 < 1024 ? 字 + ' 字节' : 字 < 10485760 ? (字 / 1024).toFixed(1) + ' KB' : (字 / 1048576).toFixed(1) + ' MB';
    return { ok:true, msg:'抄了 ' + 抄 + ' 个文件 · ' + 大, 目录:成品, 抄:抄, 字:字,
      坏:坏, 数:p.数, 错:p.错, 收:收 };
  }
  /* ---------- 三、收旧份：只收自己造的、有清单的那几颗 ---------- */
  const 半成品 = n => STAMP_RE.test(String(n || '').slice(0, -DOING.length)) && String(n || '').endsWith(DOING);
  async function prune(dest, keep){
    const n = Number(keep) || 0;
    let ent = [];
    try{ ent = await fs.promises.readdir(dest, { withFileTypes:true }); }
    catch(e){ return { 删:[], 留:[], 半:[], 错:String(e && e.message || e) }; }
    /* 抄到一半崩了会留下一颗没改名的 .正在写：它不算一份（名字不合式、也没有清单），
       但摆在那儿越攒越多。半小时开外的一律收掉 —— 这一刻真在抄的那一颗没这么老，收不到它。 */
    const 半 = [];
    for(const x of ent){
      if(!x.isDirectory() || !半成品(x.name)) continue;
      try{
        const st = await fs.promises.stat(path.join(dest, x.name));
        if(now().getTime() - st.mtimeMs > 18e5){
          await fs.promises.rm(path.join(dest, x.name), { recursive:true, force:true }); 半.push(x.name);
        }
      }catch(e){}
    }
    if(n <= 0) return { 删:[], 留:[], 半 };
    const 我的 = [];
    for(const x of ent){
      if(!x.isDirectory() || !STAMP_RE.test(x.name)) continue;
      let 有清单 = false;
      try{ await fs.promises.stat(path.join(dest, x.name, MANIFEST)); 有清单 = true; }catch(e){}
      if(有清单) 我的.push(x.name);
    }
    我的.sort();                                   /* 时间戳就是可排的写法，旧在前 */
    const 删 = 我的.length > n ? 我的.slice(0, 我的.length - n) : [];
    const 删了 = [];
    for(const d of 删){
      try{ await fs.promises.rm(path.join(dest, d), { recursive:true, force:true }); 删了.push(d); }
      catch(e){ logOf('收旧份没收掉 ' + d + '：' + (e && e.message || e)); }
    }
    return { 删:删了, 留:我的.filter(x => !删了.includes(x)), 半 };
  }
  /* 上一次抄到什么时候：在目标文件夹里找有清单的那几颗里最新的一个名字 */
  async function last(dest){
    if(!dest) return '';
    let ent = [];
    try{ ent = (await fs.promises.readdir(dest, { withFileTypes:true })).filter(x => x.isDirectory() && STAMP_RE.test(x.name)); }
    catch(e){ return ''; }
    for(let i = ent.length - 1; i >= 0; i--){
      try{ await fs.promises.stat(path.join(dest, ent[i].name, MANIFEST)); return ent[i].name; }catch(e){}
    }
    return '';
  }
  /* 时间戳那串名字读回时刻（备份文件夹的名字就是可排的写法，最新的那一颗就是上一次） */
  function stampTime(name){
    const m = /^FD-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})$/.exec(String(name || ''));
    if(!m) return 0;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
  }
  /* 到点没：上一次成功抄的时间 + 间隔 ≤ 现在，就算到点。没抄过（那一处空着）当场就算到点。 */
  const 隔 = cfg => ({ off:0, day:864e5, '3d':2592e5, week:6048e5 }[cfg.every || 'off']);
  function due(cfg, lastAt){
    const 分 = 隔(cfg);
    if(!cfg.on || !分) return false;
    if(!lastAt) return true;
    return now().getTime() - lastAt >= 分;
  }
  /* 下一回到点的那一刻（用来摆一颗一次性的表，不是一遍遍地问） */
  function nextAt(cfg, lastAt){
    const 分 = 隔(cfg);
    if(!cfg.on || !分) return 0;
    return (lastAt || now().getTime()) + 分;
  }
  /* 一问答完：上一次抄到什么时候、到点没、下一颗表该设到哪一刻。
     这一句摆在这儿而不是让页面自己算，是因为「上一次」写在磁盘上的文件夹名里，页面看不见。 */
  async function check(cfg){
    const 名 = await last(cfg && cfg.dest), 时 = stampTime(名);
    return { 上回:名, 上回时:时, 到点:due(cfg, 时), 下一回:nextAt(cfg, 时) };
  }
  return { run, plan, prune, last, due, nextAt, check, stampTime, stampOf, STAMP_RE, MANIFEST, DOING };
};
