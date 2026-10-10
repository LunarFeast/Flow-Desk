/* ============================================================
   改词库 · WNW 和 FD 共用这一份
   入口在功能卡片标题上，打开只列这个功能用得上的分类；
   左列按点号分成一棵树（深度不限），右列一次只改一个分类。
   一行一条；这台机器连不上磁盘时改动存在覆盖层里、那份明文不动，Flow-Desk 程序里保存即写回同目录那份明文。
   宿主要在本文件之前装好 window.TOOL_HOST 里这两项：
     dlg  { open(title, body, foot, opt) / close() }   对话框（wnw 的浮层 / FD 的 Modal）
     pick (which)                                      词库读不到时手动选一份，没有就不摆这个按钮
   h() / toast() / State / shSplit / Banks 两个宿主同名同义，直接用全局的。
   ============================================================ */
/* which → 实例：内置那两份就是 PB / RB（mkBank 按 which 缓存，同一个对象），
   自建词库是 'b:词库名'，第一次用到才建。别名别在这里再造一份，否则编辑器改完生成器认不得。 */
function bankOf(which){ return mkBank(which); }

const BankDlg = {
  open(which){ new BankSheet(which); }
};

class BankSheet{
  constructor(which){
    this.which = which;
    this.cat = '';
    this.q = '';
    this.raw = false;
    this.ex = {};
    this.boot();
  }
  dlg(){ return H().dlg; }
  async boot(){
    try{ await bankOf(this.which).load(); }
    catch(e){ this.noFile((e && e.message) || String(e)); return; }
    const wrap = h('div', { class:'sh-bank', style:'height:min(56vh,520px)' });
    const cols = h('div', { class:'sh-bank-cols' });
    this.listBox = h('div', { class:'sh-bank-list' });
    this.editBox = h('div', { class:'sh-bank-edit' });
    cols.appendChild(this.listBox); cols.appendChild(this.editBox);
    wrap.appendChild(cols);
    this.dlg().open('改词库 · ' + Banks.name(this.which), wrap, [
      h('button', { class:'wnw-btn mini w-txt', html:icoMarkup('plus') + '新分类', onclick:() => this.newCat() }),
      h('button', { class:'wnw-btn mini', title:'还原词库为初始版本', onclick:() => this.resetAll() }, '恢复自带')
    ], { wide:true });
    /* 左列多宽自己拖，比例按「宿主 + 哪份词库」各记一份 */
    shSplit(cols, this.listBox, shSplitKey('bank.' + this.which), { def:.3, min:.18, max:.55 });
    await this.refresh();
  }
  /* 词库文件这会儿读不到（这一家的底本没在插件清单里点名，或者那份还没建起来）：给一句白话和一个选文件的入口 */
  noFile(msg){
    const pick = typeof H().pick === 'function';
    this.dlg().open('改词库 · ' + Banks.name(this.which), h('div', { class:'wnw-col', style:'padding:8px 0;min-width:min(420px,80vw)' }, [
      h('div', { class:'wnw-hint' }, msg),
      pick ? h('button', { class:'wnw-btn mini', style:'justify-self:start', onclick:async () => {
        try{ await H().pick(this.which); await this.boot(); }
        catch(e){ toast('仍未读到' + ((e && e.message) || String(e))); }
      }}, '选一次词库文件') : null
    ].filter(Boolean)), null, { wide:true });
  }
  /* 左列：按点号分层的分类树，带已改标记 */
  async refresh(){
    const tree = await Banks.tree(this.which);
    const q = this.q.trim().toLowerCase();
    if(this.cat) this.unfold(this.cat);
    const lb = this.listBox;
    lb.innerHTML = '';
    const qi = h('input', { class:'sh-bank-q', type:'search', placeholder:'找分类', value:this.q });
    qi.addEventListener('input', () => { this.q = qi.value; this.refresh(); });
    lb.appendChild(qi);
    const kept = this.prune(tree, q);
    for(const n of kept) this.nodeRow(n, lb, q !== '');
    if(!kept.length) lb.appendChild(h('div', { class:'wnw-hint' }, '该分类不存在'));
    await this.showCat();
  }
  /* 搜索时只留命中自己和命中子孙的分支 */
  prune(nodes, q){
    if(!q) return nodes;
    const out = [];
    for(const n of nodes){
      const kids = this.prune(n.kids, q);
      if(n.label.toLowerCase().includes(q) || kids.length) out.push({ name:n.name, label:n.label, depth:n.depth, kids, cat:n.cat, edited:n.edited });
    }
    return out;
  }
  /* 展开状态：搜东西时全展开，平时前两层开着、深处的自己点 */
  exp(node, openAll){
    if(openAll) return true;
    return node.name in this.ex ? this.ex[node.name] : node.depth < 2;
  }
  /* 选中一个分类时把它一路到根的 ancestors 打开，别让人看不见挑中的是哪条 */
  unfold(path){
    const p = String(path).split('.');
    let s = '';
    for(let i = 0; i < p.length - 1; i++){ s = i ? s + '.' + p[i] : p[i]; this.ex[s] = true; }
  }
  nodeRow(node, host, openAll){
    const kids = node.kids.length;
    const on = node.cat && node.cat.name === this.cat;
    const open = this.exp(node, openAll);
    const caret = h('i', { class:'c', html:kids ? icoMarkup(open ? 'caretDown' : 'caretRight') : '' });
    /* 既是分类又有下层的那种（【意象】下面还有【意象.天象】）：点整行是选它，点箭头才是开合 */
    if(kids) caret.addEventListener('click', ev => { ev.stopPropagation(); this.ex[node.name] = !open; this.refresh(); });
    const row = h('div', { class:'sh-tn' + (on ? ' on' : ''), title:node.name + ' · 右键改名', style:'padding-left:' + (4 + node.depth * 13) + 'px' }, [
      caret,
      h('i', { class:'d', style:'background:' + (node.edited ? 'var(--slot-4,var(--accent))' : node.cat ? 'var(--hair-color)' : 'transparent') }),
      h('span', { class:'nm' }, node.label),
      h('span', { class:'sp' }),
      h('span', { class:'wnw-hint' }, node.cat ? (node.cat.edited ? '已改 ' : '') + node.cat.lines().length : '')
    ]);
    row.addEventListener('click', () => {
      if(node.cat){ this.cat = node.cat.name; this.raw = false; this.ex[node.name] = true; }
      else this.ex[node.name] = !open;
      this.refresh();
    });
    /* 第 6 条：右键就改名 —— 叶子改这一条，只管分层的节点改整枝 */
    row.addEventListener('contextmenu', ev => { ev.preventDefault(); ev.stopPropagation(); this.rename(node.name); });
    host.appendChild(row);
    if(kids && open) for(const k of node.kids) this.nodeRow(k, host, openAll);
  }
  /* 右列：一个分类的编辑区；看原文那一档只读，摆的是打包自带的那份 */
  async showCat(){
    const box = this.editBox;
    box.innerHTML = '';
    if(!this.cat){ box.appendChild(h('div', { class:'wnw-hint', style:'padding:8px 2px' }, '左边挑一个分类')); return; }
    const lines = await Banks.catLines(this.which, this.cat);
    const base = await Banks.catBase(this.which, this.cat);
    const edited = lines.join('\n') !== base.join('\n');
    if(!base.length) this.raw = false;
    box.appendChild(h('div', { class:'wnw-row', style:'flex-wrap:nowrap' }, [
      h('b', {}, '【' + this.cat + '】'),
      h('span', { class:'wnw-hint' }, base.length ? (this.raw ? '自带原文 ' + base.length + ' 条' : edited ? '已改，自带 ' + base.length + ' 条' : '未改动，' + base.length + ' 条') : '自建分类'),
      h('span', { class:'sp', style:'flex:1' }),
      base.length ? h('button', { class:'wnw-btn mini' + (this.raw ? ' on' : ''), title:'只看打包时自带的那份原文，改不动', onclick:() => { this.raw = !this.raw; this.showCat(); } }, '看原文') : null,
      h('button', { class:'wnw-btn mini', title:'随机抽一条，看改动有没有被用上', onclick:() => this.tryDraw() }, '试抽')
    ].filter(Boolean)));
    const ta = h('textarea', { class:'sh-bank-ta', spellcheck:'false' });
    ta.value = (this.raw ? base : lines).join('\n');
    ta.readOnly = this.raw;
    box.appendChild(ta);
    const cnt = h('span', { class:'wnw-hint' });
    const tally = () => { cnt.textContent = ta.value.split('\n').map(s => s.trim()).filter(Boolean).length + ' 条'; };
    ta.addEventListener('input', tally); tally();
    if(this.raw){
      box.appendChild(h('div', { class:'wnw-row', style:'margin-top:6px;flex-wrap:nowrap' }, [
        cnt, h('span', { style:'flex:1' }),
        h('button', { class:'wnw-btn primary mini', onclick:() => { this.raw = false; this.showCat(); } }, '返回编辑')
      ]));
      return;
    }
    box.appendChild(h('div', { class:'wnw-row', style:'margin-top:6px;flex-wrap:nowrap' }, [
      cnt, h('span', { style:'flex:1' }),
      h('button', { class:'wnw-btn mini', onclick:() => this.rename() }, '改名'),
      base.length ? h('button', { class:'wnw-btn mini', onclick:() => { ta.value = base.join('\n'); tally(); } }, '填入原文') : null,
      edited ? h('button', { class:'wnw-btn mini', onclick:() => this.revert() }, '还原本类') : null,
      base.length === 0 ? h('button', { class:'wnw-btn mini', onclick:() => this.delCat() }, '删掉本类') : null,
      h('button', { class:'wnw-btn primary mini', onclick:() => this.save(ta.value) }, '保存并使用')
    ].filter(Boolean)));
  }
  async save(txt){
    const arr = String(txt).split('\n').map(s => s.trim()).filter(Boolean);
    if(!arr.length && !confirm('确定清空该分类吗？这个分类会被跳过。')) return;
    await Banks.setCat(this.which, this.cat, arr);
    const w = await this.saved();
    toast('【' + this.cat + '】已存，' + (w && w.ok ? '已写回 ' + w.file : Banks.name(this.which) + ' 已重读'));
    await this.refresh();
  }
  /* 广播让生成器重读；app 版顺带把整份写回明文，写不回去要说一声 */
  async saved(){
    const w = await Banks.saved(this.which);
    if(w && !w.ok) toast('写回 ' + w.file + ' 失败：' + w.err + '');
    return w;
  }
  /* 改名（第 6 条）：右键树上哪一行就改哪一条 —— 只管分层的节点 = 底下整枝跟着换前缀。
     改完还要真去源码和配方里把引用了这个分类名的字符串换掉，然后自动重新构建。 */
  async rename(from){
    from = String(from || this.cat || '');
    if(!from) return;
    const all = await Banks.cats(this.which);
    const under = all.filter(c => c.name === from || c.name.startsWith(from + '.'));
    const inp = h('input', { class:'sh-bank-q', value:from, style:'width:100%;margin:0' });
    this.dlg().open('分类改名', h('div', { class:'wnw-col' }, [
      inp,
      h('div', { class:'wnw-hint' }, under.length > 1 ? ('下属子分类将跟随本分类更换前缀' + under.length + '') : '只改这一条')
    ]), [h('button', { class:'wnw-btn primary', onclick:async () => {
      const n = inp.value.trim();
      if(!n || n === from){ this.dlg().close(); await this.boot(); return; }
      if(!this.nameOk(n)) return;
      if(all.some(c => c.name === n || c.name.startsWith(n + '.'))){ toast('已有【' + n + '】这一条（或它下面的一条）'); return; }
      if((await Banks.catBase(this.which, from)).length && !confirm('【' + from + '】为自带分类，改名后，再按原名取词则结果为空。继续？')) return;
      const moved = await Banks.renameTree(this.which, from, n);
      if(!moved.length){ toast('该分类暂未下属子分类，新建一个'); return; }
      await this.saved();
      this.cat = this.cat === from ? n : (String(this.cat).startsWith(from + '.') ? n + this.cat.slice(from.length) : this.cat);
      this.dlg().close();
      await this.codeFix(moved);
      await this.boot();
    }}, '保存')], { wide:true });
    inp.focus(); inp.select();
  }
  /* 词库分类改名 → 主进程去改引用了这个分类名的代码 → 按改到哪儿分开收尾：
     改到插件自己那一格（data\plugins\<包>\main.js 那种）的，重载那几家就换；
     改到 src\ 共用底子那几份的，那部分拼在 Flow-Desk 页面里，只有重新生成页面才换。 */
  async codeFix(moved){
    const A = window.FD_APP;
    if(!A || typeof A.codeCatRename !== 'function'){ toast('未连接代码层，无法修改代码引用字段（词库修改已保存）'); return; }
    let files = 0, src = 0;
    const packs = [];
    for(const m of moved){
      const r = await A.codeCatRename(m.from, m.to) || {};
      if(!r.ok){ toast('代码存在错误' + (r.msg || '')); return; }
      files += (r.hits || []).length;
      src += Number(r.src || 0);
      for(const id of (r.packs || [])) if(!packs.includes(id)) packs.push(id);
      if((r.bad || []).length) toast('有文件未写入' + r.bad.join('、'));
    }
    if(!files){ toast('代码里没有引用这些分类名的地方'); return; }
    const comp = files - src;
    for(const id of packs){
      const k = await PackLoader.reload(id);
      if(!k || !k.ok) toast('「' + Packs.name(id) + '」未按新代码重载：' + ((k && k.msg) || ''));
    }
    if(comp) toast('插件那一格里 ' + comp + ' 份文件跟着改了 · ' + packs.length + ' 家已经按新代码重载');
    /* 只有真改到 src\ 那几份共用底子才跑重新生成页面这一趟 —— 插件自己那一格存了就是新的，不用 */
    if(src) await PackCode.rebuildPages('改到了那 ' + src + ' 份共用底子 · 这就重新生成页面…');
  }
  /* 点号就是分层，写歪了（开头结尾、连着两个）树会裂，先拦住 */
  nameOk(n){
    if(/[【】]/.test(n)){ toast('分类名里不能有【】'); return false; }
    if(n.startsWith('.') || n.endsWith('.') || n.includes('..')){ toast('点号应当夹在两段名字中间，比如：大类.小类'); return false; }
    return true;
  }
  /* 试抽：直接从生成器正在用的那个实例里取，取到新词就说明生效了 */
  tryDraw(){
    const b = bankOf(this.which);
    const pool = b.pool(this.cat);
    const sample = pool.length ? [...new Set(pool)].slice(0, 8).join('　') : '（这一类空）';
    this.dlg().open('试抽 · ' + this.cat, h('div', { class:'wnw-col' }, [
      h('div', { class:'wnw-hint' }, '当前随机到 ' + pool.length + ' 条（不含「随机」）'),
      h('div', { class:'wnw-out' }, sample)
    ]), [h('button', { class:'wnw-btn mini', onclick:() => this.boot() }, '返回')], { wide:true });
  }
  async revert(){
    await Banks.clearCat(this.which, this.cat);
    await this.saved();
    toast('【' + this.cat + '】已还原');
    await this.refresh();
  }
  async delCat(){
    if(!confirm('删掉自建分类【' + this.cat + '】？')) return;
    await Banks.clearCat(this.which, this.cat);
    await this.saved();
    this.cat = '';
    await this.refresh();
  }
  async newCat(){
    const inp = h('input', { class:'sh-bank-q', placeholder:'分类名，用点号分层：大类.小类', style:'width:100%;margin:0' });
    this.dlg().open('新分类', h('div', { class:'wnw-col' }, [inp]), [
      h('button', { class:'wnw-btn primary', onclick:async () => {
        const n = inp.value.trim();
        if(!n){ toast('必须命名'); return; }
        if(!this.nameOk(n)) return;
        if((await Banks.cats(this.which)).some(c => c.name === n)){ toast('已有【' + n + '】'); return; }
        await Banks.setCat(this.which, n, []);
        await this.saved();
        this.cat = n;
        this.dlg().close(); await this.boot();
      }}, '保存')], { wide:true });
    inp.focus();
  }
  async resetAll(){
    if(!confirm('将 ' + Banks.name(this.which) + ' 的所有改动还原成初始版本？')) return;
    await Banks.reset(this.which);
    await this.saved();
    this.cat = '';
    await this.boot();
    toast('已恢复自带');
  }
}

(function(){
  if(document.getElementById('sh-bank-style')) return;
  const n = document.createElement('style');
  n.id = 'sh-bank-style';
  n.textContent = `
.sh-bank{display:flex;flex-direction:column;gap:6px;height:100%;min-height:0;min-width:min(760px,92vw);}
.sh-bank-cols{display:flex;flex:1 1 auto;min-height:0;}
.sh-bank-list{flex:0 0 var(--sh-form-w,200px);min-width:0;overflow:auto;}
.sh-bank-edit{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:4px;}
.sh-bank-ta{flex:1 1 auto;min-height:0;resize:none;font-family:var(--ff-code,ui-monospace,Consolas,monospace);font-size:.95em;
  line-height:1.7;padding:10px 12px;border:1px solid var(--ctl-edge,var(--input-border));border-radius:var(--r-btn,5px);
  background:var(--input-bg);color:var(--text);}
.sh-bank-ta:focus{border-color:var(--accent);}
.sh-bank-ta[readonly]{background:var(--candidate-bg);color:var(--text-light);}
.sh-bank-q{font:inherit;color:var(--text);background:var(--input-bg);min-width:0;
  border:1px solid var(--ctl-edge,var(--input-border));border-radius:var(--r-btn,5px);padding:4px 8px;}
/* 2026-10-04：这两处从前写死 outline:none，把外观层统一给的 2px 焦点框顶掉了（无障碍 C-6）。
   删掉之后焦点框归那一处真身；同一条里那圈 1px 强调色的 box-shadow 也一并撤了，不叠两层。
   这两个名字同时补进了外观层的控件名单，所以描边和焦点框都跟着当前配色 + 外观模式算。 */
.sh-bank-q:focus{border-color:var(--accent);}
.sh-tn{display:flex;gap:6px;align-items:center;padding:3px 6px;border-radius:var(--r-btn,5px);cursor:pointer;
  line-height:1.6;white-space:nowrap;}
.sh-tn:hover{background:var(--candidate-bg);}
.sh-tn.on{background:var(--accent-light);color:var(--accent-text,var(--accent));font-weight:700;}
.sh-tn > .c{flex:0 0 1em;font-style:normal;text-align:center;font-size:.82em;color:var(--text-light);}
.sh-tn > .d{flex:0 0 auto;width:5px;height:5px;border-radius:50%;font-style:normal;}
.sh-tn > .nm{overflow:hidden;text-overflow:ellipsis;}
.sh-tn > .sp{flex:1;}
`;
  document.head.appendChild(n);
})();
