/* ============================================================
   一页明文文档（markdown）铺进页面 —— 那几份固定文档（用户数据详单那一类）共用这一台小机器
   （第 23 条的「用户数据详单」是头一个用的）。
   认的记号只有这么几个：# / ## 两级标题、"- " 列表（行首两个空格算深一级）、
   **粗**、`码`、``` 围起来的代码块（块里原样摆，连缩进都不动）、空行分段；其余一律当普通段落。
   全程 textNode 摆出来，文档里就算写了 <script> 也只是几个字，不执行它带的任何东西。
   样式全挂 CSS 变量，所以同一份文档在 FD 和 WNW 里跟着各自的配色走。
   ============================================================ */
const DocMd = {
  css(){
    if(document.getElementById('sh-doc-style')) return;
    const st = document.createElement('style');
    st.id = 'sh-doc-style';
    st.textContent =
      /* 版心跟着这一格有多宽走，不再钉死 74ch：这一页铺满整个封面，74ch 只占掉左半条，
         右边一大片是空的（第 7 条问的就是这个）。上限 96ch 是不让一行长到眼睛找不回下一行开头；
         多出来的宽度用左右内边距两边各分一半，滚动条还贴在格子边上，不会跑到版面中间。 */
      '.shdoc{height:100%;overflow:auto;color:var(--text);font-size:1rem;line-height:1.9;' +
      'padding:22px max(26px, calc((100% - 96ch) / 2))}' +
      '.shdoc h1{font-size:1.4em;margin:0 0 10px}' +
      /* 二级标题顶上那道是分隔线，走外观层的 --hair（外框那两档会收成 0，见 sh-look.js 里那一段） */
      '.shdoc h2{font-size:1.12em;margin:20px 0 6px;padding-top:10px;border-top:var(--hair)}' +
      '.shdoc p{margin:8px 0}' +
      '.shdoc ul{list-style:none;margin:4px 0;padding-left:0}' +
      '.shdoc li{margin:2px 0;padding-left:1.1em;position:relative}' +
      '.shdoc li:before{content:"·";position:absolute;left:.2em;color:var(--text-light)}' +
      '.shdoc li.lv2{padding-left:2.4em;font-size:.95em}' +
      '.shdoc li.lv2:before{left:1.4em}' +
      '.shdoc code{font-family:ui-monospace,Consolas,monospace;background:var(--candidate-bg,transparent);' +
      'border:1px solid var(--hair-color);border-radius:var(--r-btn,5px);padding:0 4px}' +
      '.shdoc pre{font-family:ui-monospace,Consolas,monospace;background:var(--candidate-bg,transparent);' +
      'border:1px solid var(--hair-color);border-radius:var(--r-card,5px);padding:10px 14px;margin:8px 0;' +
      'white-space:pre-wrap;word-break:break-all;font-size:.92em;line-height:1.7}' +
      '.shdoc b{font-weight:700}';
    document.head.appendChild(st);
  },
  /* 行内：先切 **粗**，再在剩下的碎片里切 `码`；碎片本身走 textNode */
  inline(s, into){
    const parts = String(s).split('**');
    for(let i = 0; i < parts.length; i++){
      if(!parts[i]) continue;
      if(i % 2 === 1){ into(document.createElement('b')).textContent = parts[i]; continue; }
      const bits = parts[i].split('`');
      for(let j = 0; j < bits.length; j++){
        if(!bits[j]) continue;
        if(j % 2 === 1){ into(document.createElement('code')).textContent = bits[j]; continue; }
        into(document.createTextNode(bits[j]));
      }
    }
  },
  nodes(txt){
    const out = [];
    const box = n => { out.push(n); return n; };
    let ul = null;
    let code = null;    /* ``` 围栏代码块：在攒的行缓冲区，null 表示不在块里 */
    for(const raw of String(txt || '').replace(/\r\n/g, '\n').split('\n')){
      const line = raw.replace(/\s+$/, '');
      if(/^```/.test(line.trim())){
        if(code === null) code = [];                              /* 进门：开始攒 */
        else { box(document.createElement('pre')).textContent = code.join('\n'); code = null; }  /* 出门：整块落地，原样文本 */
        ul = null;
        continue;
      }
      if(code !== null){ code.push(raw.replace(/\r$/, '')); continue; }  /* 块里的行一个字不改 */
      if(!line.trim()){ ul = null; continue; }
      if(/^###\s+/.test(line) || /^##\s+/.test(line)){ ul = null; box(document.createElement('h2')).textContent = line.replace(/^#+\s+/, ''); continue; }
      if(/^#\s+/.test(line)){ ul = null; box(document.createElement('h1')).textContent = line.replace(/^#\s+/, ''); continue; }
      const m = line.match(/^(\s*)-\s+(.*)$/);
      if(m){
        if(!ul){ ul = document.createElement('ul'); box(ul); }
        const li = document.createElement('li');
        if(m[1].length >= 2) li.className = 'lv2';
        this.inline(m[2], n => li.appendChild(n));
        ul.appendChild(li);
        continue;
      }
      ul = null;
      const p = box(document.createElement('p'));
      this.inline(line.trim(), n => p.appendChild(n));
    }
    /* 文档末尾忘了关围栏：照样把攒下的内容摆出来，不吞字 */
    if(code !== null) box(document.createElement('pre')).textContent = code.join('\n');
    return out;
  },
  mount(host, txt){
    this.css();
    host.innerHTML = '';
    host.className = (host.className ? host.className + ' ' : '') + 'shdoc';
    for(const n of this.nodes(txt)) host.appendChild(n);
    return host;
  }
};
