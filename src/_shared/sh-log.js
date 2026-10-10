/* ============================================================
   生成库 · WNW 和 FD 共用这一份
   每个生成器一份明文：生成库\<组件id>.json，一条 = { t, text, sn }
     t   生成那一刻的时间戳（也是这条的号，删单条按它删）
     text 这一轮出结果的全文
     sn   当时每个控件填着什么（回看时认得出是哪一组输入）
   清理二选一：按数量留几条 / 按天数留几天，只按「生成器」各算各的；
   两个都设了就谁留得多听谁的。
   写盘走主进程（和词库同一个通道），这一棵里没有主进程那层时留一份镜像在宿主的 kv 里，照样能看能删。
   宿主契约（TOOL_HOST）：kv / logDir；另外用到 h() toast() State Bus copyBtn() Gen。
   ============================================================ */
const GENLOG_NUMS = [0, 10, 20, 50, 100, 200];
const GENLOG_DAYS = [0, 7, 30, 90, 180, 365];
const GENLOG_KEEP0 = 50;

const GenLog = {
  _mem:{}, _keep:{}, _err:{},
  key(id){ return 'genlog.' + id; },
  file(id){ return (H().logDir || 'gen-log/') + id + '.json'; },
  async load(id){
    if(this._mem[id]) return this._mem[id];
    let recs = null;
    /* 文件读得到就以文件为准：用户自己用记事本改过也算数 */
    try{ const r = await fetch(this.file(id), { cache:'no-store' }); if(r.ok) recs = this.fix(await r.json()); }catch(e){}
    if(!recs) recs = this.fix(await H().kv.get(this.key(id), []));
    return (this._mem[id] = recs);
  },
  fix(a){ return Array.isArray(a) ? a.filter(r => r && typeof r.text === 'string' && typeof r.t === 'number') : []; },
  async save(id){
    const recs = this._mem[id] || [];
    try{ await H().kv.put(this.key(id), recs); }catch(e){}
    this._err[id] = null;
    const A = window.FD_APP;
    if(A && A.writePageFile){
      try{ await A.writePageFile(this.file(id), JSON.stringify(recs, null, 2)); }
      catch(e){ this._err[id] = (e && e.message) || String(e); }
    }
  },
  /* ---------- 清理策略：每个生成器各记一份 ---------- */
  async keep(id){
    if(this._keep[id]) return this._keep[id];
    const st = (await State.get('genlog-keep.' + id, null)) || {};
    return (this._keep[id] = { num:st.num === undefined ? GENLOG_KEEP0 : st.num, days:st.days || 0 });
  },
  async setKeep(id, k){ this._keep[id] = k; await State.set('genlog-keep.' + id, k); },
  cut(recs, k){
    const byNum = k.num > 0 ? recs.slice(0, k.num) : null;
    const byDays = k.days > 0 ? recs.filter(r => r.t >= Date.now() - k.days * 864e5) : null;
    /* 两个都设了才算谁留得多；只设了一个就照那一个裁 */
    if(byNum && byDays) return byNum.length >= byDays.length ? byNum : byDays;
    return byNum || byDays || recs;
  },
  async clean(id){
    const recs = await this.load(id);
    this._mem[id] = this.cut(recs, await this.keep(id));
    await this.save(id);
    Bus.emit('genlog', id);
    return this._mem[id].length;
  },
  /* ---------- 记一条 ---------- */
  async add(id, text, sn){
    const recs = await this.load(id);
    recs.unshift({ t:Date.now(), text:String(text || ''), sn:sn || {} });
    this._mem[id] = this.cut(recs, await this.keep(id));
    await this.save(id);
    Bus.emit('genlog', id);
  },
  async drop(id, t){
    const recs = await this.load(id);
    this._mem[id] = recs.filter(r => r.t !== t);
    await this.save(id); Bus.emit('genlog', id);
  },
  async clear(id){ this._mem[id] = []; await this.save(id); Bus.emit('genlog', id); },
  count(id){ return (this._mem[id] || []).length; },
  when(t){ const d = new Date(t), z = n => (n < 10 ? '0' : '') + n;
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()); },
  open(id){ new GenLogSheet(id); }
};

/* ---------- 记录面板：对话框形态，两个宿主都用各自的 dlg ---------- */
class GenLogSheet{
  constructor(id){ this.id = id; this.shown = 0; this.boot(); }
  name(){ return (typeof Gen !== 'undefined' && Gen.get(this.id)) ? Gen.get(this.id).name : this.id; }
  async boot(){
    await GenLog.load(this.id);
    this.st = await GenLog.keep(this.id);
    this.draw();
  }
  sel(opts, val, unit, on){
    /* 存着的值不在档位里也照样摆出来，免得下拉一打开就跑去看别档 */
    const all = opts.indexOf(val) >= 0 ? opts : opts.concat([val]).sort((a, b) => a - b);
    const s = h('select', {}, all.map(o => h('option', { value:String(o), selected:o === val }, o === 0 ? '不清' : o + unit)));
    s.addEventListener('change', () => on(parseInt(s.value, 10)));
    return s;
  }
  async setK(part, v){
    this.st[part] = v;
    await GenLog.setKeep(this.id, this.st);
    await GenLog.clean(this.id);
    this.draw();
  }
  draw(){
    const recs = GenLog._mem[this.id] || [];
    this.shown = Math.min(this.shown || recs.length, recs.length);
    if(!this.shown) this.shown = Math.min(20, recs.length);
    const body = h('div', { class:'wnw-col' });
    body.appendChild(h('div', { class:'wnw-row', style:'align-items:center' }, [
      h('span', {}, '留'), this.sel(GENLOG_NUMS, this.st.num, ' 条', v => this.setK('num', v)),
      h('span', {}, '或留'), this.sel(GENLOG_DAYS, this.st.days, ' 天', v => this.setK('days', v))
    ]));
    if(GenLog._err[this.id]) body.appendChild(h('div', { class:'wnw-hint' }, '明文没写进去：' + GenLog._err[this.id]));
    if(!recs.length) body.appendChild(h('div', { class:'wnw-hint' }, '还没有生成过 · 生成一次就自动存一条'));
    for(const r of recs.slice(0, this.shown)) body.appendChild(this.item(r));
    if(recs.length > this.shown)
      body.appendChild(h('button', { class:'wnw-btn mini', style:'justify-self:start', onclick:() => { this.shown += 20; this.draw(); } }, '再看 20 条（共 ' + recs.length + ' 条）'));
    H().dlg.open('生成库 · ' + this.name(), body, [
      h('button', { class:'wnw-btn mini', onclick:async () => {
        if(!await shAsk('清空「' + this.name() + '」的生成库？这里记着的 ' + recs.length + ' 条会全没，按这些记录生成出去的东西不动。')) return;
        await GenLog.clear(this.id); this.draw();
      } }, '清空'),
      h('button', { class:'wnw-btn mini', onclick:() => H().dlg.close() }, '关闭')
    ], { wide:true });
  }
  item(r){
    const head = h('div', { class:'wnw-row', style:'justify-content:space-between;align-items:center' }, [
      h('b', {}, GenLog.when(r.t)),
      h('span', { style:'flex:1' }),
      copyBtn(() => r.text, '复制'),
      h('button', { class:'wnw-btn mini', title:'删掉这条', onclick:async () => {
        if(!await shAsk('删掉 ' + GenLog.when(r.t) + ' 这一条生成记录？记着的那份文本跟着没，按它生成出去的东西不动。')) return;
        await GenLog.drop(this.id, r.t); this.draw();
      } }, '删')
    ]);
    const sn = Object.keys(r.sn || {}).map(k => k + '=' + r.sn[k]).join(' · ');
    return h('div', { class:'wnw-result' }, [head,
      sn ? h('div', { class:'wnw-hint' }, sn) : null,
      h('pre', { class:'wnw-out' }, r.text)]);
  }
}

/* ---------- WNW 左栏那一格 ----------
   列出所有生成器和各自存了多少条，点一行开这块的记录面板。
   FD 是桌面卡片，入口在卡片上的「记录」按钮，这边不硬挤。 */
if(typeof Views !== 'undefined' && Views.reg){
  Views.reg('panel-genlog', {
    name:'生成库', icon:'log', dockable:false,
    title:() => '生成库',
    render(host, ref, ctx){ new GenLogRail(host, ctx); }
  });
}

class GenLogRail{
  constructor(host, ctx){
    this.host = host;
    this.draw();
    /* 面板活着时新存了记录就重数一遍条数；订阅交给宿主的 ctx.on，卸载时自己断 */
    if(ctx && ctx.on) ctx.on('genlog', () => this.draw());
  }
  async draw(){
    const list = (typeof Gen !== 'undefined') ? Gen.list() : [];
    for(const R of list) await GenLog.load(R.id);
    this.host.innerHTML = '';
    const { body } = panelShell(this.host, '生成库', []);
    if(!list.length){ body.appendChild(h('div', { class:'wnw-hint' }, '还没有生成器')); return; }
    for(const R of list){
      const n = GenLog.count(R.id);
      body.appendChild(h('div', { class:'wnw-ci', title:'看「' + R.name + '」存下的结果', onclick:() => GenLog.open(R.id) }, [
        h('span', { class:'nm' }, R.name), h('span', { style:'flex:1' }),
        h('span', { class:'wnw-hint' }, n + ' 条')]));
    }
  }
}
