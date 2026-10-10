/* ============================================================
   中立生成器引擎 · 配方 JSON → 一个真的功能（WNW 停靠 + FD 卡片共用这一份）
   「简便代码组合」就是一套控件拼装语言：向导问完参数产出一份配方，这里照配方
   搭界面、取值、出结果。不做 eval —— 配方向里能写的东西只有 CTL 里那十九种控件功能，
   界面结构只有 ctl / row / group / text / loop / tabs / pane 七种节点。CTL 里现十九种控件功能
   （开关 / 滑杆 / 区间随机数 / 生成式下拉 / 格式模板这五种是后补的，数算传递、摊组合、只换这一条同批落实；
   多选勾选 / 整段文本 / 输入即筛 / 颜色 / 日期时刻，加上分页签和成组可收起、结果出成表格，是对照 Ant Design 那份补齐的）。
   宿主契约：h() / toast() / copyBtn() / State / Bus / registerTool / mkBank。

   配方形状（向导产物，也是「改代码」里给用户改的那份源码）：
     { id, name, desc, bank:'你起的词库名', icon:'pencil',
       out:{ mode:'list'|'text'|'table', cols:['列名','…']（表格那一档排哪几列，空着按界面顺序）, join:'\n', template:'{场景}／{人物}', rows:文本组合拆成多行进流水线（可选） },
       keep:{ days:0, max:0 },
       ui:[ {t:'ctl', id, fn, name, ...功能参数}
          | {t:'row', items:[...]}        控件并列：几个控件挤同一行
          | {t:'group', id, name, items:[...], fold:''|'can'|'shut'}  控件成组：打包起来给循环用；fold 决定这一组能不能收起
          | {t:'text', text}              纯文本：界面上的死字，不进结果
          | {t:'loop', id, name, src, tpl, items:[...]}  组循环：按 src 那个数出几份
          | {t:'tabs', id, items:[{t:'pane', name, items:[...]}]}  分页签：几页各摆一摊控件 ],
       rules:[ { k:'noRepeat'|'dropEmpty'|'dropBlock'|'uniq'|'retry'|'branch'|'cap'|'lenLimit'|'number'|'shuffle'|'needAll'
                 |'weight'|'calc'|'pair'|'like'|'diverse'|'rw'|'dim',
                 on:true|false, src:'（这条只管哪个变量，空着管全部）', ...这条规则的参数 } ] }
   判断逻辑那一条一条都在 JUDGE 里认，配方没写 rules 就一条都不走，拼出来的结果和从前一个字不差。
   每条规则上的 src 是「读哪个变量」：功能模块里的控件和组循环各产生一个变量，
   写了 src 这一条就只过那一摊行，没写还是像从前那样管全部。
   条件分支是这批里唯一「只做决定」的一条：它不重排、不改值，只把结论挂在一个传输口上
   （这条自己起个名，模板里 {那名} 就取得到），谁要用谁自己去读 ——
   改分类由取值那一头读（wordsOf），不要哪几格 / 换条数 / 插一行排在整条流水线最后做。
   ============================================================ */
const GEN_DEFS = new Map();
const RANDOM = '随机';

/* ---------- 词库取数：分类名里的点号就是一层，深度不限 ---------- */
/* 穿透：这一类连同它底下所有子类的词条 */
function bkThru(bank, prefix){
  const out = [];
  for(const [cat, lines] of bank.cats) if(cat === prefix || cat.startsWith(prefix + '.')) out.push(...lines);
  return out;
}
/* 直接子分类名（只取点号的下一段，孙子不算） */
function bkKids(bank, prefix){
  const out = [];
  for(const [cat] of bank.cats){
    if(!cat.startsWith(prefix + '.')) continue;
    const nxt = cat.slice(prefix.length + 1).split('.')[0];
    if(nxt && !out.includes(nxt)) out.push(nxt);
  }
  return out;
}
/* 这一类往下能给的东西：有子类就报子类，没子类就报词条（联动下拉的第二套就是这个口径） */
function bkUnder(bank, cat){
  const kids = bkKids(bank, cat);
  return kids.length ? kids : bank.raw(cat).filter(w => w !== RANDOM);
}
function genBank(name){ return mkBank(bankWhich(name || '')); }

/* ============================================================
   十九种控件功能。每种做出一个 el，并给 parts() 出值：
     parts() → { '':主值, 类:…, 项:…, n:… }
   模板里 {名} 取主值，{名.类} 取分部。
   ============================================================ */
const CTL = {
  /* 二级下拉：一个或多个叶子分类合成一套选项，收词条 + 自动加「随机」
     选项表建界面时定一次；随机那一档抽的是「现下这一格该从哪几类抽」的那一摞（条件分支能改它） */
  cat2(c, v){
    const bank = genBank(c.bank || v.R.bank);
    const words = [];
    for(const cat of (c.cats || [])) for(const w of bank.raw(cat)) if(w !== RANDOM && !words.includes(w)) words.push(w);
    const sel = v.sel([RANDOM].concat(words));
    return { el:sel, parts(){
      if(sel.value !== RANDOM) return { '':wOn(v) ? stripW(sel.value) : sel.value };
      const mine = v.wordsOf(c, 0);
      return { '':v.pick(mine, c) || ('（词库里 ' + (c.cats || []).join('、') + ' 是空的）') };
    }};
  },
  /* 三级联动下拉：先选大类，再选大类底下的项；at 说这个大类在词库里是第几层，
     五层词库里 123 / 234 / 345 都使得。第一套一变，第二套立刻跟着换。 */
  cat3(c, v){
    const bank = genBank(c.bank || v.R.bank);
    const at = Math.max(1, parseInt(c.at, 10) || 1);
    const head = String(c.cat || '').split('.').slice(0, at).join('.');
    const ones = bkKids(bank, head);
    const s1 = v.sel([RANDOM].concat(ones)), s2 = v.sel([RANDOM]);
    const one = () => s1.value === RANDOM ? (v.pick(ones, c) || '') : s1.value;
    /* 大类选到叶子那一层时没有下一层可挑，就停在它自己这一层，第二套直接收它的词条 */
    const full = () => { const o = one(); return o ? (head ? head + '.' + o : o) : head; };
    const fill = () => { const f = full(); s2.dataset.cat = f; v.setOpts(s2, [RANDOM].concat(bkUnder(bank, f))); };
    s1.addEventListener('change', fill);
    fill();
    return { el:h('div', { class:'wnw-row' }, [s1, s2]), parts(){
      const f = s2.dataset.cat || head;
      const two = s2.value === RANDOM ? (v.pick(bkUnder(bank, f), c) || '') : s2.value;
      return { '':two, 类:one() || String(head).split('.').pop(), 项:two };
    }};
  },
  /* 穿透下拉：一个或多个顶级分类，底下所有词条合成一套 + 「随机」（随机那一档同二级下拉，认分支改过的分类） */
  thru(c, v){
    const bank = genBank(c.bank || v.R.bank);
    const words = [];
    for(const cat of (c.cats || [])) for(const w of bkThru(bank, cat)) if(w !== RANDOM && !words.includes(w)) words.push(w);
    const sel = v.sel([RANDOM].concat(words));
    return { el:sel, parts(){
      if(sel.value !== RANDOM) return { '':wOn(v) ? stripW(sel.value) : sel.value };
      const mine = v.wordsOf(c, 1);
      return { '':v.pick(mine, c) || ('（' + (c.cats || []).join('、') + ' 底下没有词条）') };
    }};
  },
  /* 多选勾选：一列勾选框，从指定的几个分类（连子类）里摆出候选，勾中的拼成主值。
     勾了几个也是一个数 —— 能绑组循环的份数、能当数字展示，也认「填写要求」里的数字上下限。
     这是原来那一排下拉里缺的那一头：一批候选让用户自己勾，而不是全交给随机抽。 */
  multi(c, v){
    const bank = genBank(c.bank || v.R.bank);
    const words = [];
    for(const cat of (c.cats || [])) for(const w of bkThru(bank, cat)) if(w !== RANDOM && !words.includes(w)) words.push(w);
    const j = c.join || '、';
    const boxes = words.map(w => h('input', { type:'checkbox', value:w }));
    const n = h('span', { class:'wnw-chip' }, '已勾 0 项');
    const got = () => boxes.filter(b => b.checked).map(b => b.value);
    v.displays.push(() => { n.textContent = '已勾 ' + got().length + ' 项'; });
    const grid = h('div', { class:'sh-fgrid' }, boxes.map((b, i) => h('label', { class:'wnw-switch' },
      [b, h('span', {}, stripW(words[i]))])));
    const el = h('div', { class:'sh-fcell' }, [
      words.length ? grid : h('div', { class:'wnw-hint' }, '（' + (c.cats || []).join('、') + ' 里还没有词条）'),
      h('div', { class:'wnw-row' }, [n])]);
    return { el, num(){ return got().length; }, main(){ return got().map(w => stripW(w)).join(j); },
      /* 勾选状态不在任何一个输入框的 value 里，「上次填到哪记到哪」得走这两句 */
      state(){ return got(); },
      apply(arr){ for(const b of boxes) b.checked = (arr || []).indexOf(b.value) >= 0; },
      parts(){ const p = got().map(w => stripW(w)); return { '':p.join(j), n:String(p.length), 项:p.join('、') }; } };
  },
  /* 文本提取计数：按分隔符切字段，顺手把切出来几段摆出来；切出的字段能被联动下拉和组循环用 */
  extract(c, v){
    const box = h('textarea', { rows:3, placeholder:c.ph || '要切的文本' });
    const re = () => { try{ return new RegExp(c.sep || '[，、；;,\\s]+', 'g'); }catch(e){ return /[，、；;,]+/g; } };
    const fields = () => box.value.split(re()).map(s => s.trim()).filter(Boolean);
    const n = h('span', { class:'wnw-chip' }, '0 段');
    v.displays.push(() => { n.textContent = fields().length + ' 段'; });
    return { el:h('div', { class:'sh-fcell' }, [box, h('div', { class:'wnw-row' }, [n])]), fields,
      num(){ return fields().length; },
      parts(){
      return { '':box.value.trim(), n:String(fields().length), 字段:fields().join('、') };
    }};
  },
  /* 融合/联动下拉：来源可以是词库分类、别的控件切出来的文本、配方里写死的几项，合成一套。
     别的控件那份要跟着现填的文本变，所以每次表单动一下就把选项重出一次（选中的还留着）。 */
  fuse(c, v){
    const sel = v.sel([RANDOM]);
    const fill = () => {
      const list = [];
      for(const s of (c.sources || [])){
        if(s.cat) for(const w of bkThru(genBank(s.bank || v.R.bank), s.cat)) if(w !== RANDOM && !list.includes(w)) list.push(w);
        if(s.ctl){ const src = v.ctrl[s.ctl]; if(src && src.fields) for(const w of src.fields()) if(!list.includes(w)) list.push(w); }
        for(const w of String(s.text || '').split(/[；;]/)) if(w.trim() && !list.includes(w.trim())) list.push(w.trim());
      }
      v.setOpts(sel, [RANDOM].concat(list));
      return list;
    };
    const list = () => { fill(); return [...sel.options].map(o => o.value).slice(1); };
    v.refreshers.push(fill);
    return { el:sel, parts(){
      const words = list();
      if(sel.value !== RANDOM) return { '':wOn(v) ? stripW(sel.value) : sel.value };
      return { '':v.pick(words, c) || '（来源里还没有词）' };
    }};
  },
  /* 可修改随机：一个普通文本框 + 一个随机按钮。点一下从指定分类里抽一个填进框里，
     抽完照样能手改；不点就当普通文本框自己打。（界面上最常用的一种输入形态） */
  rand(c, v){
    const i = h('input', { type:'text', value:c.def || '', placeholder:c.ph || '自己打，或点右边抽一个' });
    const dice = h('button', { class:'wnw-btn mini', 'data-nodrag':'1', onclick:() => {
      const mine = v.wordsOf(c, 1);
      if(!mine.length){ toast((c.cats || []).length ? '这几个分类里还没有词条' : '还没指定从哪个分类抽'); return; }
      i.value = v.pick(mine, c);
      /* 抽完当是自己打的一样：input / change 都补一发，数字展示和记忆那一套才跟得上 */
      i.dispatchEvent(new Event('input', { bubbles:true }));
      i.dispatchEvent(new Event('change', { bubbles:true }));
    }}, '随机');
    return { el:h('div', { class:'wnw-row' }, [i, dice]), parts(){ return { '':i.value }; } };
  },
  /* 数字指定：中间能手打，右边 +1 / +10 */
  num(c, v){
    const i = h('input', { type:'number', value:c.def === undefined ? 3 : c.def, min:c.min === undefined ? 1 : c.min, max:c.max === undefined ? 99 : c.max });
    const bump = d => { i.value = Math.max(+i.min || 0, Math.min(+i.max || 999, (parseInt(i.value, 10) || 0) + d)); i.dispatchEvent(new Event('input', { bubbles:true })); };
    return { el:h('div', { class:'wnw-row' }, [i,
        h('button', { class:'wnw-btn mini', 'data-nodrag':'1', onclick:() => bump(1) }, '+1'),
        h('button', { class:'wnw-btn mini', 'data-nodrag':'1', onclick:() => bump(10) }, '+10')]),
      num(){ return Math.max(0, parseInt(i.value, 10) || 0); },
      parts(){ return { '':String(Math.max(0, parseInt(i.value, 10) || 0)) }; } };
  },
  /* 文本输入：原样进结果，不加工 */
  input(c, v){
    const i = h('input', { type:'text', value:c.def || '', placeholder:c.ph || '' });
    return { el:i, parts(){ return { '':i.value }; } };
  },
  /* 整段文本：一整段原样进结果，不切字段也不数段 —— 填背景、写设定那种一格一大段 */
  tarea(c, v){
    const ta = h('textarea', { class:'wnw-input', rows:Math.max(2, parseInt(c.rows, 10) || 4), placeholder:c.ph || '' });
    ta.value = c.def || '';
    return { el:ta, main(){ return ta.value; }, parts(){ return { '':ta.value }; } };
  },
  /* 输入即筛：打几个字，下面只留含这几个字的候选，点一条就填进框里。
     词源和二级下拉同一头（条件分支改得动），候选最多摆 12 条，接着打字就再筛。 */
  sift(c, v){
    const i = h('input', { class:'wnw-input', type:'text', value:c.def || '', placeholder:c.ph || '打几个字，下面出候选' });
    const list = h('div', { class:'sh-fgrid' });
    list.style.display = 'none';
    const fire = () => {
      i.dispatchEvent(new Event('input', { bubbles:true }));
      i.dispatchEvent(new Event('change', { bubbles:true }));
    };
    const show = () => {
      const q = i.value.trim();
      const mine = v.wordsOf(c, 1).filter(w => !q || stripW(w).indexOf(q) >= 0).slice(0, 12);
      list.innerHTML = '';
      for(const w of mine) list.appendChild(h('button', { class:'wnw-btn mini', 'data-nodrag':'1',
        /* mousedown 里拦一手：不然按下去先把输入框的焦点弄丢，那条点不上 */
        onmousedown:e => { e.preventDefault(); i.value = stripW(w); fire(); list.style.display = 'none'; } }, stripW(w)));
      list.style.display = (q && mine.length) ? '' : 'none';
    };
    i.addEventListener('input', show);
    i.addEventListener('focus', show);
    i.addEventListener('blur', () => { list.style.display = 'none'; });
    return { el:h('div', { class:'sh-fcell' }, [i, list]), main(){ return i.value; }, parts(){ return { '':i.value }; } };
  },
  /* 颜色：色块和色号文本框互相跟着改，进结果的是文本框里那一串（#3b6cb5 这种色号、或者「月白」这种名字都成）。
     取色器自己的默认灰只在那一格出现时当起点用，不是界面上的颜色。 */
  color(c, v){
    const t = h('input', { class:'wnw-input', type:'text', value:c.def || '', placeholder:c.ph || '#3b6cb5，也可以写色名', style:'max-width:12em' });
    const hex = s => /^#[0-9a-fA-F]{6}$/.test(String(s));
    const p = h('input', { type:'color', value:hex(t.value) ? t.value : '#808080', title:'点开选一个颜色' });
    const fire = () => {
      t.dispatchEvent(new Event('input', { bubbles:true }));
      t.dispatchEvent(new Event('change', { bubbles:true }));
    };
    p.addEventListener('input', () => { t.value = p.value; fire(); });
    t.addEventListener('input', () => { if(hex(t.value)) p.value = t.value; });
    return { el:h('div', { class:'wnw-row' }, [p, t]), main(){ return t.value.trim(); },
      parts(){ const s = t.value.trim(); const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(s);
        return { '':s, 红:m ? String(parseInt(m[1], 16)) : '', 绿:m ? String(parseInt(m[2], 16)) : '', 蓝:m ? String(parseInt(m[3], 16)) : '' }; } };
  },
  /* 日期时刻：原生输入框包一层，值当文本进结果。
     「2026-10-04」这种串在数算逻辑里读出来的数就是年份，所以 {生日} 直接能拿去算年龄。 */
  date(c, v){
    const kind = c.kind === 'time' ? 'time' : (c.kind === 'both' ? 'datetime-local' : 'date');
    const i = h('input', { class:'wnw-input', type:kind, value:c.def || '' });
    const sp = h('span', { class:'wnw-chip' }, '（还没填）');
    const lab = () => { sp.textContent = i.value || '（还没填）'; };
    i.addEventListener('input', lab); lab();
    return { el:h('div', { class:'wnw-row' }, [i, sp]), main(){ return i.value; },
      parts(){ const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(i.value);
        return { '':i.value, 年:m ? m[1] : '', 月:m ? m[2] : '', 日:m ? m[3] : '' }; } };
  },
  /* 数字展示：把「数字指定」「文本提取计数」或任何一个交得出数的变量摆在这儿看 */
  numShow(c, v){
    const sp = h('span', { class:'wnw-chip' }, '—');
    const read = () => v.numOf(v.label(c.src) || String(c.src || ''));
    v.displays.push(() => { const n = read(); sp.textContent = n === null ? '（还没绑上数字）' : String(n); });
    return { el:sp, main(){ const n = read(); return n === null ? '' : String(n); },
      parts(){ const n = read(); return { '':n === null ? '' : String(n) }; } };
  },
  /* ---------- 下面五样出自《生成器还可以补什么》：开关/滑杆松开「写死的档」，
     区间随机数松开「填死的数」，生成式下拉和格式模板松开「写死的候选和拼法」。
     按那份清单的边界口径：下拉里有什么、格式抽哪一条，都是消费上游那个「决定」，
     决定本身仍旧归条件分支那批判断逻辑做。 ---------- */
  /* 开关：点一下在开/关（或填的两个词）之间翻，主值就是那两个字，同时是个数（开=1 关=0），
     能绑「份数」「数字展示」，条件分支也读得着 */
  sw(c, v){
    const on = c.onv || '要', off = c.offv || '不要';
    const sp = h('span', { class:'wnw-chip' }, '');
    const b = h('button', { class:'wnw-btn mini', 'data-nodrag':'1', onclick:() => {
      c.on = !c.on; sp.textContent = cur();
    }}, '');
    const cur = () => (c.on ? on : off);
    sp.textContent = cur();
    return { el:h('div', { class:'wnw-row' }, [sp, b]), num(){ return c.on ? 1 : 0; }, main:cur,
      parts(){ return { '':cur() }; } };
  },
  /* 滑杆：一根能拖的数。「原创度」「差异度」这类就该长这样，摆出当前值和两头的小字 */
  range(c, v){
    const i = h('input', { type:'range', min:c.min === undefined ? 0 : c.min, max:c.max === undefined ? 10 : c.max,
      step:c.step || 1, value:c.def === undefined ? (c.min === undefined ? 0 : c.min) : c.def });
    const sp = h('span', { class:'wnw-chip' }, '');
    const lab = () => { sp.textContent = String(i.value) + (c.unit || ''); };
    i.addEventListener('input', lab); lab();
    return { el:h('div', { class:'wnw-row' }, [i, sp]), num(){ return parseInt(i.value, 10) || 0; },
      parts(){ return { '':String(i.value) }; } };
  },
  /* 区间随机数：给两个数随机出一个整数，可带单位（「18~30 岁」「5~12 条」）。
     界面上先填区间 + 一个「掷」；整轮生成开始时每一格自动掷一次（见 run 里的掷一轮），
     掷完还能手改，跟可修改随机一个脾气。 */
  rng(c, v){
    const lo = h('input', { type:'number', value:c.lo === undefined ? 1 : c.lo, style:'max-width:6em' });
    const hi = h('input', { type:'number', value:c.hi === undefined ? 10 : c.hi, style:'max-width:6em' });
    const i = h('input', { type:'text', value:c.def === undefined || c.def === '' ? '' : String(c.def),
      placeholder:'留空 · 生成时随机', style:'max-width:8em' });
    const unit = h('span', { class:'wnw-chip' }, c.unit || '');
    const dice = h('button', { class:'wnw-btn mini', 'data-nodrag':'1', onclick:() => { roll(); } }, '掷');
    const roll = () => {
      const a = parseInt(lo.value, 10), b = parseInt(hi.value, 10);
      if(a === a && b === b){ i.value = String(randInt(Math.min(a, b), Math.max(a, b)));
        i.dispatchEvent(new Event('input', { bubbles:true })); }
    };
    return { el:h('div', { class:'wnw-row' }, [lo, h('span', {}, '~'), hi, dice, i, unit]),
      roll, main(){ return i.value; }, has(){ return String(i.value).trim() !== ''; },
      num(){ return parseInt(i.value, 10) || 0; },
      parts(){ return { '':(c.unit ? i.value + c.unit : i.value) }; } };
  },
  /* 生成式下拉：下拉里有什么由上游那个变量现下是什么决定 —— 点了「男」，「称号」里就只剩男的那批。
     候选 = 词库里「这个大类 . 上游现下的值」那一类的词条（叶子没有就报「上游还没选出来」）；
     这一类连子类都有词条时只收自己这一层的，跟联动下拉一个口径。 */
  dyn(c, v){
    const sel = v.sel([]);
    const fill = () => {
      const up = v.curVal(c.src);
      const bank = genBank(c.bank || v.R.bank);
      const head = String(c.cat || '') + (up ? '.' + up : '');
      const kids = bkKids(bank, head);
      const words = bank.raw(head).filter(w => w !== RANDOM && (!kids.length || w.indexOf('.') < 0));
      v.setOpts(sel, kids.length || words.length ? [RANDOM].concat(words) : ['（上游还没选出来）']);
      return words;
    };
    v.refreshers.push(fill);
    const list = () => { fill(); return [...sel.options].map(o => o.value).slice(1); };
    fill();
    return { el:sel, parts(){
      const words = list();
      if(!words.length) return { '':'' };
      if(sel.value !== RANDOM && words.indexOf(sel.value) >= 0) return { '':stripW(sel.value) };
      return { '':v.pick(words, c) || '（上游还没选出来）' };
    }};
  },
  /* 格式模板：拼接格式本身当一批词条来抽 —— 先抽一个格式，再往里填内容。
     下拉里摆的是指定分类下那些格式句子（「{前缀}之{后缀}」这种），随机那一档真的抽；
     它自己交白卷（主值是空串），整轮拼完之后由 run 里的 fillFmts 拿现下这些格子的值把 {…} 填上。 */
  fmt(c, v){
    const bank = genBank(c.bank || v.R.bank);
    const tmpls = [];
    for(const cat of (c.cats || [])) for(const w of bkThru(bank, cat)) if(w !== RANDOM && !tmpls.includes(w)) tmpls.push(w);
    const sel = v.sel([RANDOM].concat(tmpls));
    return { el:sel, tmpl(){ return sel.value; }, parts(){
      if(sel.value !== RANDOM) return { '':stripW(sel.value) };
      return { '':v.pick(tmpls, c) || '（这个分类里还没有格式）' };
    }};
  }
};

/* ---------- 模板填值：{名} 取主值，{名.类} 取分部，数组按 join 串起来 ---------- */
function fillTpl(tpl, vals, join){
  return String(tpl || '').replace(/\{([^{}]+)\}/g, (m, key) => {
    const parts = key.split('.');
    const got = vals[parts[0]];
    if(got === undefined) return m;
    if(Array.isArray(got)) return parts.length > 1 ? '' : got.join(join || '\n');
    if(typeof got === 'string' || typeof got === 'number') return parts.length > 1 ? '' : String(got);
    if(parts.length === 1) return got[''] === undefined ? '' : got[''];
    const v = got[parts[1]];
    return v === undefined ? '' : String(v);
  });
}

/* ---------- 判断逻辑的执行顺序：先剔不合的，再排、再编号、最后收条数 ----------
   每条拿到的是一行 { k:名字, v:值 }，字数、尾字都按值本身算，名字不参与；
   取值那三件（noRepeat 抽词不重复、dropEmpty 空值不进结果、dropBlock 空块不出标题、
   needAll 有空就不出）在 collect / generate 两处各自管，不在这条流水线上。
   规则上的 src 挑的是功能模块产生的那个变量：空着管全部，写了就只过那一摊。 */
function rowVar(k){ return String(k || '').split(' · ')[0]; }
const JUDGE = [
  ['rw', (v, rows, r) => v.rwEng(rows, r)],
  ['uniq', (v, rows) => { const seen = {}; return rows.filter(r => { const k = r.v.trim(); if(seen[k]) return false; seen[k] = 1; return true; }); }],
  ['pair', (v, rows, r) => v.pairEng(rows, r)],
  ['like', (v, rows, r) => v.likeEng(rows, r)],
  ['lenLimit', (v, rows, r) => {
    const min = Number(r.min) || 0, max = Number(r.max) || 0;
    return rows.map(x => (max && x.v.length > max) ? { k:x.k, v:x.v.slice(0, max) } : x)
      .filter(x => !min || x.v.length >= min);
  }],
  ['diverse', (v, rows, r) => v.diverseEng(rows, r)],
  ['shuffle', (v, rows) => shuffle(rows.slice())],
  ['number', (v, rows, r) => rows.map((x, i) => Object.assign({}, x, { pre:fillTpl(r.tpl || '【第{序}条】', { 序:String(i + 1) }, '') }))],
  ['cap', (v, rows, r) => { const n = Number(r.n) || 0; return n > 0 ? rows.slice(0, n) : rows; }]
];
/* 向导新建时这四条默认摆在用那一档；配方里只写了别的规则时，这几条照默认走 */
const RULE_DEF = { noRepeat:true, dropEmpty:true, dropBlock:true, uniq:true };
/* 这几条是「剔行」的判断：不合格重试按放宽 / 占位收场的那些行，它们得让路。
   向导里判断逻辑分两组摆也照这一份名单 —— 名单在这一头，界面上那两组不会和引擎走岔。 */
const GEN_SOFT = ['uniq', 'lenLimit', 'like', 'pair', 'diverse'];
/* ---------- 条件分支的比较法：文字六档、多少四档、长短四档 ----------
   全都在「现下那个值」上做判断，取一次算一次，不碰词库也不碰别的规则。
   数的那几档从字符串里捞出第一个数来比（「18级」和 18 一样），档里填区间写「18,30」。
   正则那一档整串匹配（前后自动加锚，写法照 \\d{4} 这种来），正则写坏就当不成立。
   输入格的填写要求（件-4）复用这一张表：同一档比法，界面上那一格和分支里说的是一个意思。 */
const BR_OPS = [
  ['eq', '文字相等'], ['ne', '文字不等'], ['has', '文字里含'], ['nh', '文字里不含'],
  ['seq', '整串相等（空格不算）'], ['re', '整串匹配正则'],
  ['nEq', '数字相等'], ['nGe', '数字不小于'], ['nLe', '数字不大于'], ['nIn', '数字在区间内'],
  ['LEq', '字数相等'], ['LGe', '字数不少于'], ['LLe', '字数不多于'], ['LIn', '字数在区间内']
];
/* 这一档要填什么、举例 —— 摆在向导里那句提示的位置 */
const BR_OPHINT = {
  eq:['和它一样', '男'], ne:['和它不一样', '男'], has:['里面出现这几个字', '史'], nh:['里面不出现这几个字', '史'],
  seq:['和这几个字一模一样', '男'], re:['整串要符合的写法', '\\d{4}-\\d{2}'],
  nEq:['等于几', '4'], nGe:['不小于几', '4'], nLe:['不大于几', '2'], nIn:['在哪个区间（填 18,30）', '1,4'],
  LEq:['字数正好几', '1'], LGe:['字数至少几', '2'], LLe:['字数最多几', '4'], LIn:['字数区间（填 2,4）', '2,4']
};
function gNum(x){ const m = String(x == null ? '' : x).match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : NaN; }
function gLen(x){ return String(x == null ? '' : x).replace(/\s/g, '').length; }

/* ---------- 生-19 权重判断：词条前面写「4|」就是权重 4，不写算 1，按权重抽、结果只留词 ----------
   带不加看「权重判断」这条开没开：没摆 rules 的老配方、和关了这条的，一字不差照原样。 */
function wOn(v){ return !!v.rule('weight'); }
function wordW(w){
  const m = /^(\d+(?:\.\d+)?)\|(.*)$/.exec(String(w));
  return m ? { n:Number(m[1]), w:m[2] } : { n:1, w:String(w) };
}
/* 去掉「0.4|」这种权重记号：词条本身没有这个前缀时原样返回，不怕误伤 */
function stripW(w){ return wordW(w).w; }
function weightPick(list){
  const es = (list || []).filter(Boolean).map(wordW);
  return weightPick2(es);
}
/* 拿 [{n,w}] 按权重抽一个，返回词本身（不带记号） */
function weightPick2(es){
  let sum = 0; for(const e of es) sum += Math.max(0.0001, e.n);
  let x = Math.random() * sum;
  for(const e of es){ x -= Math.max(0.0001, e.n); if(x <= 0) return e.w; }
  return es.length ? es[es.length - 1].w : '';
}

/* ---------- 生-20 数算逻辑的求值器：加减乘除取余、括号、min max abs round floor ceil，变量写 {名} ----------
   递归下降一次扫完，没有 eval；{名} 交给 get(变量名) 取现下的数（「18级」那头当 18 捞好再进来）；
   负数走一元负号，替换文本会被「5 - {a}」那种连式减误伤；除 0 得 0；算不出来返回 NaN，调用方按空值收场。 */
function calcEval(expr, get){
  const src = String(expr || '');
  let i = 0;
  const ws = () => { while(i < src.length && /\s/.test(src[i])) i++; };
  const lit = () => { let s = ''; while(i < src.length && /[0-9.]/.test(src[i])) s += src[i++]; return parseFloat(s); };
  const word = () => { let s = ''; while(i < src.length && /[A-Za-z一-鿿]/.test(src[i])) s += src[i++]; return s; };
  function p1(){
    ws();
    if(src[i] === '-'){ i++; return -p1(); }
    if(src[i] === '('){ i++; const x = p3(); ws(); if(src[i] === ')') i++; return x; }
    if(src[i] === '{'){
      const j = src.indexOf('}', i); if(j < 0) return NaN;
      const r = get ? Number(get(src.slice(i + 1, j).trim())) : NaN;
      i = j + 1; return Number.isFinite(r) ? r : NaN;
    }
    if(/[0-9.]/.test(src[i] || '')) return lit();
    const nm = word().toLowerCase();
    ws();
    if(src[i] === '('){
      i++;
      const a = p3(); ws();
      if(src[i] === ','){ i++; }
      const b = src[i] === ')' ? NaN : p3(); ws();
      if(src[i] === ')') i++;
      switch(nm){
        case 'min': return Math.min(a, b);
        case 'max': return Math.max(a, b);
        case 'abs': return Math.abs(a);
        case 'round': return Math.round(a);
        case 'floor': return Math.floor(a);
        case 'ceil': return Math.ceil(a);
        default: return NaN;
      }
    }
    return nm === 'pi' ? Math.PI : NaN;
  }
  function p2(){
    let x = p1(); ws();
    for(;;){
      const ch = src[i];
      if(ch !== '*' && ch !== '/' && ch !== '%') return x;
      i++; const y = p1(); ws();
      x = ch === '*' ? x * y : ch === '/' ? (y === 0 ? 0 : x / y) : (y === 0 ? 0 : x % y);
    }
  }
  function p3(){
    let x = p2(); ws();
    for(;;){
      const ch = src[i];
      if(ch !== '+' && ch !== '-') return x;
      i++; const y = p2(); ws();
      x = ch === '+' ? x + y : x - y;
    }
  }
  const r = p3(); ws();
  return (i < src.length || !Number.isFinite(r)) ? NaN : r;
}
/* 搭配限制「字根互不重复」那一档要用：相邻两个汉字算一个字组 */
function bigrams(s){
  const t = String(s == null ? '' : s).replace(/[^一-鿿]/g, ''), out = [];
  for(let k = 0; k < t.length - 1; k++) out.push(t.slice(k, k + 2));
  return out;
}
function setShare(a, b){
  if(!a.length || !b.length) return 0;
  let n = 0;
  for(const x of a) if(b.indexOf(x) >= 0) n++;
  return n / Math.min(a.length, b.length);
}
function firstDiff(a, b){
  const p = bigrams(a), q = bigrams(b);
  if(!p.length || !q.length) return String(a) !== String(b) ? 1 : 0;
  return setShare(p, q) < 0.4 ? 1 : 0;
}

/* 配方上的作者和版本号：信息区那一行拼在后面，没填就不摆 */
function genMeta(R){
  return [R.ver && ('v' + R.ver), R.author && ('作者 ' + R.author)].filter(Boolean).join(' · ');
}

/* ============================================================
   一份配方 = 一个功能视图：左控件右结果，中间那条分隔条和推演一个模样
   ============================================================ */
class GenView{
  constructor(host, R){
    this.host = host; this.R = R;
    this.ctrl = {}; this.displays = []; this.refreshers = []; this.timers = [];
    this._used = {};    /* 「随机抽的词不重复」这轮抽过什么 */
    this._cv = {}; this._cvp = {}; this._in = {};   /* 这一轮每个变量取到的值（分支判定和拼结果共用一份）；_in 挡住自己指着自己 */
    /* boot 是异步的；先给个空状态，向导那边边改边重画时不会踩到 undefined */
    this.st = {};
  }
  async boot(){
    await Banks.loadReg();
    for(const n of GEN_BANKS(this.R)){ try{ await genBank(n).load(); }catch(e){ console.warn('词库没读到：' + n); } }
    this.st = Object.assign(this.st || {}, (await State.get('gen-state.' + this.R.id, {})) || {});
  }
  /* ---------- 建控件用的小件套 ---------- */
  sel(opts){ const s = h('select', {}, []); this.setOpts(s, opts); return s; }
  setOpts(s, opts){
    const cur = s.value;
    s.innerHTML = '';
    for(const o of opts) s.appendChild(h('option', { value:o, selected:o === cur }, o));
    if(!opts.includes(cur)) s.value = opts[0] || '';
  }
  field(label, el){ return h('div', { class:'wnw-field' }, [h('label', {}, label), el]); }
  node(id){ let f = null; const walk = a => { for(const n of a || []){ if(n.id === id) f = n; walk(n.items); } }; walk(this.R.ui); return f; }

  /* ---------- 渲染 ---------- */
  /* 记录入口看宿主持不持有：GenLog 是脚本顶层的 const，不在 window 上，
     所以只能按名字判存在，不能写 window.GenLog */
  hasLog(){ try{ return typeof GenLog !== 'undefined'; }catch(e){ return false; } }
  paint(){
    const host = this.host, R = this.R;
    host.innerHTML = ''; this.ctrl = {}; this.displays = []; this.refreshers = [];
    const wrap = h('div', { class:'sh-pane' });
    const form = h('div', { class:'sh-col sh-form' });
    const out = h('div', { class:'sh-col sh-out' });
    wrap.appendChild(form); wrap.appendChild(out);
    host.appendChild(wrap);
    shSplit(wrap, form, shSplitKey('gen.' + R.id));
    this.outBox = out;

    const card = h('div', { class:'wnw-card' });
    const info = [R.desc, genMeta(R)].filter(Boolean).join(' · ');
    if(info) card.appendChild(h('div', { class:'wnw-hint' }, info));
    this.build(card, R.ui);
    card.appendChild(h('div', { class:'wnw-row', style:'margin-top:4px' }, [
      h('button', { class:'wnw-btn primary', 'data-nodrag':'1', onclick:() => this.generate() }, '生成'),
      this.hasLog() ? h('button', { class:'wnw-btn mini', 'data-nodrag':'1', onclick:() => GenLog.open(R.id) }, '记录') : null
    ]));
    form.appendChild(card);
    /* 数字展示和提取计数跟着表单任何一下改动刷新，省得每个控件自己找邻居 */
    form.addEventListener('input', () => this.tick());
    form.addEventListener('change', () => this.tick());
    this.tick();
    this.show([]);
  }
  /* 表单每动一下：先把融合下拉的选项按现填的内容重出，再更新数字展示，最后把改合格了的格子那行红字擦掉 */
  tick(){ for(const f of this.refreshers) f(); for(const f of this.displays) f(); this.relieve(); }
  /* ui 节点 → DOM */
  build(box, nodes){
    for(const n of nodes || []){
      if(n.t === 'text'){ box.appendChild(h('div', { class:'wnw-hint' }, n.text || '')); continue; }
      if(n.t === 'row'){ box.appendChild(h('div', { class:'wnw-row' }, (n.items || []).map(it => this.ctl(it)))); continue; }
      if(n.t === 'group'){ box.appendChild(this.groupNode(n)); continue; }
      if(n.t === 'tabs'){ box.appendChild(this.tabsNode(n)); continue; }
      if(n.t === 'pane'){ const b = h('div', { class:'wnw-col' }); this.build(b, n.items); box.appendChild(b); continue; }
      if(n.t === 'loop'){
        const g = h('div', { class:'sh-mod' });
        const src = this.label(n.src);
        g.appendChild(h('b', {}, (n.name || '循环') + ' · 份数 = ' + (src || n.src)));
        this.build(g, n.items); box.appendChild(g); continue;
      }
      box.appendChild(this.ctl(n));
    }
  }
  /* 成组：件-8 那一档可收起 —— 名字做成一个能点的，收起只藏这一块的 body。
     里面每一格照样建过、照样取得到值，「上次填到哪记到哪」也照旧：藏起来不等于没填。
     箭头走图标库里那两个（摊开 caretDown / 收起 caretRight），换图时 icoPaint 认得这一位。 */
  groupNode(n){
    const g = h('div', { class:'sh-mod' });
    const body = h('div', { class:'sh-mod-body' });
    this.build(body, n.items);
    if(!n.fold){
      if(n.name) g.appendChild(h('b', {}, n.name));
      g.appendChild(body);
      return g;
    }
    let open = n.fold !== 'shut';
    const car = h('span', { html:icoMarkup(open ? 'caretDown' : 'caretRight') });
    const head = h('button', { class:'wnw-btn mini sh-fold', 'data-nodrag':'1',
      'aria-expanded':open ? 'true' : 'false' }, [car, h('span', {}, n.name || '这一组')]);
    head.addEventListener('click', () => {
      open = !open;
      body.style.display = open ? '' : 'none';
      car.setAttribute('data-ico', open ? 'caretDown' : 'caretRight');
      icoPaint(car);
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    if(!open) body.style.display = 'none';
    g.appendChild(head);
    g.appendChild(body);
    return g;
  }
  /* 页签：一页一块界面，点页签换页。每一页的控件全都建出来（不然取值、记填写都认不到它们），
     不是当前页的那一块先藏起来 —— 藏起来不等于没建。 */
  tabsNode(n){
    const panes = (n.items || []).filter(x => x && x.t === 'pane');
    const box = h('div', { class:'sh-tabs' });
    if(!panes.length) return h('div', { class:'sh-mod' }, [h('div', { class:'wnw-hint' }, '（还没有页）')]);
    const bar = h('div', { class:'wnw-row sh-tabbar' });
    const bodies = [];
    const btns = [];
    const pick = i => {
      bodies.forEach((b, k) => { b.style.display = k === i ? '' : 'none'; });
      btns.forEach((b, k) => { b.className = 'wnw-btn mini' + (k === i ? ' on' : ''); });
    };
    panes.forEach((p, i) => {
      const body = h('div', { class:'sh-mod-body' });
      this.build(body, p.items);
      bodies.push(body);
      const b = h('button', { class:'wnw-btn mini', 'data-nodrag':'1',
        onclick:() => pick(i) }, p.name || ('第 ' + (i + 1) + ' 页'));
      btns.push(b);
      bar.appendChild(b);
      box.appendChild(body);
    });
    box.insertBefore(bar, box.firstChild);
    pick(0);
    return box;
  }
  label(id){ const n = this.node(id); return n ? (n.name || n.id) : ''; }
  /* 按变量名取一个数：控件自带的 num() / 段数优先，其次现取一遍 parts 捞数，最后吃这一轮缓存
     （数算逻辑、多维定义这些「只有名、没有控件」的传输口也就能当份数和数字展示了） */
  numOf(nm){
    const node = nm ? this.byName(nm) : null;
    const c = node ? this.ctrl[node.id] : null;
    if(c && c.num) return c.num();
    if(c && c.fields) return c.fields().length;
    if(c && c.parts){
      const p = c.parts();
      const g = gNum(p && p[''] !== undefined ? p[''] : '');
      if(g === g) return g;
    }
    const g = gNum(this._cv && this._cv[nm] !== undefined ? this._cv[nm] : '');
    if(g === g) return g;
    /* 数算逻辑的口子在缓存里还没有（轮还没跑到它）：就地拿已经取到的值算一遍，
       这样「份数跟着算出来的数走」哪怕循环排在后面也认 */
    const cv = this.calcPort(nm);
    return cv === null ? null : cv;
  }
  /* 找一个开着的名叫 nm 的数算口子，现算它的数；没有这条返回 null */
  calcPort(nm){
    if(!nm) return null;
    for(const r of (this.R.rules || [])){
      if(!r || r.k !== 'calc' || !r.on) continue;
      if(String(r.name || '').trim() !== nm) continue;
      const v = calcEval(String(r.expr || ''), x => {
        const cached = this._cv && this._cv[x] !== undefined ? this._cv[x] : '';
        return gNum(cached);
      });
      return Number.isFinite(v) ? Math.round(v * 10000) / 10000 : null;
    }
    return null;
  }
  /* 控件指定：控件名 + 控件功能，参数跟着功能走 */
  ctl(n){
    const mk = CTL[n.fn];
    if(!mk) return h('div', { class:'wnw-chip' }, '不认识的控件功能：' + n.fn);
    const made = mk(n, this);
    this.ctrl[n.id] = Object.assign(made, { node:n });
    this.restore(n.id, made.el);
    made.el.addEventListener('change', () => this.remember(made.el, n));
    made.el.addEventListener('input', () => this.remember(made.el, n));
    /* 这一格不合格就写在这格下面：建界面时先留个空位，点「生成」才往里填字 */
    made.err = h('div', { class:'sh-err' });
    return h('div', { class:'sh-cell' }, [this.field(n.name || n.id, made.el), made.err]);
  }
  /* 一个控件里存值的输入框：先看控件自己，再按 DOM 顺序找里面的下拉/文本框/数字框
     （数字指定、文本提取这类控件外面还包着一层 div，不能只盯 el 本身） */
  valueEls(el){
    const all = [];
    const isBox = x => x.tagName === 'SELECT' || x.tagName === 'TEXTAREA' || x.tagName === 'INPUT';
    if(isBox(el)) all.push(el);
    if(el.querySelectorAll) for(const x of el.querySelectorAll('select, textarea, input')) all.push(x);
    return all;
  }
  /* 上一次填到哪记到哪：下拉记 v/v2，文本框数字框同样记 v。
     勾选框那一类（带自己的 state/apply）例外：它们的 valueEls 就是那几个勾选框，
     往 value 里塞存下来的字符串会把候选词本身顶掉，所以整段交给控件自己那两句。 */
  restore(id, el){
    const rec = this.st[id];
    if(!rec) return;
    const c = this.ctrl[id];
    if(c && c.state){
      if(rec.s) c.apply(rec.s);
      this.tick();
      return;
    }
    const vs = this.valueEls(el);
    const put = (x, val) => {
      if(!x || val === undefined || val === '') return;
      if(x.tagName === 'SELECT'){ if([...x.options].some(o => o.value === val)) x.value = val; return; }
      x.value = val;
    };
    put(vs[0], rec.v);
    if(vs.length > 1) put(vs[1], rec.v2);
    /* 联动那一头：第一套被还原了，第二套得重出一次才认得它 */
    this.tick();
  }
  remember(el, box){
    const id = box.id;
    if(!id) return;
    const c = this.ctrl[id];
    const own = !!(c && c.state);
    const vs = this.valueEls(el);
    if(!vs.length && !own) return;
    const rec = own ? { s:c.state() } : { v:vs[0].value };
    if(!own && vs.length > 1) rec.v2 = vs[1].value;
    this.st[id] = rec;
    State.set('gen-state.' + this.R.id, this.st);
  }

  /* ---------- 取值 → 出结果 ---------- */
  /* 配方里的判断逻辑：摆了的按开关走，没摆的照 RULE_DEF 那一档；一条 rules 都没有 = 老配方，全不走 */
  rule(k){
    const rs = this.R.rules || [];
    if(!rs.length) return null;
    const r = rs.find(x => x && x.k === k);
    if(r) return r.on ? r : null;
    return RULE_DEF[k] ? { k:k, on:true } : null;
  }
  /* 随机抽词：开着「权重判断」就认词条前头的「4|」权重记号按权重抽；
     开着不重复就先把这轮抽过的排掉，那一摞抽干了才允许重样。返回的都是去掉记号的词本身 */
  pick(list, c){
    const r = this.rule('noRepeat');
    const bind = r && this.fits(r, c);
    const wt = this.rule('weight');
    const es = [];
    for(const w0 of (list || []).filter(Boolean)){
      const e = wt ? wordW(w0) : { n:1, w:String(w0) };
      if(!e.w) continue;
      if(bind && this._used[e.w]) continue;
      es.push(e);
    }
    const pool = es.length ? es : (list || []).filter(Boolean).map(w => (wt ? wordW(w) : { n:1, w:String(w) }));
    if(!pool.length) return '';
    const w = wt ? weightPick2(pool) : pickOne(pool.map(x => x.w));
    if(bind) this._used[w] = (this._used[w] || 0) + 1;
    return w;
  }
  /* 这条规则管不管这个变量：没绑 src 就管全部，绑了就只对得上名字那一摊 */
  fits(r, who){
    if(!r || !r.src) return true;
    const n = who && typeof who === 'object' ? (who.name || who.id) : who;
    return r.src === n;
  }

  /* ---------- 生-19 搭配限制（限-1）：两个来源现下的值互相比 ----------
     a / b 是变量名（b 空着就拿 a 自己那些行互比）；比的是「现下取到的值」，不是结果行。
     同一行自己撞自己不算（穿透下拉把父类子类收在一起，行名会重）。 */
  valRows(nm){
    const out = [];
    if(!nm) return out;
    const node = this.byName(nm);
    const p = node && node.t === 'ctl' && this.ctrl[node.id] ? this.valOf(nm, () => this.ctrl[node.id].parts()) : null;
    if(Array.isArray(p)) p.forEach((t, i) => out.push({ i:i, v:String(t == null ? '' : t) }));
    else out.push({ i:0, v:String(p && p[''] !== undefined ? p[''] : (p == null ? '' : p)) });
    return out;
  }
  pairBad(a, b, how){
    const x = String(a || ''), y = String(b || '');
    if(how === 'same') return x === y;
    if(how === 'contain') return !!x && !!y && (x.indexOf(y) >= 0 || y.indexOf(x) >= 0);
    if(how === 'tailHead'){ const tx = x.replace(/[^一-鿿]/g, ''), ty = y.replace(/[^一-鿿]/g, '');
      return !!tx && !!ty && tx[tx.length - 1] === ty[0]; }
    if(how === 'noShare') return setShare(bigrams(x), bigrams(y)) > 0;
    return false;
  }
  pairEng(rows, r){
    const a = String(r.a || '').trim(), b = String(r.b || '').trim() || a;
    if(!a) return rows;
    const av = this.valRows(a), bv = this.valRows(b);
    for(const pa of av) for(const pb of bv){
      if(a === b && pa.i >= pb.i) continue;
      if(this.pairBad(pa.v, pb.v, r.how || 'same')) return [];
    }
    return rows;
  }
  /* ---------- 生-19 相似程度（限-2）：两行汉字字组四成以上相同算「太像」；
     再对照一本现实词表（like 那个分类，逐条比），撞上的剔掉。剔行，带放宽记号的让路。 ---------- */
  likeEng(rows, r){
    const pct = Number(r.pct) || 40;
    const real = [];
    if(r.cat){
      const bank = genBank(r.bank || this.R.bank);
      for(const w of bkThru(bank, r.cat)) if(w !== RANDOM) real.push(stripW(w));
    }
    const bad = x => {
      const s = String(x.v || '');
      for(const o of rows) if(o !== x && setShare(bigrams(s), bigrams(o.v)) * 100 >= pct) return true;
      for(const w of real) if(setShare(bigrams(s), bigrams(w)) * 100 >= pct) return true;
      return false;
    };
    return rows.filter(x => !bad(x));
  }
  /* ---------- 生-19 多样化（限-3）：留下的每一对都要「够不像」，最多 n 条 ----------
     差异算法照清单那个口径：相邻两字算一个字组，两行共有字组占短的那摞四成以内算「有一项不同」。 */
  diverseEng(rows, r){
    const min = Number(r.minDiff) || 1, n = Number(r.n) || 3;
    const out = [];
    for(const x of rows){
      if(out.length >= n) break;
      if(out.every(y => firstDiff(x.v, y.v) >= min)) out.push(x);
    }
    return out.length ? out : rows.slice(0, n);
  }
  /* ---------- 生-19 生成格式改写（改-1）：抽完还要动内容 —— 一排现成的改写动作 ----------
     剥括号 / 色号换黑 / 英文连着重复的两三个字母去掉 / 首字母大小写 / 按「旧=>新」替换表 / 只留数字 */
  rwOps(){
    return [{ op:'paren', re:/（[^（）]*）|\([^()]*\)/g, to:'' },
      { op:'hex', re:/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g, to:'#000000' },
      { op:'light', re:/\b(?:#(?:fff|ffffff|f[0-9a-f]{5})|white)\b/gi, to:'black' },
      { op:'rep', re:/([a-zA-Z])\1{1,2}/g, to:'$1$1' },
      { op:'cap', re:/^([a-z])/, to:(x, m) => m[1].toUpperCase() },
      { op:'low', re:/^([A-Z])/, to:(x, m) => m[1].toLowerCase() },
      { op:'num', re:/[^\d.]/g, to:'' }];
  }
  rwEng(rows, r){
    const list = (r.ops || []).filter(o => o && o.on !== false);
    if(!list.length) return rows;
    const std = this.rwOps();
    return rows.map(x => {
      let s = x.v;
      for(const o of list){
        if(o.op === 'replace') continue;
        const e = std.find(t => t.op === o.op);
        if(e) s = s.replace(e.re, e.to);
      }
      /* 「旧=>新」替换表：一段句子里分号隔开好几条，挨个原样替换 */
      for(const p of list.filter(o => o.op === 'replace'))
        for(const seg of String(p.segs || '').split(/[；;]/)){
          const m = /^(.*?)\s*(?:=>|→|=)\s*(.*)$/.exec(seg.trim());
          if(m && m[1]) s = s.split(m[1]).join(m[2]);
        }
      return Object.assign({}, x, { v:s });
    });
  }

  /* ---------- 条件分支（生-18）：只做决定，不掺和取值 ----------
     读一个变量现下是什么 → 从上往下找第一条成立的（成立就停，末尾不填条件的那条算否则）
     → 拿出这一条给的决定。决定本身是一份「要改哪儿」的清单，谁消费谁自己来取：
       · 改分类：取值那一头问 wordsOf()，抽词从分支给的那几类里抽；
       · 换拼法 / 换多项之间：拼结果那一头问 actOf()；
       · 不要哪几格 / 换条数 / 插一行：整条判断流水线的最后一步 branchRows() 做。
     这条块自己不碰词库、不重排、不去改任何一条别的规则，也就没有谁必须先走谁必须后走的问题。 */
  branches(){
    return (this.R.rules || []).filter(r => r && r.k === 'branch' && r.on && r.src);
  }
  /* 一个变量现下的值：这一轮取过就用取过那份（随机那一档不许多抽一遍），没取过现取一次存下来。
     _in 是防自己指着自己：分支读甲、而甲抽词又要问分支，绕回来时给个空值，不递归 */
  curVal(name){
    if(!name) return '';
    if(this._cv && this._cv[name] !== undefined) return this._cv[name];
    const node = this.byName(name);
    if(!node) return '';
    if(node.t === 'loop'){ const inner = {}; this.collect(inner, node); return (this._cv && this._cv[name]) || ''; }
    const c = this.ctrl[node.id];
    if(!c || this._in[name]) return '';
    this._in[name] = 1;
    try{ this.valOf(name, () => c.parts()); }finally{ delete this._in[name]; }
    return (this._cv && this._cv[name]) || '';
  }
  /* 比一下这一条成不成立；没写条件的就是「否则」 */
  caseOn(c, val){
    const s = String(val == null ? '' : val), t = String(c.txt == null ? '' : c.txt);
    switch(c.op){
      case 'eq': return s === t;
      case 'ne': return s !== t;
      case 'has': return !!t && s.indexOf(t) >= 0;
      case 'nh': return !t || s.indexOf(t) < 0;
      case 'seq': return s.replace(/\s/g, '') === t.replace(/\s/g, '');
      case 're': {
        if(!t) return false;
        let re = null;
        try{ re = new RegExp('^(?:' + t + ')$'); }catch(e){ return false; }
        return re.test(s);
      }
      case 'nEq': return gNum(s) === gNum(t);
      case 'nGe': { const a = gNum(t); return a === a && gNum(s) >= a; }
      case 'nLe': { const a = gNum(t); return a === a && gNum(s) <= a; }
      case 'nIn': { const p = t.split(/[,，]/), a = gNum(p[0]), b = gNum(p[1]), x = gNum(s);
        return x === x && a === a && b === b && x >= Math.min(a, b) && x <= Math.max(a, b); }
      case 'LEq': return gLen(s) === gNum(t);
      case 'LGe': { const a = gNum(t); return a === a && gLen(s) >= a; }
      case 'LLe': { const a = gNum(t); return a === a && gLen(s) <= a; }
      case 'LIn': { const p = t.split(/[,，]/), a = gNum(p[0]), b = gNum(p[1]), L = gLen(s);
        return a === a && b === b && L >= Math.min(a, b) && L <= Math.max(a, b); }
      default: return true;
    }
  }
  /* 这条分支现下命中哪一条；没命中返回 null（一条都不成立，也没有「否则」） */
  hit(r){
    const val = this.curVal(r.src);
    for(const c of r.cases || []) if(!c.op || this.caseOn(c, val)) return c;
    return null;
  }
  act(r){ const cs = this.hit(r); return cs && cs.act ? cs.act : null; }
  /* 这一格现下该从哪几类抽词：有分支指着它就换成它给的那批 */
  effCats(n){
    const nm = n.name || n.id;
    for(const r of this.branches()){
      const a = this.act(r);
      if(a && a.cats && (a.cats[nm] || []).length) return a.cats[nm];
    }
    return n.cats || [];
  }
  /* deep 为真连子类一起收（穿透那一档），否则只收这一类自己的词条 */
  wordsOf(n, deep){
    const bank = genBank(n.bank || this.R.bank), out = [];
    for(const cat of this.effCats(n))
      for(const w of (deep ? bkThru(bank, cat) : bank.raw(cat))) if(w !== RANDOM && !out.includes(w)) out.push(w);
    return out;
  }
  /* 拼结果的口径那种决定（换拼法 / 换多项之间）：第一条给了这个动作的说了算 */
  actOf(k){
    for(const r of this.branches()){
      const a = this.act(r);
      if(a && a[k] !== undefined && a[k] !== '') return a[k];
    }
    return null;
  }
  /* 落在结果上的那三件事，排在整条判断流水线最后：只看着已经裁好的那些行，回头不掺和取值 */
  branchRows(rows){
    let out = rows;
    const join = (this.R.out && this.R.out.join) || '\n', re = this.rule('dropEmpty');
    for(const r of this.branches()){
      const a = this.act(r);
      if(!a) continue;
      if((a.skip || []).length) out = out.filter(x => a.skip.indexOf(rowVar(x.k)) < 0);
      if(Number(a.n) > 0) out = out.slice(0, Number(a.n));
      for(const p of a.add || []){
        const v = fillTpl(String(p && p.v || ''), this._vals || {}, join);
        if(v.trim() || !(re && !re.src)) out.push({ k:String(p && p.k || ''), v:v });
      }
    }
    return out;
  }
  /* 结论挂在传输口上：这条块起的那个名，模板里 {那名} 取的就是它；没写结论就拿那条填的条件顶上 */
  ports(){
    const out = {};
    for(const r of this.branches()){
      const h = this.hit(r);
      if(!h) continue;
      const nm = String(r.name || '').trim() || '分支';
      const v = h.out !== undefined && h.out !== '' ? h.out : (h.txt || '');
      out[nm] = Object.assign(out[nm] || {}, { '':String(v) });
    }
    return out;
  }
  /* ---------- 生-19 数算逻辑：拿这一轮已经取到的变量值算一个数，挂在那个名字上 ----------
     表达式里变量写 {名}（「18级」这种带单位照样当 18），支持 + - * / % ( ) 和 min max abs round floor ceil。
     清单的边界口径：这条只管算出这个数，接到下游条数 / 区间 / 份数上归控件那头（份数跟着下拉里就能选它）。 */
  calcEng(){
    const out = {};
    for(const r of (this.R.rules || [])){
      if(!r || r.k !== 'calc' || !r.on) continue;
      const nm = String(r.name || '').trim();
      if(!nm) continue;
      const v = calcEval(String(r.expr || ''), x => {
        const g = this._cv && this._cv[x] !== undefined ? this._cv[x] : '';
        return gNum(g);
      });
      out[nm] = { '':Number.isFinite(v) ? String(Math.round(v * 10000) / 10000) : '' };
      /* 存进这一轮的缓存：后一条数算拿它当变量、条件分支和数字展示都读同一份，不再另算 */
      if(this._cv) this._cv[nm] = out[nm][''];
    }
    return out;
  }
  /* ---------- 生-19 多维定义（定-1）：几个维度互相定义，缺哪个靠表里的规则推出来 ----------
     三块料照清单：维度表（每个维度认词库里哪一类的编码词条）、规则表（一行一条「要推 土壤：气候,植被 = S3,F2」）、
     编码是维度之间对话的语言（词条写「C1 热带雨林」，空格前是编码，后面是词）。
     界面上填了编码或词的维度算已知；只填了一个的，把词对着那一类查回编码。
     推的时候递归：规则要「植被 V2」而植被空着，先拿手头的条件去推植被，推出 V2/V5 这条才算成立；
     推不出就走 fallback 那句（「没有该生态」那种）。out 选 word 就报词，选 code 就报编码。
     勾了摊组合，就把已知维度能配的全组合摊成行，交给「多样化」去挑差异够大的几条。 */
  dimCodes(d){
    const cats = String(d && d.cat || '').split(/[;；]/).map(s => s.trim()).filter(Boolean);
    const out = [];
    for(const cat of cats) for(const w of genBank(d.bank || this.R.bank).raw(cat)){
      if(w === RANDOM) continue;
      const m = /^(\S+)\s+(.+)$/.exec(w);
      if(m && !out.some(e => e.code === m[1] && e.word === m[2])) out.push({ code:m[1], word:m[2], full:w });
    }
    return out;
  }
  dimSolved(e){ return !!String(e && e.val || '').trim(); }
  /* 已知维度先归一成编码：填了编码认编码，填的词在那一类的词条里对着找 */
  dimBase(dims){
    const at = {};
    dims.forEach((d, di) => {
      const t = String(d.val || '').trim();
      if(!t) return;
      const entries = this.dimCodes(d);
      const hit = entries.find(e => e.code === t || e.full === t || e.word === t);
      at[d.d] = hit ? hit.code : t;
    });
    return at;
  }
  dimTable(r){
    const out = [];
    for(const line of (r.table || [])){
      const s = String(line || '').trim();
      if(!s) continue;
      const m = /^([^:：]+)[:：](.*)$/.exec(s); if(!m) continue;
      const eq = /^(.*?)[=＝](.*)$/.exec(m[2].trim()); if(!eq) continue;
      out.push({ want:m[1].trim(),
        cond:String(eq[1] || '').split(/[+,，]/).map(x => x.trim()).filter(Boolean),
        give:String(eq[2] || '').split(/[+,，]/).map(x => x.trim()).filter(Boolean) });
    }
    return out;
  }
  dimWant(dims, want, at, table, stack){
    const d = dims.find(x => (x.d || '') === want);
    if(!d) return null;
    if(this.dimSolved(d)){ const c = at[want]; if(c) return c; }
    if(stack.indexOf(want) >= 0) return null;
    for(const t of table){
      if(t.want !== want) continue;
      let ok = true;
      for(const c of t.cond){
        const sp = c.lastIndexOf(' '), nm = sp < 0 ? c : c.slice(0, sp), code = sp < 0 ? '' : c.slice(sp + 1);
        if(!code){ if(!this.dimSolved(dims.find(x => (x.d || '') === nm))) ok = false; continue; }
        let have = at[nm];
        if(have === undefined){
          const sub = this.dimWant(dims, nm, at, table, stack.concat([want]));
          if(sub === null || sub === false){ ok = false; break; }
          have = sub;
        }
        if(have !== code){ ok = false; break; }
      }
      if(ok) return t.give[0] || null;
    }
    return false;
  }
  dimSolve(r){
    const dims = (r.dims || []).map(d => Object.assign({}, d));
    const table = this.dimTable(r);
    const at = this.dimBase(dims);
    for(const d of dims){
      if(this.dimSolved(d)) continue;
      let c = this.dimWant(dims, d.d, at, table, []);
      /* 表里推不出来就走这条维度自己的「推不出就报那句」（fallback），还没有就判这一摊推不出 */
      if((c === null || c === false) && String(d.fallback || '').trim()) c = d.fallback.trim();
      if(c && c !== true) d.solved = c;
      else if(c === false) return { dims, at, ok:false };
    }
    return { dims, at, ok:dims.every(d => this.dimSolved(d) || d.solved) };
  }
  dimPorts(got){
    const out = {};
    for(const g of got){
      const r = g.r;
      const vals = [];
      /* 推出来的值挂在 dimSolve 那份副本上（g.g.dims），不是配方里写死的原维度 */
      for(const d of (g.g && g.g.dims) || []){
        const raw = this.dimSolved(d) ? String(d.val).trim() : (d.solved || '');
        if(!raw) continue;
        if(r.out === 'code'){ vals.push(raw); continue; }
        const hit = this.dimCodes(d).find(e => e.code === raw);
        vals.push(hit ? hit.word : raw.replace(/^\S+\s+/, ''));
      }
      out[String(r.name || '').trim() || '定义'] = { '':vals.join(r.join || '、') };
    }
    return out;
  }
  /* 摊组合：每个维度现下能配的那些编码全展开（上限 500 条），一行一条，交给多样化那头挑 */
  dimRows(g){
    const r = g.r;
    const nm = String(r.name || '').trim() || '定义';
    const sol = (g.g && g.g.dims) || [];
    const lists = sol.map(d => {
      if(this.dimSolved(d)){ const c = this.dimBase([d])[d.d]; return [c]; }
      if(d.solved) return [d.solved];
      return this.dimCodes(d).map(e => e.code);
    });
    if(!lists.length || lists.some(L => !L || !L.length) || lists.reduce((a, L) => a * L.length, 1) > 500) return [];
    let combos = [[]];
    lists.forEach((L, di) => {
      const next = [];
      for(const c of combos) for(const x of L) next.push(c.concat([[di, x]]));
      combos = next;
    });
    const parts = combos.map(c => {
      const vals = [];
      for(const [di, code] of c){
        if(r.out === 'code'){ vals.push(code); continue; }
        const hit = this.dimCodes(sol[di]).find(e => e.code === code);
        vals.push(hit ? hit.word : code);
      }
      return vals.join(r.join || '、');
    });
    this.cache(nm, parts);
    /* 一行一条摊开：多样化那头的口径就是逐行比差异 */
    return parts.map((t, i) => ({ k:nm + ' · ' + (i + 1), v:t }));
  }
  dimAll(){
    const rs = (this.R.rules || []).filter(x => x && x.k === 'dim' && x.on && (x.dims || []).length);
    if(!rs.length) return { got:[], port:{} };
    const got = [];
    for(const r of rs){
      if(r.src){
        const up = String(r.srcVar || '').trim();
        const val = up ? this.curVal(up) : '';
        const on = (r.onVals || []).length ? (r.onVals || []).some(t => String(t).trim() && String(val).indexOf(String(t).trim()) >= 0) : !!String(val).trim();
        if(!on) continue;
      }
      got.push({ r, g:this.dimSolve(r) });
    }
    return { got, port:this.dimPorts(got) };
  }

  /* 一层控件的值塞进 vals；循环节点按份数出多份。
     两处都往 _cv/_cvp 里存一份：条件分支判定要读的值和这里出的值是同一次抽的，不许多抽一遍 */
  collect(vals, n){
    if(n.t === 'row' || n.t === 'group' || n.t === 'tabs' || n.t === 'pane'){
      for(const it of n.items || []) this.collect(vals, it); return;
    }
    if(n.t === 'loop'){
      const nm = n.name || n.id;
      if(this._cvp && this._cvp[nm] !== undefined){ vals[nm] = this._cvp[nm]; return; }
      const src = this.ctrl[n.src];
      /* 份数跟着走的那一头：控件的 num() / 段数优先，数算逻辑这些传输口按名字也认（生-19 数算传递） */
      let count = src ? (src.num ? src.num() : (src.fields ? src.fields().length : 0))
        : (this.numOf(this.label(n.src) || String(n.src || '')) || 0);
      count = Math.min(99, Math.max(0, count));
      const parts = [];
      for(let i = 0; i < count; i++){
        const inner = { 序:String(i + 1) };   /* 循环模板里写 {序} 就是第几份 */
        for(const it of n.items || []) this.collect(inner, it);
        parts.push(fillTpl(n.tpl || '', inner, this.R.out.join || '\n'));
      }
      this.cache(nm, parts);
      vals[nm] = parts;
      return;
    }
    if(n.t !== 'ctl') return;
    const c = this.ctrl[n.id];
    if(!c) return;
    const nm = n.name || n.id;
    vals[nm] = this.valOf(nm, () => c.parts());
  }
  /* 取一次存一次：这一轮的随机值只有一份，分支判定和拼结果用的是同一份 */
  valOf(nm, get){
    if(this._cvp && this._cvp[nm] !== undefined) return this._cvp[nm];
    const p = get();
    this.cache(nm, p);
    return p;
  }
  cache(nm, p){
    if(!this._cv) return;
    this._cvp[nm] = p;
    this._cv[nm] = Array.isArray(p) ? p.join('\n')
      : String(p && p[''] !== undefined ? p[''] : (p == null ? '' : p));
  }
  /* 区间随机数：整轮开始时把界面上还空着的每一格各掷一次；手填过的不许多掷 */
  rollRngs(){
    for(const id in this.ctrl){
      const c = this.ctrl[id];
      if(c.node && c.node.fn === 'rng' && c.roll && !c.has()) c.roll();
    }
  }
  /* 格式模板：它自己交白卷，等所有格子的值都进了 vals，再拿 vals 把抽中那份格式的 {…} 填上 */
  fillFmts(vals){
    const join = (this.R.out && this.R.out.join) || '\n';
    for(const id in this.ctrl){
      const c = this.ctrl[id];
      if(!c.node || c.node.fn !== 'fmt') continue;
      const nm = c.node.name || c.node.id;
      const p = this._cvp[nm];
      if(!p) continue;
      p[''] = fillTpl(p[''] || '', vals, join);
    }
  }
  run(){
    const R = this.R, out = R.out || { mode:'text' }, vals = {};
    this._used = {};
    this._cv = {}; this._cvp = {}; this._in = {};   /* 这一轮取过的值：分支判定不另起一炉子重抽 */
    this.rollRngs();                                /* 区间随机数：界面上留空的每一格先掷一次（生-19） */
    for(const n of R.ui || []) this.collect(vals, n);
    this.fillFmts(vals);                            /* 格式模板：抽好的格式拿现下这些格子的值填上（生-19） */
    /* 条件分支的结论挂进传输口：模板里 {那个名字} 取的就是它，和控件变量一个写法 */
    Object.assign(vals, this.ports());
    /* 数算逻辑和多维定义同样走「只出值、控件消费」的口径：算好的数 / 推出的编码挂成变量 */
    const dim = this.dimAll();
    Object.assign(vals, this.calcEng(), dim.port);
    /* 多维推出的编码/词也照名存一份进缓存：条件分支、生成式下拉这些读 _cv 的才认它 */
    for(const nm in dim.port) if(this._cv && dim.port[nm]) this._cv[nm] = dim.port[nm][''] || '';
    this._vals = vals;
    /* 一条 rules 都没摆的老配方：拼结果的口径和从前一个字不差 */
    const legacy = !(R.rules || []).length;
    const rE = legacy ? { k:'dropEmpty', on:true } : this.rule('dropEmpty');
    const rB = legacy ? { k:'dropBlock', on:true } : this.rule('dropBlock');
    const rows = [];
    const push = (k, v) => {
      const dropE = !!rE && this.fits(rE, k), dropB = !!rB && this.fits(rB, k);
      if(Array.isArray(v)){
        const parts = v.map(t => String(t == null ? '' : t).trim());
        if(legacy){ parts.forEach((t, i) => rows.push({ k:k + ' · ' + (i + 1), v:t })); return; }
        /* 整块一条都没出：开着「空块不出标题」就连名字也不摆 */
        if(!parts.some(t => t)){ if(!dropB) rows.push({ k:k, v:'' }); return; }
        parts.forEach((t, i) => { if(t || !dropE) rows.push({ k:k + ' · ' + (i + 1), v:t }); });
        return;
      }
      const s = v && v[''] !== undefined ? String(v['']) : '';
      if(s.trim() || !dropE) rows.push({ k:k, v:s });
    };
    if(out.mode === 'list' || out.mode === 'table'){
      for(const n of R.ui || []) this.listPush(n, vals, push);
    } else {
      /* 文本组合出的是一整块，没有一行一个变量可对，绑了变量的这两条在这里不掺和；
         条件分支给了换拼法 / 换多项之间的，这儿就换成它给的那一份 */
      let t = fillTpl(this.actOf('tpl') || out.template || '', vals, this.actOf('join') || out.join || '\n');
      if(out.rows){
        /* 结果不止一行（生-19）：勾上「拆成多行」，整块按行拆开进流水线，每一行各自过判 */
        for(const line of t.split('\n')){
          const s = line.trim();
          if(s || !(rE && !rE.src)) rows.push({ k:'', v:s });
        }
      } else {
        if((rE && !rE.src) || (rB && !rB.src)) t = t.split('\n').filter(x => x.trim()).join('\n');
        rows.push({ k:'', v:t });
      }
    }
    this._rows = rows;
    return this.emit(this.judge(rows));
  }
  /* 结构节点不直接出行：一行一个变量的那一档（列表 / 表格）要钻进「一行并列」「成组」「页签」
     这些壳子里找控件和组循环，整段说明文字那种不出值的直接跳过 */
  listPush(n, vals, push){
    if(n.t === 'ctl' || n.t === 'loop'){ push(n.name || n.id, vals[n.name || n.id]); return; }
    if(n.t === 'text') return;
    for(const it of n.items || []) this.listPush(it, vals, push);
  }
  /* 判断过的行 → 界面上那几行字；顺手把表格那一档的行列摆好，交给渲染和复制 */
  emit(judged){
    this._tab = (this.R.out && this.R.out.mode === 'table') ? this.toTable(judged) : null;
    return judged.map(x => (x.pre || '') + (x.k ? x.k + '：' : '') + x.v);
  }
  /* ---------- 表格那一档：行还是流水线那些行，摆的时候变量名当列、组循环的序号当行 ----------
     out.cols 挑哪几列、按什么顺序；没挑就按出现的顺序。不回头掺和判断，所以判断那套一个字不用改。 */
  toTable(rows){
    const names = [];
    for(const x of rows || []){
      const nm = rowVar(x.k);
      if(nm && names.indexOf(nm) < 0) names.push(nm);
    }
    const want = ((this.R.out || {}).cols || []).filter(nm => names.indexOf(nm) >= 0);
    const head = want.length ? want : names;
    const grid = [];
    for(const x of rows || []){
      const c = head.indexOf(rowVar(x.k));
      if(c < 0) continue;
      const m = /\s·\s(\d+)$/.exec(x.k);
      const r = m ? Number(m[1]) - 1 : 0;
      while(grid.length <= r) grid.push(head.map(() => ''));
      grid[r][c] = (x.pre || '') + x.v;
    }
    return { head, rows:grid };
  }
  /* 复制全部走表格时给制表符分隔的那一份，贴进表格软件就是一张表 */
  tabText(t){
    const cell = x => String(x == null ? '' : x).replace(/[\t\n]/g, ' ');
    return [t.head.map(cell).join('\t')].concat(t.rows.map(r => r.map(cell).join('\t'))).join('\n');
  }
  tabBox(t){
    const table = h('table', { class:'sh-table' });
    table.appendChild(h('thead', {}, [h('tr', {}, t.head.map(c => h('th', {}, c)))]));
    const body = h('tbody', {});
    for(const r of t.rows) body.appendChild(h('tr', {}, r.map(c => h('td', {}, String(c == null ? '' : c)))));
    table.appendChild(body);
    return h('div', { class:'sh-tablewrap' }, [table]);
  }
  /* ---------- 不合格重试（生-17 第一条）----------
     别的判断只会把不合格的行剔掉，剔一条就少一条，条数凑不齐；这一条是：剔之前先重抽。
     按行名找到产生这一行的那个控件 / 组循环，重新取一次值（随机那一档会真的再抽一遍），
     最多试 n 次；试到最后还不合，按 onFail 收场 —— 丢掉（照旧被后面的判断剔）·
     留最后抽的那一版（等于放宽）· 写一句占位的（地名那种「无名之地」）。
     合不合格不是这条自己定的，它照配方里摆着且开着的那几条问：
       空着的不进结果 / 一样的只留一条 / 每条字数上下限。
     那几条各自绑了变量的，这里也照绑法只对那一摊；这条自己也可以绑变量，只重抽那一个。 */
  retryChecks(){
    const out = [];
    const re = this.rule('dropEmpty');
    if(re && !re.src) out.push({ src:'', test:x => !String(x).trim() });
    const ru = this.rule('uniq');
    if(ru) out.push({ src:ru.src || '', test:(x, got) => got.indexOf(String(x).trim()) >= 0 });
    const rl = this.rule('lenLimit');
    if(rl) out.push({ src:rl.src || '', test:x => {
      const min = Number(rl.min) || 0, max = Number(rl.max) || 0, L = String(x).length;
      return (min && L < min) || (max && L > max);
    }});
    /* 搭配限制 / 相似程度也接进「不合格先重抽」：抽出来撞了就当场重抽，别等流水线剔行（生-19） */
    const rp = this.rule('pair');
    if(rp && rp.a){
      out.push({ src:rowVar(rp.a), test:(x, got) => {
        const b = this.valRows(String(rp.b || '').trim() || rp.a);
        return b.some(pb => this.pairBad(x, pb.v, rp.how || 'same'));
      }});
      const rb = String(rp.b || '').trim();
      if(rb && rb !== rp.a) out.push({ src:rowVar(rb), test:x => {
        const a = this.valRows(rp.a);
        return a.some(pa => this.pairBad(pa.v, x, rp.how || 'same'));
      }});
    }
    const rlk = this.rule('like');
    if(rlk){
      const pct = Number(rlk.pct) || 40;
      const real = [];
      if(rlk.cat){
        const bank = genBank(rlk.bank || this.R.bank);
        for(const w of bkThru(bank, rlk.cat)) if(w !== RANDOM) real.push(stripW(w));
      }
      out.push({ src:rlk.src || '', test:(x, got) => {
        const g = bigrams(x);
        for(const y of got) if(setShare(g, bigrams(y)) * 100 >= pct) return true;
        for(const w of real) if(setShare(g, bigrams(w)) * 100 >= pct) return true;
        return false;
      }});
    }
    return out;
  }
  /* 行名 → 产生它的那个 ui 节点（控件或组循环），按名字认，和结果里那一行的名字一个口径 */
  byName(name){
    let f = null;
    const walk = a => { for(const n of a || []){
      if((n.t === 'ctl' || n.t === 'loop') && (n.name || n.id) === name) f = n;
      walk(n.items);
    } };
    walk(this.R.ui);
    return f;
  }
  /* 把这一行的值重新取一次：控件就再 parts() 一遍；组循环那一格就把整块重新出一份，取它那一号。
     重抽出来的那份同时顶掉这一轮的缓存 —— 条件分支后面再读，读到的就是重抽后的值。
     对不上（文本组合那种整块、名字找不着）返回 null，这一条就不重抽。 */
  redraw(k){
    const nm = rowVar(k), node = this.byName(nm);
    if(!node) return null;
    const drop = () => { if(this._cv){ delete this._cv[nm]; delete this._cvp[nm]; } };
    if(node.t === 'loop'){
      const at = Math.max(1, parseInt(String(k).split(' · ')[1], 10) || 1);
      const inner = {};
      drop();
      this.collect(inner, node);
      const parts = Array.isArray(inner[nm]) ? inner[nm] : [];
      return String(parts[at - 1] === undefined ? (parts[0] || '') : parts[at - 1]).trim();
    }
    const c = this.ctrl[node.id];
    if(!c) return null;
    drop();
    const p = this.valOf(nm, () => c.parts());
    return String(p && p[''] !== undefined ? p[''] : '').trim();
  }
  retry(rows, rt){
    const max = Math.max(1, Math.min(999, Number(rt.n) || 12));
    const all = this.retryChecks();
    const out = [], got = [];
    for(const row of rows){
      const name = rowVar(row.k);
      if(!this.fits(rt, name)){ out.push(row); got.push(String(row.v).trim()); continue; }
      const mine = all.filter(ch => !ch.src || ch.src === name);
      const bad = x => mine.some(ch => ch.test(x, got));
      let v = row.v, tries = 0;
      if(!bad(v)){ out.push(row); got.push(String(v).trim()); continue; }
      /* 抽一次算一次；抽出来还是原来那几个字，说明这一格没有可重抽的随机源，别再空转 */
      while(tries < max){
        const nv = this.redraw(row.k);
        if(nv === null || nv === v) break;
        v = nv; tries++;
        if(!bad(v)) break;
      }
      const how = rt.onFail || 'drop';
      if(!bad(v)){ out.push(Object.assign({}, row, { v:v })); got.push(String(v).trim()); continue; }
      /* 放宽 / 占位这两种收场，是给这一行一个「我认了」的记号：
         后面那几条剔行的判断（唯一化、字数）对它网开一面，不然放宽就成了空话 */
      if(how === 'loose'){ out.push(Object.assign({}, row, { v:v, loose:1 })); got.push(String(v).trim()); continue; }
      if(how === 'ph'){
        const p = String(rt.ph || '').trim() || '（试了 ' + tries + ' 次仍不合格）';
        out.push(Object.assign({}, row, { v:p, loose:1 })); got.push(p); continue;
      }
      /* 丢掉：原样交回流水线，该剔的那一条自会剔掉 */
      out.push(row);
    }
    return out;
  }
  /* 剔行那几条判断（唯一化 / 字数上下限）：带着「放宽」记号的行不参与，
     处理完按原来的位置放回去 —— 这几条只会少不会多，所以拿剩下的依次填回硬位就对了。 */
  softFilter(rows, fn, r){
    const hard = rows.filter(x => !x.loose);
    const left = (fn(this, hard, r) || hard).slice();
    return rows.map(x => x.loose ? x : left.shift()).filter(Boolean);
  }
  /* 判断逻辑流水线：配方里认得的才走，顺序照 JUDGE；
     绑了变量的只过那一摊，处理完塞回原来那一格，别的行位置不动 */
  judge(rows){
    let out = rows;
    const rt = this.rule('retry');
    if(rt) out = this.retry(out, rt);
    for(const [k, fn] of JUDGE){
      const r = this.rule(k);
      if(!r) continue;
      if(GEN_SOFT.indexOf(k) >= 0){ out = this.softFilter(out, fn, r); continue; }
      if(!r.src){ out = fn(this, out, r) || out; continue; }
      const hit = out.filter(x => rowVar(x.k) === r.src);
      if(!hit.length) continue;
      const kept = fn(this, hit, r) || hit;
      const head = out.indexOf(hit[0]);
      out = out.slice(0, head).concat(kept, out.slice(head + 1).filter(x => rowVar(x.k) !== r.src));
    }
    /* 条件分支落在结果行上的那几件事排在最后；改分类和换拼法不归在这儿，那是取值和拼结果两处各自去读的 */
    out = this.branchRows(out);
    /* 多维定义摊开的组合排在整条流水线末尾：它们不回头掺和取值，出了行就直接交「多样化」挑（清单的口径） */
    const dim = this.dimAll();
    for(const item of dim.got) if(item.r.expand) out = out.concat(this.dimRows(item));
    return out;
  }
  /* 「有空的就不出」：界面上还有没填的控件就报名字，一条都不生成；绑了变量就只查那一个 */
  missing(who){
    const miss = [];
    const walk = a => { for(const n of a || []){
      if(n.t === 'ctl'){
        const nm = n.name || n.id;
        if(!who || who === nm){
          const c = this.ctrl[n.id];
          const box = c ? this.valueEls(c.el)[0] : null;
          if(!box || !String(box.value).trim()) miss.push(nm);
        }
      }
      walk(n.items);
    } };
    walk(this.R.ui);
    return miss.join('、');
  }
  /* ---------- 件-4 输入格级的填写要求：哪一格不合规，红字就写在那一格下面 ----------
     参数挂在控件节点上：req 必填、cMin/cMax 字数上下限、nMin/nMax 数字上下限、
     pat 整串要符合的写法、cMsg 不合规时说的那句话（写了就用它顶掉引擎自己那句）。
     和「有空的就不出」分开：那条管这一批要不要出，这一道管具体哪一格不对、并拦住这一次。
     取的是界面上现下这一格的值，不是抽出来的那个词 —— 数字展示、开关这些值不在输入框里，
     所以控件自己可以交 main()，交了就用它。 */
  cellVal(n){
    const c = this.ctrl[n.id];
    if(!c) return '';
    if(c.main) return String(c.main() || '').trim();
    const b = this.valueEls(c.el)[0];
    return b ? String(b.value).trim() : '';
  }
  cellCheck(n){
    if(!n.req && !n.cMin && !n.cMax && !n.nMin && !n.nMax && !n.pat) return '';
    const v = this.cellVal(n);
    const say = m => n.cMsg || m;
    if(n.req && !v) return say('这一格还没填');
    if(!v) return '';
    const L = gLen(v);
    if(n.cMin && L < Number(n.cMin)) return say('字数不到 ' + n.cMin + '，现在 ' + L);
    if(n.cMax && L > Number(n.cMax)) return say('字数超过 ' + n.cMax + '，现在 ' + L);
    if(n.nMin || n.nMax){
      const c = this.ctrl[n.id];
      /* 开关、滑杆、多选这一类自己就交得出数，那一档数是它们的数；其余按整串文本读成一个数 */
      const x = c && c.num ? c.num() : (/^[-+]?\d+(\.\d+)?$/.test(v) ? Number(v) : NaN);
      if(x !== x) return say('这里要填一个数');
      if(n.nMin && x < Number(n.nMin)) return say('不到 ' + n.nMin + '，现在 ' + x);
      if(n.nMax && x > Number(n.nMax)) return say('超过 ' + n.nMax + '，现在 ' + x);
    }
    /* 正则那一档走分支同一张比较表，两边说的是一种话 */
    if(n.pat && !this.caseOn({ op:'re', txt:String(n.pat) }, v)) return say('写法不对');
    return '';
  }
  /* 逐格过一遍填写要求：不合格的在那一格下面出字，返回这一轮的不合格清单（空 = 全过）
     松紧档（件-4 第四步）：这一格填了 warn，那句话照样出在下边，但不进「拦下这一轮」那一份清单 */
  cellCheckAll(){
    const bad = [];
    const walk = a => { for(const n of a || []){
      if(n.t === 'ctl'){
        const e = this.cellCheck(n);
        const c = this.ctrl[n.id];
        if(c && c.err){
          c.err.textContent = e;
          c.err.classList.toggle('warn', !!n.warn);
        }
        if(e && !n.warn) bad.push((n.name || n.id) + '：' + e);
      }
      walk(n.items);
    } };
    walk(this.R.ui);
    return bad;
  }
  /* 改好了就把红字擦掉。只在「已经过关」时擦，界面上刚打开那一下不主动出红字 */
  relieve(){
    for(const id in this.ctrl){
      const c = this.ctrl[id];
      if(c.err && c.err.textContent && !this.cellCheck(c.node)) c.err.textContent = '';
    }
  }
  /* 结果里每一行背后那个变量（生-19「只换这个」要知道这一行是谁产生的），
     定义排在 reroll 后面：那份按这一轮出行的次序取，第几条结果就对着第几行 */
  generate(){
    const bad = this.cellCheckAll();
    if(bad.length){ toast('这几格不合格 · ' + bad.join('；')); return; }
    const need = this.rule('needAll');
    if(need){
      const miss = this.missing(need.src || '');
      if(miss){ toast('这些还空着：' + miss + ' · 补上再生成'); return; }
    }
    const list = this.run();
    if(!list.length) toast('判断逻辑把这一轮剔干净了，一条没剩');
    this.show(list, this.rowKeys());
    if(this.hasLog()) GenLog.add(this.R.id, list.join('\n\n——————————\n\n'), this.snapshot());
  }
  /* 记一条当时填了什么，回看记录时能认出是哪一组输入。
     数字指定、文本提取外面包着一层 div，只能按 valueEls 往里面找输入框，不然记下来全是空的 */
  snapshot(){
    const s = {};
    for(const id in this.ctrl) s[id] = this.valueEls(this.ctrl[id].el).map(x => x.value).join(' / ');
    return s;
  }
  /* ---------- 生-19「只换这个」：整页重跑太粗，只想换某一格时按行重掷 ----------
     就着这一轮那份行（this._rows）重新过一次判断流水线：别的格子的随机值吃缓存不重抽，
     只有被点名的这一格真的重新取值。 */
  reroll(k){
    if(!this._rows || !this._rows.length){ this.generate(); return; }
    const list = this.emit(this.judge(this._rows.map(x => {
      if(x.k !== k) return x;
      const nv = this.redraw(x.k);
      return nv === null ? x : Object.assign({}, x, { v:nv });
    })));
    this.show(list, this.rowKeys());
  }
  /* 列表组合那档：把出行的顺序记下来，「只换这个」按行名找产生它的那一格 */
  rowKeys(){
    return (this.R.out && this.R.out.mode === 'list' && this._rows) ? this._rows.map(x => x.k) : [];
  }
  show(list, keys){
    const box = this.outBox;
    box.innerHTML = '';
    if(!list.length){ box.appendChild(h('div', { class:'wnw-card' }, [h('h4', {}, '生成结果'), h('div', { class:'wnw-hint' }, '还没有生成')])); return; }
    const tab = this._tab;
    box.appendChild(h('div', { class:'wnw-row', style:'margin-bottom:8px' }, [
      h('b', {}, '生成结果 · ' + (tab ? tab.rows.length + ' 行 ' + tab.head.length + ' 列' : list.length + ' 条')), h('span', { style:'flex:1' }),
      copyBtn(() => tab ? this.tabText(tab) : list.join('\n\n——————————\n\n'), '复制全部'),
      h('button', { class:'wnw-btn mini', 'data-nodrag':'1', onclick:() => this.generate() }, '再来一轮')]));
    /* 表格那一档整张表一次摆出，「只换这个」是按行摆的按钮，这儿没有一行对一格的说法，就不摆 */
    if(tab && tab.head.length){ box.appendChild(this.tabBox(tab)); return; }
    const klist = keys || [];
    list.forEach((t, k) => box.appendChild(h('div', { class:'wnw-result' }, [
      h('div', { class:'wnw-result-head' }, [h('b', {}, list.length > 1 ? '第 ' + (k + 1) + ' 条' : '结果'), h('span', { style:'flex:1' }),
        /* 只换这一行背后那一格；行名认不出（比如整块输出）就不摆这个按钮 */
        this._rows && klist.length ? h('button', { class:'wnw-btn mini', 'data-nodrag':'1', title:'只重掷这一格产生的那条，别的不重抽',
          onclick:() => this.reroll(klist[Math.min(k, klist.length - 1)]) }, '只换这个') : null,
        copyBtn(() => t)]),
      h('pre', { class:'wnw-out' }, t)])));
  }
}

/* ============================================================
   注册：一张配方 = data\plugins\<id>\ 里的一家插件
   加载器开机按名单 import 这一格里的 main.js（那份就是 export default 这张配方），
   运行时既不 fetch 也不 eval，产物里也不拼它 —— 存进这一格就是新的。
   向导保存写的就是这一格（main.js + recipe.json，新建时连插件清单 manifest.json 一起写）。
   ============================================================ */
function GEN_BANKS(R){
  const out = [];
  if(R.bank) out.push(R.bank);
  const walk = arr => { for(const n of arr || []){ if(n.bank && !out.includes(n.bank)) out.push(n.bank); walk(n.items); } };
  walk(R.ui);
  return out;
}
const Gen = {
  def(R){
    if(!R || !R.id || !R.name){ console.warn('配方少了 id 或 name，跳过'); return null; }
    GEN_DEFS.set(R.id, R);
    const ready = Banks.loadReg().then(() => Promise.all(GEN_BANKS(R).map(n => genBind(n).load().catch(() => null))));
    const info = [R.desc || '按配方生成', genMeta(R)].filter(Boolean).join(' · ');
    registerTool({
      id:R.id, name:R.name, desc:info, icon:R.icon || 'pencil', recipe:R, ready,
      /* 卡片大小清单（#251）写进程序时往配方里插的那段：没插过就是 undefined，照旧吃兜底 16 × 12 */
      card:R.card,
      mount(host){ const v = new GenView(host, R); GEN_VIEWS.push(v); v.boot().then(() => v.paint()); }
    });
    return R;
  },
  get(id){ return GEN_DEFS.get(id); },
  list(){ return [...GEN_DEFS.values()]; },
  /* ---------- 完全删除 ----------
     这一家自己那一格（data\plugins\<id>\ 里的 main.js、recipe.json、插件清单整个文件夹）、
     生成库里它的历次记录、这台机器上的 kv 镜像、名单里它那一格，一样都不留。
     词库问过了才连目录一起删（bank 参数）。 */
  async remove(id, opt){
    const R = this.get(id);
    if(!R) return { ok:false, msg:'没有找到这张配方' };
    const A = H();
    const app = window.FD_APP;
    const files = [];
    const err = [];
    const del = async (rel, rec) => {
      if(!(app && app.delPageFile)) return;
      try{ await app.delPageFile(rel, !!rec); files.push(rel); }
      catch(e){ err.push(rel + '：' + ((e && e.message) || e)); }
    };
    /* 插件那一格：主进程那把尺只按包名动手，跑出 data\plugins\ 的一律删不着 */
    const g = await PackCode.call('delete', { id });
    if(g && g.ok) files.push(...(g.removed || [id + '/']));
    else if(g && g.msg && g.msg !== '这一格本来就不在') err.push(g.msg);
    await del((A.logDir || 'gen-log/') + id + '.json');
    if(opt && opt.bank && R.bank) await Banks.remove(R.bank).then(nm => files.push(nm + '/'), e => err.push('词库：' + ((e && e.message) || e)));
    await A.kv.del('gen-recipe.' + id);
    const ids = ((await A.kv.get('gen-local', [])) || []).filter(x => x !== id);
    await A.kv.put('gen-local', ids);
    /* 名单里也去掉它：留着的话下一轮加载器又把它请回来 */
    const cur = await PackOps.ids();
    if(cur && cur.includes(id)) await PackOps.write(cur.filter(x => x !== id));
    GEN_DEFS.delete(id);
    if(typeof A.unregister === 'function') A.unregister(id);
    return { ok:!err.length, msg:err.join('；'), files:files, wrote:!!(g && g.ok) || !!(app && app.compDelete) };
  }
};
/* 这个功能用的是哪份词库：配方上写的那一份 */
function toolBankWhich(kind){
  const R = typeof Gen !== 'undefined' ? Gen.get(kind) : null;
  return (R && R.bank) ? bankWhich(R.bank) : '';
}
/* 一份词库还被几个组件在用（删词库之前要说清楚，别让别的组件空着） */
function genBankUsers(bankName, exceptId){
  return Gen.list().filter(R => R.id !== exceptId && GEN_BANKS(R).includes(bankName));
}

/* ============================================================
   组件清单的管理动作 · FD「添加插件」和 WNW「打开内容」共用
   隐藏只影响列表，数据一个字不动；删除是完全删除，落到文件上。
   ============================================================ */
async function toolHidden(){ return ((await State.get('tool-hidden', [])) || []).slice(); }
async function toolHide(id, want){
  const list = ((await State.get('tool-hidden', [])) || []).slice();
  const i = list.indexOf(id);
  if(want && i < 0) list.push(id);
  if(!want && i >= 0) list.splice(i, 1);
  await State.set('tool-hidden', list);
}
/* 存完 / 删完怎么让界面跟上：这一家是自己那一格里的文件，加载器 import 它就是新的，
   所以新建和改配方只重载这一家（桌上那张卡、停靠那一条跟着重画）；
   完全删除是整格没了，没法重载，就刷新这一页 —— 和「卸掉一个组件」同一趟。
   两种都不跑「重新生成 Flow-Desk 页面」：那一趟只留给改了 src\ 的情况。 */
async function genApply(id){
  const cur = await PackOps.ids();
  if(cur && !cur.includes(id)){
    const w = await PackOps.write(cur.concat([id]));
    if(!w || w.ok === false) return { ok:false, msg:'名单没写进去：' + ((w && w.msg) || '') };
  }
  const r = await PackLoader.reload(id, { new:true });
  return r && r.ok ? { ok:true, msg:'已经按这一份重载，桌上那张卡跟着重画了' }
    : { ok:true, msg:'文件存好了，可这一家没加载起来：' + ((r && r.msg) || '') + '（改坏了就再存一次，或点「恢复出厂」）' };
}
/* 删除确认：带词库的问一句连不连，顺便报还有几家在用 */
function genDeleteAsk(R, after){
  const users = R.bank ? genBankUsers(R.bank, R.id) : [];
  const cb = h('input', { type:'checkbox' });
  const box = h('div', { class:'wnw-col' });
  box.appendChild(h('div', { class:'wnw-hint' },
    '「' + R.name + '」是组件定制做出来的配方组件。删除是完全删除：这一家跑的代码、配方、插件清单，'
    + '生成库里它的历次记录、插件名单里它那一格，一并抹掉，然后刷新这一页。'));
  if(R.bank && !Banks.isBuiltin(R.bank)){
    const tip = users.length ? '这份词库还有 ' + users.length + ' 个组件在用（' +
      users.map(u => u.name).join('、') + '），删了它们就空了' : '只有这一个组件在用';
    box.appendChild(h('label', { class:'wnw-switch' },
      [cb, h('span', {}, '连词库「' + R.bank + '」一起删 · ' + tip)]));
  } else if(R.bank) box.appendChild(h('div', { class:'wnw-hint' },
    '词库「' + R.bank + '」是自带的模型，删组件不动它。'));
  H().dlg.open('删除组件 · ' + R.name, box, [
    h('button', { class:'wnw-btn primary', onclick:async () => {
      const r = await Gen.remove(R.id, { bank:cb.checked });
      H().dlg.close();
      if(!r.wrote) toast('插件那一格没删掉 · 这一棵里没有「删掉一整格」这条通道');
      else if(!r.ok) toast('删了一部分，剩下的没删掉：' + r.msg);
      else if(PackOps.can()) PackOps.reloadPage('已删除「' + R.name + '」· 这就刷新这一页');
      else toast('已删除「' + R.name + '」');
      if(after) after();
    }}, '完全删除'),
    h('button', { class:'wnw-btn mini', onclick:() => H().dlg.close() }, '取消')
  ]);
}
/* ---------- 一张配方落地：写进这一家自己那一格 ----------
   main.js 是加载器 import 的那一份（里面就是 export default 这张配方），
   recipe.json 是同一张配方的明文（想拿 Notepad++ 直接改配方就改它），
   manifest.json 是插件清单 —— 新建时补一份，之后只跟着配方改名字和简介，
   作者、来源、给谁用这些标记是这一家自己的，向导不替人改。 */
async function genManifestFor(R){
  let m = {};
  const cur = await PackCode.read(R.id, 'manifest.json');
  if(cur && cur.ok){ try{ m = JSON.parse(cur.text || '{}') || {}; }catch(e){ m = {}; } }
  m.id = R.id; m.name = R.name; m.type = 'recipe'; m.desc = R.desc || '';
  m.icon = R.icon || m.icon || 'pencil';
  if(!(m.entry && m.entry.length)) m.entry = ['main.js'];
  if(!(m.host && m.host.length)) m.host = ['fd', 'wnw'];
  if(typeof m.order !== 'number') m.order = 210;
  if(!m.author) m.author = '本地自制';
  if(!m.source) m.source = '组件定制向导';
  if(!m.version) m.version = '1.0.0';
  if(!Array.isArray(m.dataKeys)) m.dataKeys = [];
  if(!Array.isArray(m.kvKeys)) m.kvKeys = [];
  return m;
}
async function genWriteFiles(R){
  const m = await genManifestFor(R);
  const w = await genPackWrite(R, m);
  return w.ok ? { ok:true, file:PackCode.can(), rel:'plugins\\' + R.id + '\\' } : w;
}
/* 这台机器上的那份镜像：那一格写得动的时候它只是备份（真身是 plugins\<id>\ 里那三份）；
   万一这条通道没接上，就当草稿存着，下次开机由 GenLocal 把它装回注册表，界面不至于空着。 */
async function genLocalPut(R){
  const ids = (await H().kv.get('gen-local', [])) || [];
  if(!ids.includes(R.id)) ids.push(R.id);
  await H().kv.put('gen-local', ids);
  await H().kv.put('gen-recipe.' + R.id, JSON.stringify(R));
}
/* 三份文件一份份过那把尺（comp-files.cjs）：包名干净、路径不出这一格 */
async function genPackWrite(R, m){
  const list = [
    { rel:'main.js', text:genSource(R) },
    { rel:'recipe.json', text:JSON.stringify(R, null, 2) + '\n' }
  ];
  if(m) list.push({ rel:'manifest.json', text:JSON.stringify(m, null, 2) + '\n' });
  for(const f of list){
    const r = await PackCode.write(R.id, f.rel, f.text);
    if(!r || r.ok === false) return { ok:false, msg:'写 ' + f.rel + ' 没成：' + ((r && r.msg) || '') };
  }
  return { ok:true };
}
/* FD 这边没有 download()，存成文件这一头自带一份 */
function genDownload(name, text){
  const a = h('a', { href:URL.createObjectURL(new Blob([text], { type:'application/json;charset=utf-8' })), download:name });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
/* 导出：把 plugins\<id>.recipe.json 那一段原样摆出来，复制或存文件随人挑 */
function genExportAsk(R){
  const txt = JSON.stringify(R, null, 2);
  const ed = h('div', { style:'width:100%' });
  H().dlg.open('导出组件 · ' + R.name, h('div', { class:'wnw-col', style:'gap:8px;min-width:min(760px,92vw)' }, [
    h('div', { class:'wnw-hint' }, '就是这一个插件自己那份配方 · 换到另一头用「导入插件」装回来'),
    ed
  ]), [
    copyBtn(() => txt, '复制'),
    h('button', { class:'wnw-btn mini', onclick:() => { genDownload(R.id + '.recipe.json', txt); toast('已存成文件，在下载的地方'); } }, '存成文件'),
    h('button', { class:'wnw-btn primary', onclick:() => H().dlg.close() }, '关闭')
  ], { wide:true, vwide:true });
  ICode.attach(ed, { value:txt, file:R.id + '.json', readonly:true, height:'min(52vh,460px)' });
}
/* 导入：贴 JSON 或者选 .recipe.json 都一样，认完就地装回来 */
function genImportAsk(after){
  const ed = h('div', { style:'width:100%' });
  const over = h('input', { type:'checkbox' });
  const pick = h('input', { type:'file', accept:'.json,application/json', style:'display:none' });
  let api = null;
  pick.addEventListener('change', () => {
    const f = pick.files && pick.files[0];
    if(!f) return;
    const fr = new FileReader();
    fr.onload = () => { if(api) api.set(String(fr.result || '')); toast('读进来了 · 点「导入」装回来'); };
    fr.readAsText(f);
  });
  const box = h('div', { class:'wnw-col', style:'gap:8px;min-width:min(760px,92vw)' }, [
    h('div', { class:'wnw-hint' }, '贴 JSON、或者选一个配方文件 · 导入只装回这一个组件，别的都不动'),
    ed,
    h('label', { class:'wnw-switch' }, [over, h('span', {}, '同 id 的组件直接覆盖')]),
    pick
  ]);
  H().dlg.open('导入插件', box, [
    h('button', { class:'wnw-btn mini', onclick:() => pick.click() }, '选文件'),
    h('button', { class:'wnw-btn primary', onclick:async () => {
      let R;
      try{ R = JSON.parse(api ? api.get() : ''); }catch(e){ toast('这份贴进来的东西读不成 JSON：' + ((e && e.message) || e)); return; }
      const err = genRecipeErr(R);
      if(err){ toast(err); return; }
      if(Gen.get(R.id) && !over.checked){ toast('已经有「' + R.id + '」这个插件 · 要覆盖就勾上那一格'); return; }
      await genLocalPut(R);
      const w = await genWriteFiles(R);
      if(!w.ok){ toast('文件没写进去：' + w.msg); return; }
      if(!w.file){
        /* 写插件那一格那条通道没接上：只能存在这台机器上，页面里当场把这张配方登记回来 */
        Gen.def(R);
        H().dlg.close();
        toast('已导入「' + R.name + '」· 这台机器没有写插件那一格的通道，这份先存在这台机器上');
        if(after) await after();
        await genPendingAsk(genScanRecipe(R, R.name || R.id || '这份配方'));
        return;
      }
      /* 三样都落了盘：名单里补上这一家（新建的才需要），再让加载器只重载这一家 */
      const a = await genApply(R.id);
      H().dlg.close();
      toast('已导入「' + R.name + '」· ' + a.msg);
      if(after) await after();
      await genPendingAsk(genScanRecipe(R, R.name || R.id || '这份配方'));
    }}, '导入'),
    h('button', { class:'wnw-btn mini', onclick:() => H().dlg.close() }, '关闭')
  ], { wide:true, vwide:true });
  api = ICode.attach(ed, { value:'', file:'recipe.json', height:'min(52vh,460px)' });
}
/* id 就是文件名，所以那一关跟向导同一个口径；结构上只认跑得起来的最低那几个字段 */
function genRecipeErr(R){
  if(!R || typeof R !== 'object') return '这份 JSON 得是一个对象';
  if(!GenWizard.okId(R.id)) return 'id 不合规矩：小写字母开头，后面小写字母、数字、- _，2 到 32 位';
  if(!String(R.name || '').trim()) return '这份配方没有名字';
  if(!Array.isArray(R.ui)) return '这份配方里没有功能模块（ui）';
  if(!R.out || (R.out.mode !== 'list' && R.out.mode !== 'text')) return '这份配方里没有输出（out.mode 得是 list 或 text）';
  return null;
}
/* ============================================================
   库里没有的功能模块 / 判断逻辑：扫一遍、问一句、记进 data\lib-pending.json（#298）
   ----------
   向导左边那两张名单（sh-wizard.js 的 GW_FNS、GW_RULES）就是「库」的全部真身，库里没有
   第二份数据 —— 每一条的可执行实现都在代码里（功能模块是 CTL 的那一条方法，判断逻辑是
   JUDGE 或者 GenView 的那一个方法）。所以这一趟只做三件事：
     · 导入配方、导入功能包、改代码存为组件时扫一遍，把陌生的名字连同它在这份组件里带的那一段
       参数、那段代码的原文，记进一份明文清单；
     · 「组件定制」里留一个查看入口，能看、能整份复制走交给 AI 写实现；
     · 等实现真的进了代码（这个版本 CTL 里有了这条方法），清单里那条才允许「导入」成向导可选。
   绝不把清单里的代码当数据塞进解释器跑：配方从头到尾不 eval，这是这个文件头写明的边界。
   ============================================================ */
const PENDING_FILE = 'lib-pending.json';
const PENDING_SNIP = 24;   /* 抄代码片段：命中那一行上下各留这么多行 */

/* 库里现在认得的功能模块名 / 判断逻辑名：那两张名单就是库；向导没拼进来时退回引擎那张 */
function libFnNames(){ return typeof GW_FNS !== 'undefined' ? GW_FNS.map(x => x[0]) : Object.keys(CTL); }
function libRuleNames(){ return typeof GW_RULES !== 'undefined' ? GW_RULES.map(r => r.k) : Object.keys(JUDGE); }
/* 这一条在不在代码里真跑得起来：功能模块看 CTL 有没有这一条方法，判断逻辑看向导那张名单（它两条都登记） */
function libHas(kind, name){
  if(kind === 'fn') return !!(CTL && CTL[name]);
  return libRuleNames().includes(name);
}

/* 一份配方里扫：ui 树上每个控件节点的 fn、rules 里每条的 k
   from 是这份配方的名头（组件叫什么、或哪家功能包），记进清单「出现在」那一行 */
function genScanRecipe(R, from){
  const out = [], knownF = libFnNames(), knownR = libRuleNames();
  const mark = x => { if(from) x.from = String(from); return x; };
  const walk = a => { for(const n of a || []){
    if(n.t === 'ctl' && n.fn && !knownF.includes(n.fn) && !out.some(x => x.kind === 'fn' && x.name === n.fn))
      out.push(mark({ kind:'fn', name:n.fn, title:String(n.name || ''), params:n }));
    walk(n.items);
  } };
  walk(R && R.ui);
  for(const r of (R && R.rules) || [])
    if(r && r.k && !knownR.includes(r.k) && !out.some(x => x.kind === 'rule' && x.name === r.k))
      out.push(mark({ kind:'rule', name:r.k, params:r }));
  return out;
}
/* 一份代码里扫：手写的组件没有配方对象，就认 `fn:'xxx'` / `k:'xxx'` 那两种写法
   （代码里嵌了一份配方也照样认），命中处上下那一小段原文一并抄走当实现线索 */
function genScanCode(text, from, rel){
  const s = String(text || ''), lines = s.split(/\r?\n/), knownF = libFnNames(), knownR = libRuleNames();
  const out = [];
  const snip = idx => {
    let ln = 0; for(let i = 0; i < idx; i++) if(s.charCodeAt(i) === 10) ln++;
    const a = Math.max(0, ln - PENDING_SNIP), b = Math.min(lines.length - 1, ln + PENDING_SNIP);
    return { at:'第 ' + (ln + 1) + ' 行', code:lines.slice(a, b + 1).join('\n').slice(0, 3000), from, rel };
  };
  const take = (re, kind, known) => {
    let m;
    while((m = re.exec(s))){
      const name = m[1];
      if(!name || known.includes(name) || out.some(x => x.kind === kind && x.name === name)) continue;
      out.push(Object.assign({ kind, name, title:'', params:{} }, snip(m.index)));
    }
  };
  take(/fn\s*:\s*['"]([a-z][a-z0-9_-]{1,31})['"]/gi, 'fn', knownF);
  take(/\bk\s*:\s*['"]([a-z][a-z0-9_-]{1,31})['"]/gi, 'rule', knownR);
  return out;
}

/* 清单本身：读一份明文、内存里留一份、写完落回同一个文件 */
const GenPending = {
  items: null,
  async readRaw(){
    const A = window.FD_APP;
    if(A && A.libRead){
      try{ const r = await A.libRead(PENDING_FILE); return (r && r.ok) ? String(r.text || '') : ''; }
      catch(e){ return ''; }
    }
    if(/^https?:$/.test(location.protocol)){
      try{ const r = await fetch('/' + PENDING_FILE, { cache:'no-store' }); return r.ok ? await r.text() : ''; }
      catch(e){ return ''; }
    }
    return String((await H().kv.get('lib-pending', '')) || '');
  },
  async writeRaw(text){
    const A = window.FD_APP;
    if(A && A.libWrite){ try{ return await A.libWrite(PENDING_FILE, text); }catch(e){ return { ok:false, msg:String((e && e.message) || e) }; } }
    if(/^https?:$/.test(location.protocol)){
      try{
        const r = await fetch('/_lib?name=' + encodeURIComponent(PENDING_FILE), { method:'POST', body:text });
        const j = await r.json().catch(() => null);
        return (j && j.ok === false) ? j : { ok:true };
      }catch(e){ return { ok:false, msg:String((e && e.message) || e) }; }
    }
    await H().kv.put('lib-pending', text);
    return { ok:true, local:true };
  },
  async load(){
    if(this.items) return this.items;
    let list = [];
    try{
      const j = JSON.parse(await this.readRaw() || '{"items":[]}');
      if(Array.isArray(j.items)) list = j.items;
    }catch(e){ list = []; }
    this.items = list;
    return list;
  },
  async save(){
    const text = JSON.stringify({ at:new Date().toISOString(), items:this.items || [] }, null, 2) + '\n';
    const r = await this.writeRaw(text);
    return r && r.local ? { ok:true, msg:'这份清单先记在这台机器上' }
      : (r && r.ok ? { ok:true, msg:'已记进待实现清单' } : { ok:false, msg:(r && r.msg) || '清单没写进去' });
  },
  /* 同名同类的只留一条：新扫到的补参数、代码片段和出处，界面上那句中文话和描述以人填过的为准 */
  async merge(found){
    const list = await this.load();
    const fresh = [];
    for(const f of found || []){
      if(!f || !f.kind || !f.name) continue;
      let it = list.find(x => x.kind === f.kind && x.name === f.name);
      if(!it){ it = { kind:f.kind, name:f.name, title:'', desc:'', added:false, froms:[], at:new Date().toISOString() }; list.push(it); fresh.push(it); }
      it.froms = it.froms || [];
      if(f.params) it.params = f.params;
      if(f.code) it.code = f.code;
      if(f.at) it.where = f.at;
      const from = [f.from || '', f.at || ''].filter(x => x).join(' ');
      if(from && !it.froms.includes(from)) it.froms.push(from);
      if(f.title && !it.title) it.title = f.title;
      if(f.desc && !it.desc) it.desc = f.desc;
    }
    this.items = list;
    const r = await this.save();
    return r.ok ? Object.assign(r, { n:fresh.length, total:list.length }) : r;
  },
  async remove(kind, name){
    this.items = (await this.load()).filter(x => !(x.kind === kind && x.name === name));
    return await this.save();
  },
  async set(kind, name, patch){
    const it = (await this.load()).find(x => x.kind === kind && x.name === name);
    if(!it) return { ok:false };
    Object.assign(it, patch || {});
    return await this.save();
  },
  /* 别处那份清单并进本机：同一个 kind+name 已经有的不动，免得把人在界面上填过的描述盖掉 */
  async absorb(text){
    let j = null;
    try{ j = JSON.parse(String(text || '')); }catch(e){ return { ok:false, msg:'那份文件读不成 JSON' }; }
    const inl = j && Array.isArray(j.items) ? j.items : null;
    if(!inl) return { ok:false, msg:'那份文件里没有 items 那一段' };
    const list = await this.load();
    let n = 0;
    for(const it of inl){
      if(!it || !it.kind || !it.name) continue;
      if(list.some(x => x.kind === it.kind && x.name === it.name)) continue;
      list.push(it); n++;
    }
    this.items = list;
    const r = await this.save();
    return r.ok ? { ok:true, n } : r;
  }
};
/* 交给 AI 的那一份文本：名字、界面上叫什么、功能描述、配方里那一段参数、代码片段、出现在哪儿，一段段拼好 */
function pendingOne(it){
  let s = '【' + (it.kind === 'fn' ? '功能模块' : '判断逻辑') + '】' + it.name;
  if(it.title) s += '　界面上叫：' + it.title;
  if(it.desc) s += '\n功能描述：' + it.desc;
  if(it.froms && it.froms.length) s += '\n出现在：' + it.froms.join('、');
  s += '\n这个版本里的实现：' + (libHas(it.kind, it.name) ? '已经有了（在代码里能查到）' : '还没有，要照着下面这些写进去');
  if(it.params) s += '\n它在这份组件里带的那些参数：\n' + JSON.stringify(it.params, null, 2);
  if(it.code) s += '\n插件代码里那一段原文（命中那一行上下各 ' + PENDING_SNIP + ' 行）：\n' + it.code;
  return s;
}
function pendingBrief(list){
  return '这些是组件里用到、但「组件定制」的功能模块 / 判断逻辑库里没有的类型。\n'
    + '请照 Ant Design 那种控件的交互自己写一个实现：功能模块写进 src\\_shared\\sh-gen.js 的 CTL 那张表（建界面 + parts 出值），'
    + '判断逻辑写进同一份文件的 JUDGE 或 GenView 的方法；两边都要在 src\\_shared\\sh-wizard.js 登记'
    + '（功能模块：GW_FNS、GW_T0、GW_NEW、GW_KEYS、控件参数编辑器那串 case；判断逻辑：GW_RULES），'
    + '改完 src\\ 要重新生成页面才看得见。\n\n'
    + (list || []).map(pendingOne).join('\n\n——————————\n\n');
}
/* 扫出东西就问一句（一条没扫到就什么都不发生，不打扰） */
async function genPendingAsk(found, after){
  found = (found || []).filter(x => x && x.name);
  if(!found.length) return false;
  const ck = [], tIn = [], dIn = [];
  found.forEach((f, i) => {
    ck.push(h('input', { type:'checkbox', checked:true }));
    tIn.push(h('input', { class:'wnw-input', value:f.title || '', placeholder:'界面上叫什么（比如「多选」）', style:'flex:1 1 10em' }));
    dIn.push(h('input', { class:'wnw-input', value:f.desc || '', placeholder:'它干什么用（一句就够，写给以后看的人）', style:'flex:2 1 18em' }));
  });
  const rows = found.map((f, i) => h('div', { class:'wnw-col', style:'gap:6px;padding:6px 0;border-top:var(--hair)' }, [
    h('div', { class:'wnw-row', style:'gap:8px;align-items:center' }, [
      h('label', { class:'wnw-switch', style:'gap:6px' }, [ck[i], h('span', {}, (f.kind === 'fn' ? '功能模块 ' : '判断逻辑 ') + f.name)]),
      h('span', { class:'wnw-hint' }, [f.from || '来自这张配方', f.at ? ' · ' + f.at : ''].join(''))]),
    h('div', { class:'wnw-row', style:'gap:8px' }, [tIn[i], dIn[i]])
  ]));
  const box = h('div', { class:'wnw-col', style:'gap:8px;min-width:min(760px,92vw)' }, [
    h('div', { class:'wnw-hint' }, '这份组件用到了库里没有的类型。勾上的提取进待实现清单：名字、功能描述、'
      + '它在这份组件里带的那一段参数和代码原文一起记进去。复制这份清单交给 AI 就能写出干净的新实现；'
      + '实现进了代码之后，在「组件定制」的功能模块 / 判断逻辑那一块点导入，它就成可选的一项。'),
    ...rows
  ]);
  return await new Promise(done => {
    H().dlg.open('库里没有的功能模块 / 判断逻辑', box, [
      h('button', { class:'wnw-btn primary', onclick:async () => {
        const pick = [];
        found.forEach((f, i) => { if(ck[i].checked) pick.push(Object.assign({}, f, { title:String(tIn[i].value || '').trim(), desc:String(dIn[i].value || '').trim() })); });
        if(!pick.length){ H().dlg.close(); done(false); return; }
        const r = await GenPending.merge(pick);
        H().dlg.close();
        toast(r.ok ? '已提取进清单（' + r.total + ' 条）· ' + r.msg : r.msg);
        if(after) await after();
        done(true);
      }}, '提取进清单'),
      h('button', { class:'wnw-btn mini', onclick:() => { H().dlg.close(); done(false); } }, '先不提取')
    ], { wide:true, vwide:true });
  });
}
/* 一份功能包落盘之后扫它自己那一格：配方那份 json 优先，没有配方就读入口那一份代码 */
async function genPendingScanPack(id){
  const from = String(id || '');
  let out = [];
  try{
    const j = await PackCode.read(from, 'recipe.json');
    if(j && j.ok && j.text){
      let R = null;
      try{ R = JSON.parse(j.text); }catch(e){ R = null; }
      if(R && Array.isArray(R.ui)){ out = genScanRecipe(R); out.forEach(x => { x.from = from; x.rel = 'recipe.json'; }); return out; }
    }
  }catch(e){}
  try{
    const rel = PackCode.entry(from);
    const c = await PackCode.read(from, rel);
    if(c && c.ok) out = genScanCode(c.text, from, rel);
  }catch(e){}
  return out;
}

const GEN_VIEWS = [];
const GEN_BOUND = new Set();
/* 词库编辑器一保存：先让实例重新取文重解析，解析完再重画，选项不会拿到旧的一套。
   重画只处理还挂在页面上的，顺手把卸掉的摘下来。 */
function genPaint(){
  for(let i = GEN_VIEWS.length - 1; i >= 0; i--)
    if(GEN_VIEWS[i].host && GEN_VIEWS[i].host.isConnected) GEN_VIEWS[i].paint();
    else GEN_VIEWS.splice(i, 1);
}
function genBind(name){
  const b = genBank(name);
  if(GEN_BOUND.has(b.which)) return b;
  GEN_BOUND.add(b.which);
  Banks.bind(b);
  Bus.on('bank:' + b.which, genPaint);
  return b;
}
