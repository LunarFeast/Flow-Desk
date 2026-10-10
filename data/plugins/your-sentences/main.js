/* ---------- 你的句子：行1 钉住的那句（属性，不入库），行2 输入框 + 随机 ----------
   ES module：宿主的一切从 ctx 拿；mount 收到的是宿主挂载上下文和 init 那份组件上下文
   并好的同一份，⛶ 封面那条路也照样并一次。 */
let P = null;

/* 删之前那一句问的是宿主给的 C.ask（框由 Flow-Desk 搭，✕ 和「取消」都算不删） */

/* 金句的完整版：⛶ 封面和展开卡共用这一份 */
async function sentencesFullNode(C){
  const h = C.el;
  const data = await C.store.loadJSON('your-sentences.json', { pinned:'', items:[], cur:-1 });
  if(!Array.isArray(data.items)) data.items = [];
  if(typeof data.pinned !== 'string') data.pinned = '';
  const save = () => C.store.saveJSON('your-sentences.json', data);
  const host = h('div', { style:C.fullStyle });
  const scroll = h('div', { class:'scroll-y', style:'flex:1;min-height:0' });
  const pin = h('input', { class:'fd-input', value:data.pinned || '', placeholder:'钉住的那句' });
  pin.addEventListener('change', () => { data.pinned = pin.value.trim(); save(); C.bus.emit('your-sentences'); });
  scroll.appendChild(h('div', { class:'fd-hint' }, '钉住的话'));
  scroll.appendChild(pin);
  scroll.appendChild(h('div', { class:'fd-hint', style:'margin-top:10px' }, '句子库'));
  const list = h('div', { style:'display:grid;gap:8px;margin-top:2px' });
  const draw = () => {
    list.innerHTML = '';
    if(!data.items.length){ list.appendChild(h('div', { class:'fd-hint' }, '还没有存任何句子')); return; }
    data.items.forEach((s, i) => {
      const inp = h('input', { class:'fd-input', value:s.text });
      inp.addEventListener('change', () => { s.text = inp.value.trim(); save(); C.bus.emit('your-sentences'); });
      list.appendChild(h('div', { class:'fd-row' }, [
        h('span', { class:'fd-hint', style:'width:2.4em' }, String(i + 1)), inp,
        h('button', { class:'fd-btn mini', onclick:() => { data.cur = i; save(); C.bus.emit('your-sentences'); C.toast('已设为当前句'); } }, '设为当前'),
        h('button', { class:'fd-btn mini', onclick:() => { data.pinned = s.text; pin.value = s.text; save(); C.bus.emit('your-sentences'); C.toast('已钉到第一行'); } }, '钉到第一行'),
        h('button', { class:'fd-btn mini danger', onclick:async () => {
          const shown = (s.text || '（这一句还空着）').replace(/\s+/g, ' ');
          if(!await C.ask('删掉这一句？\n「' + (shown.length > 30 ? shown.slice(0, 30) + '…' : shown) + '」句子库存过就没有回收站，删了捞不回来。', '删除')) return;
          data.items.splice(i, 1); if(data.cur >= i) data.cur = data.cur - 1;
          save(); C.bus.emit('your-sentences'); draw();
        }}, '删除')]));
    });
  };
  const onBus = () => { draw(); pin.value = data.pinned || ''; };
  draw();
  scroll.appendChild(list);
  scroll.appendChild(h('button', { class:'fd-btn mini', style:'justify-self:start;margin-top:6px', onclick:() => {
    data.items.push({ id:'y' + Date.now().toString(36), text:'', at:Date.now() });
    save(); C.bus.emit('your-sentences');
  }, html:C.icon('plus') + ' 加一句' }));
  host.appendChild(scroll);
  C.bus.on('your-sentences', onBus);
  return { node:host, dispose(){ C.bus.map['your-sentences'] = (C.bus.map['your-sentences'] || []).filter(f => f !== onBus); } };
}

async function openYsFull(C){
  const f = await sentencesFullNode(C);
  /* 封面那一行的标题不在这儿抄一遍名字：包叫什么，封面就写什么 */
  C.cover.openNode(C.pack.name, C.coverWrap(f.node), () => { f.dispose(); C.bus.emit('your-sentences'); });
}

export default {
  noTitle:true, minW:3, minH:2, def:{ w:5, h:2 },
  init(ctx){ P = ctx; },
  expand(ctx){ openYsFull(Object.assign({}, ctx, P)); },
  async mount(body, ctx){
    const C = Object.assign({}, ctx, P);
    if(C.expanded){
      const f = await sentencesFullNode(C);
      body.appendChild(f.node);
      return { unmount:f.dispose };
    }
    const h = C.el;
    const data = await C.store.loadJSON('your-sentences.json', { pinned:'', items:[], cur:-1 });
    if(!Array.isArray(data.items)) data.items = [];
    if(typeof data.pinned !== 'string') data.pinned = '';
    const save = () => C.store.saveJSON('your-sentences.json', data);
    const wrap = h('div', { style:'display:flex;flex-direction:column;height:100%;gap:6px;padding:6px var(--pad) 8px;' });
    /* 行1 */
    const line1 = h('div', { title:'点击修改这句', 'data-nodrag':'1',
      style:'flex:0 0 auto;min-height:1.6em;font-weight:700;line-height:1.5;cursor:text;border-bottom:var(--hair);padding-bottom:4px;' });
    const drawLine1 = () => {
      line1.innerHTML = '';
      line1.appendChild(h('span', { style:data.pinned ? '' : 'color:var(--text-light);font-weight:400' },
        data.pinned || '点这里写一句钉住的话'));
    };
    line1.onclick = () => {
      const inp = h('input', { class:'fd-input', style:'font-weight:700' }); inp.value = data.pinned;
      line1.innerHTML = ''; line1.appendChild(inp); inp.focus(); inp.select();
      const done = () => { data.pinned = inp.value.trim(); drawLine1(); save(); };
      inp.addEventListener('blur', done);
      inp.addEventListener('keydown', e => { if(e.isComposing || e.keyCode === 229) return; if(e.key === 'Enter'){ e.preventDefault(); inp.blur(); } });
    };
    /* 行2 */
    const inp = h('input', { class:'fd-input', 'data-nodrag':'1', placeholder:'输入一句，回车存入句子库',
      style:'flex:1;min-width:0;border-radius:var(--r-pill,5px);padding:4px 12px;white-space:nowrap;overflow-x:auto;' });
    const rnd = h('button', { class:'fd-btn', 'data-nodrag':'1', title:'从写过的句子里随机一句', style:'flex:0 0 auto;padding:4px 10px' }, '随机');
    drawLine1();
    const curText = () => (data.items[data.cur] && data.items[data.cur].text) || '';
    inp.value = curText();
    inp.addEventListener('keydown', e => {
      if(e.isComposing || e.keyCode === 229) return;
      if(e.key !== 'Enter') return;
      const t = inp.value.trim(); if(!t) return;
      let i = data.items.findIndex(x => x.text === t);
      if(i < 0){ data.items.push({ id:'y' + Date.now().toString(36), text:t, at:Date.now() }); i = data.items.length - 1; }
      data.cur = i; inp.value = data.items[i].text; save(); C.bus.emit('your-sentences');
    });
    inp.addEventListener('blur', () => {
      const t = inp.value.trim();
      if(t && data.cur >= 0 && data.items[data.cur] && data.items[data.cur].text !== t){
        data.items[data.cur].text = t; save(); C.bus.emit('your-sentences');
      }
    });
    rnd.onclick = () => {
      if(!data.items.length){ C.toast('还没有句子，先写一句'); return; }
      let i = data.cur;
      if(data.items.length > 1) while(i === data.cur) i = Math.floor(Math.random() * data.items.length);
      data.cur = i; inp.value = data.items[i].text; save();
    };
    wrap.appendChild(line1);
    wrap.appendChild(h('div', { class:'fd-row', style:'flex:1;gap:6px' }, [inp, rnd]));
    body.appendChild(wrap);
    const view = () => { drawLine1(); inp.value = curText(); };
    C.bus.on('your-sentences', view);
    return { unmount(){ C.bus.map['your-sentences'] = (C.bus.map['your-sentences'] || []).filter(f => f !== view); } };
  }
};
