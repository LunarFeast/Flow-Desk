/* ============================================================
   内置代码编辑器（第 11 项）
   改代码、组件定制右边那一栏源码、导出那一份 JSON —— 看代码的三处用的是同一个：
   行号、按语言着色、能折叠、Ctrl+F 就地搜和替换。
   底下跑的是 CodeMirror 5：打包好的运行时和样式由构建打进 window.ICODE_SRC，
   这一份只负责第一次真用到时把它们塞进页面（启动那一下不替它掏这 290KB），
   再把界面文案换成中文、把配色接到宿主那一套 token 上。
   ============================================================ */

const ICode = {
  booted:false,
  failed:false,
  /* 开着的编辑器都记这儿：换配色时叫它们重新认一次明暗，不用重建 */
  live:[],

  /* ---------- 装载：一次就够 ---------- */
  ensure(){
    if(this.booted) return true;
    if(this.failed) return false;
    const S = window.ICODE_SRC;
    if(!S || !S.js){ this.failed = true; return false; }
    if(S.css && !document.getElementById('icode-css')){
      const st = document.createElement('style');
      st.id = 'icode-css'; st.textContent = S.css;
      document.head.appendChild(st);
    }
    const sc = document.createElement('script');
    sc.textContent = S.js;
    document.head.appendChild(sc);
    this.booted = !!window.CodeMirror;
    if(!this.booted) this.failed = true;
    return this.booted;
  },

  /* ---------- 界面文案：编辑器里冒出来的英文在这儿翻 ---------- */
  phrases(){
    return {
      'Search:':'查找：', 'With:':'换成：', 'Replace?':'替换吗？',
      'Replace:':'替换：', 'Replace all:':'全部替换：', 'Replace with:':'换成：',
      'Yes':'就换这处', 'No':'跳过', 'All':'全都换', 'Stop':'停下',
      '(Use /re/ syntax for regexp search)':'（写成 /re/ 就是正则）',
      'Jump to line:':'跳到第几行：',
      '(Use line:column or scroll% syntax)':'（可以写 行:列 或 百分比）'
    };
  },

  /* ---------- 认语言：按文件名后缀，认不出就纯文本 ---------- */
  modeOf(name){
    const n = String(name || '').toLowerCase();
    if(/\.json$/.test(n)) return { name:'javascript', json:true };
    if(/\.js$|\.cjs$|\.mjs$/.test(n)) return 'javascript';
    if(/\.css$/.test(n)) return 'css';
    if(/\.html?$|\.xml$|\.ttml$/.test(n)) return 'xml';
    return null;
  },

  /* ---------- 明还是暗：量卡面亮度，不猜配色名字 ---------- */
  tone(){
    try{
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--card-bg').trim();
      if(bg && typeof CV !== 'undefined') return CV.lum(bg) < .45 ? 'icode-dark' : 'icode-light';
    }catch(e){}
    return 'icode-light';
  },

  /* 换配色后叫所有还开着的编辑器重挂明暗：着色两组都在容器上，改一个类就够 */
  retone(){
    this.live = this.live.filter(a => a.el.isConnected);
    this.live.forEach(a => { try{ a.tone(); }catch(e){} });
  },

  /* ---------- 挂一个编辑器 ----------
     host 得已经连在文档上；还没连上就等它连上（对话框都是先建节点再 open）。
     opt: { value, file, mode, readonly, height, onChange, autofocus }
     → { get(), set(text), focus(), tone(), el, cm } */
  attach(host, opt){
    opt = opt || {};
    const self = this;
    const box = h('div', { class:'icode ' + this.tone() + (opt.readonly ? ' icode-readonly' : ''),
      style:'height:' + (opt.height || 'min(58vh,540px)') + ';min-height:120px;' });
    host.appendChild(box);
    let host2 = box;
    const api = {
      el:box, cm:null,
      get(){ return api.cm ? api.cm.getValue() : (api.text || opt.value || ''); },
      set(t){ api.text = t; if(api.cm) api.cm.setValue(t); else if(api.ta) api.ta.value = t; },
      focus(){ if(api.cm) api.cm.focus(); else if(api.ta) api.ta.focus(); },
      tone(){ host2.classList.remove('icode-dark','icode-light'); host2.classList.add(self.tone()); }
    };
    const go = () => {
      if(!self.ensure()){
        /* 这一份产物里没打进运行时（旧页面 / 手工裁过的产物）：退回普通文本框，别留白 */
        const ta = h('textarea', { class:'wnw-input gw-src', spellcheck:'false',
          readonly:!!opt.readonly, style:'width:100%;height:100%;resize:none;' });
        ta.value = opt.value || '';
        api.ta = ta;
        box.replaceWith(ta); host2 = ta;
        api.get = () => ta.value;
        api.set = t => { ta.value = t; };
        api.focus = () => ta.focus();
        api.tone = () => {};
        return;
      }
      const cm = window.CodeMirror(box, {
        value:opt.value || '',
        mode:opt.mode === undefined ? self.modeOf(opt.file) : opt.mode,
        lineNumbers:true, lineWrapping:true,
        readOnly:!!opt.readonly,
        indentUnit:2, tabSize:2, smartIndent:!opt.readonly,
        styleActiveLine:!opt.readonly,
        matchBrackets:!opt.readonly, autoCloseBrackets:!opt.readonly,
        highlightSelectionMatches:{ minChars:3, showToken:false },
        foldGutter:!opt.readonly,
        gutters:opt.readonly ? [] : ['CodeMirror-linenumbers','CodeMirror-foldgutter'],
        phrases:self.phrases(),
        extraKeys:{
          'Ctrl-F':'findPersistent', 'Alt-F':'findPersistent', 'Cmd-F':'findPersistent',
          'Ctrl-G':'findNext', 'Shift-Ctrl-G':'findPrev', 'F3':'findNext', 'Shift-F3':'findPrev',
          'Shift-Ctrl-F':'replace', 'Shift-Ctrl-R':'replaceAll'
        }
      });
      api.cm = cm;
      if(opt.onChange) cm.on('change', () => opt.onChange(cm.getValue()));
      /* 对话框这一层是后挂上去的：挂完补一次 refresh，不然行号宽度和滚动位置量歪 */
      requestAnimationFrame(() => { cm.refresh(); if(opt.autofocus !== false && !opt.readonly) cm.focus(); });
    };
    if(box.isConnected) go();
    else {
      let tries = 0;
      const wait = () => { if(box.isConnected) go(); else if(++tries < 240) requestAnimationFrame(wait); else go(); };
      requestAnimationFrame(wait);
    }
    this.live.push(api);
    return api;
  }
};

/* 宿主换配色时叫一声（FD 的 Theme.apply / WNW 的 Theme.apply 各挂一处） */
function icodeRetone(){ try{ ICode.retone(); }catch(e){} }
