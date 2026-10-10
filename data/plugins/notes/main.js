/* ---------- 便签：行1 标题（卡片头常驻）、行2 已有便签吃掉剩余、行3 输入框 ----------
   ES module 一份定义：宿主的 h / Store / Modal / Bus / Cover 全从 ctx 拿。
   挂载时加载器把宿主那份 mctx 和 init 收到的组件上下文 P 并成一份传进 mount，
   展开（⛶ 封面）走的是 P 那一份，调用前也照样并一次，组件里只管用同一套名字。 */
let P = null;

/* 便签的视图开关记在模块里：封面和展开卡共用一份，切归档不用来回传 */
const NotesView = { archived:false };

/* 删之前那一句问的是宿主给的 C.ask（框由 Flow-Desk 搭，✕ 和「取消」都算不删，
   确认框套在已经开着的编辑框上面是允许的 —— 底下那层收进栈，取消就还回那一张）。 */
/* 问句里把这条便签的头几个字报出来：一整段正文塞进确认框读不完 */
function brief(t){
  const s = String(t || '（这条还空着）').replace(/\s+/g, ' ');
  return s.length > 26 ? s.slice(0, 26) + '…' : s;
}

function editNote(C, data, save, n){
  const h = C.el;
  const ta = h('textarea', { class:'fd-input', rows:'6' }); ta.value = n.text;
  const ckb = h('input', { type:'checkbox' }); ckb.checked = !!n.done;
  C.dialog.open('编辑便签', h('div', { style:'display:grid;gap:10px;min-width:min(460px,86vw)' }, [ta,
    h('label', { class:'fd-hint', style:'display:flex;gap:6px;align-items:center' }, [ckb, '完成'])]), [
    h('button', { class:'fd-btn danger', onclick:async () => {
      if(!await C.ask('删掉正在编辑的这条便签？\n「' + brief(n.text) + '」这一条整个划掉，归档里也没有它。', '删除')) return;
      data.items = data.items.filter(x => x.id !== n.id); save(); C.dialog.close(); C.bus.emit('notes');
    }}, '删除'),
    h('span', { style:'flex:1' }),
    h('button', { class:'fd-btn', onclick:() => C.dialog.close() }, '取消'),
    h('button', { class:'fd-btn primary', onclick:() => {
      n.text = ta.value.trim() || n.text; n.done = ckb.checked; n.at = Date.now();
      save(); C.dialog.close(); C.bus.emit('notes');
    }}, '保存')
  ]);
  setTimeout(() => ta.focus(), 30);
}

/* 便签的完整版：⛶ 封面和展开卡共用这一份 */
async function notesFullNode(C){
  const h = C.el;
  const data = await C.store.loadJSON('notes.json', { items:[] });
  if(!Array.isArray(data.items)) data.items = [];
  const host = h('div', { style:C.fullStyle });
  const head = h('div', { class:'fd-row' });
  const listBox = h('div', { style:'flex:1;min-height:0;overflow:auto' });
  const drawHead = () => {
    head.innerHTML = '';
    head.appendChild(h('b', {}, NotesView.archived ? '归档便签' : '全部便签'));
    head.appendChild(h('span', { style:'flex:1' }));
    head.appendChild(h('button', { class:'fd-btn mini', onclick:() => { NotesView.archived = !NotesView.archived; drawHead(); draw(); } },
      NotesView.archived ? '看未归档' : '看归档'));
    head.appendChild(h('button', { class:'fd-btn mini primary', onclick:() => {
      data.items.push({ id:'n' + Date.now().toString(36), text:'', at:Date.now(), slot:data.items.length % 5 });
      C.store.saveJSON('notes.json', data); C.bus.emit('notes'); drawHead(); draw();
      const ta = listBox.querySelector('textarea'); if(ta) ta.focus();
    }, html:C.icon('plus') + ' 新建' }));
  };
  const draw = () => {
    listBox.innerHTML = '';
    const items = data.items.filter(n => !!n.archived === NotesView.archived).sort((a,b) => b.at - a.at);
    if(!items.length){ listBox.appendChild(h('div', { class:'fd-empty' }, NotesView.archived ? '没有归档便签' : '还没有便签，点右上「新建」')); return; }
    const grid = h('div', { style:'display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px' });
    for(const n of items){
      /* 这块小卡挂 data-look 进外观层的表面名单：底色不能再自己铺（自己铺的那一层压在
         外观层算完的那块面底下，看着永远是没掺过墨的原卡），边框和圆角留下 ——
         边框跟着外观模式那档的粗细走。左边那道 4px 是色位，属于「这张便签归哪一色」
         的状态，不走外观层。 */
      const slot = 'var(--slot-' + ((n.slot||0)%5+1) + '-dot,var(--slot-' + ((n.slot||0)%5+1) + '))';
      const card = h('div', { 'data-look':'', style:'border:var(--bw) solid var(--card-border);border-left:4px solid ' + slot +
        ';border-radius:var(--r-card,5px);padding:10px 12px;display:flex;flex-direction:column;gap:8px' });
      const ta = h('textarea', { class:'fd-input', rows:'4', placeholder:'写点什么…', style:'border:0;background:transparent;padding:0' }); ta.value = n.text;
      ta.style.textDecoration = n.done ? 'line-through' : 'none';
      const doneCb = h('input', { type:'checkbox' }); doneCb.checked = !!n.done;
      doneCb.onchange = () => { n.done = doneCb.checked; ta.style.textDecoration = n.done ? 'line-through' : 'none'; C.store.saveJSON('notes.json', data); C.bus.emit('notes'); };
      const saveText = () => { if(ta.value.trim() !== n.text){ n.text = ta.value.trim(); n.at = Date.now(); C.store.saveJSON('notes.json', data); C.bus.emit('notes'); } };
      ta.addEventListener('blur', saveText);
      ta.addEventListener('keydown', e => { if(e.isComposing || e.keyCode === 229) return; if(e.key === 'Enter' && e.ctrlKey){ e.preventDefault(); saveText(); ta.blur(); } });
      card.appendChild(ta);
      card.appendChild(h('div', { class:'fd-hint' }, new Date(n.at).toLocaleString('zh-CN')));
      card.appendChild(h('div', { class:'fd-row' }, [
        h('label', { class:'fd-hint', style:'display:flex;gap:5px;align-items:center' }, [doneCb, '完成']),
        h('span', { style:'flex:1' }),
        h('button', { class:'fd-tool', onclick:() => { n.archived = !NotesView.archived; C.store.saveJSON('notes.json', data); C.bus.emit('notes'); draw(); } }, NotesView.archived ? '放回' : '归档'),
        h('button', { class:'fd-tool', onclick:async () => {
          if(!await C.ask('删掉这条便签「' + brief(n.text) + '」？这一家没留回收站，划掉的捞不回来。', '删除')) return;
          data.items = data.items.filter(x => x.id !== n.id); C.store.saveJSON('notes.json', data); C.bus.emit('notes'); draw();
        }}, '删除')]));
      grid.appendChild(card);
    }
    listBox.appendChild(grid);
  };
  const onBus = () => { draw(); };
  host.appendChild(head); host.appendChild(listBox);
  C.bus.on('notes', onBus);
  drawHead(); draw();
  return { node:host, dispose(){ C.bus.map['notes'] = (C.bus.map['notes'] || []).filter(f => f !== onBus); } };
}

async function openNotesFull(C){
  const f = await notesFullNode(C);
  /* 封面那一行的标题不在这儿抄一遍名字：包叫什么，封面就写什么 */
  C.cover.openNode(C.pack.name, C.coverWrap(f.node), () => { f.dispose(); C.bus.emit('notes'); });
}

export default {
  noName:true, minW:3, minH:3, def:{ w:5, h:3 },
  init(ctx){ P = ctx; },
  expand(ctx){ openNotesFull(Object.assign({}, ctx, P)); },
  async mount(body, ctx){
    const C = Object.assign({}, ctx, P);
    if(C.expanded){
      const f = await notesFullNode(C);
      body.appendChild(f.node);
      return { unmount:f.dispose };
    }
    const h = C.el;
    const data = await C.store.loadJSON('notes.json', { items:[] });
    if(!Array.isArray(data.items)) data.items = [];
    const listBox = h('div', { class:'fd-fit', style:'flex:1 1 0px;' });
    const quick = h('input', { class:'fd-input', placeholder:'随心所记，回车保存', style:'flex:0 0 auto;margin:6px 0 8px;' });
    body.appendChild(listBox); body.appendChild(quick);
    const save = () => C.store.saveJSON('notes.json', data);
    const view = () => {
      const items = data.items.filter(n => !n.archived).sort((a,b) => b.at - a.at);
      listBox.innerHTML = '';
      if(!items.length) listBox.appendChild(h('div', { class:'fd-empty' }, '还没有便签'));
      for(const n of items){
        const row = h('div', { style:'display:flex;gap:6px;align-items:flex-start;padding:5px 0;border-bottom:var(--hair);cursor:pointer;' }, [
          h('span', { class:'fd-swatch', style:'width:8px;height:8px;border-radius:50%;border:0;margin-top:5px;background:var(--slot-' + ((n.slot||0)%5+1) + '-dot,var(--slot-' + ((n.slot||0)%5+1) + '))' }),
          h('div', { style:'flex:1;min-width:0;' }, [
            h('div', { style:'line-height:1.5;white-space:pre-wrap;word-break:break-word;' + (n.done ? 'text-decoration:line-through;color:var(--text-light);' : '') }, n.text),
            h('div', { class:'fd-hint', style:'font-size:.75em' }, new Date(n.at).toLocaleString('zh-CN', { month:'numeric', day:'numeric', hour:'numeric', minute:'numeric' }))
          ])]);
        row.onclick = () => editNote(C, data, save, n);
        listBox.appendChild(row);
      }
      /* F2：卡内不滚动，便签多了整体缩，缩到 9px 还塞不下就截断 */
      C.fitBox(listBox);
    };
    C.bus.on('notes', view);
    view();
    quick.addEventListener('keydown', e => {
      if(e.isComposing || e.keyCode === 229) return;
      if(e.key !== 'Enter' || !quick.value.trim()) return;
      data.items.push({ id:'n' + Date.now().toString(36), text:quick.value.trim(), at:Date.now(), slot:data.items.length % 5 });
      quick.value = ''; save(); C.bus.emit('notes');
    });
    return { unmount(){ C.bus.map['notes'] = (C.bus.map['notes'] || []).filter(f => f !== view); } };
  }
};
