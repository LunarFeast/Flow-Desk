/* ============================================================
   FD · 插件上下文的宿主这半 + 加载接线
   共用的一半在 _shared/sh-load.js；这里交的是 Flow-Desk 自己的答卷：
   设置、明文存储、封面、对话框，还有只有 FD 有的那几个小工具（重画桌面、重画时钟）。
   这一段排在 fd8-tools.js 后面：Data_PRE / ToolKv 都在那儿定义；也排在 _shared/sh-load.js 后面（PackCtx 在那儿）。
   ============================================================ */
const WNW_MISSING = '写作内核还没拼进这一版页面';
const RP_MISSING = '声笔输入法练习内核还没拼进这一版页面';
const WCUSTOM_MISSING = '组件定制的内核还没拼进这一版页面';
PackCtx.parts({
  kv:ToolKv,
  settings:Settings,
  store:Store,
  cover:{
    openNode:(t, n, cb) => Cover.openNode(t, n, cb),
    setTitle(t){ document.getElementById('fdCoverTitle').textContent = t; },
    body(){ return document.getElementById('fdCoverBody'); },
    close(){ Cover.close(); }
  },
  dialog:{ open:(t, b, f, after, opt) => Modal.open(t, b, f, after, opt), close(){ Modal.close(); } },
  /* 组件里「删之前问一句」都走这一枚（✕ 和「取消」都算不删），别让各家自己搭框 */
  ask:(q, yes) => fdAsk(q, yes),
  /* FD_APP 通道不在这里交了：白名单发放、读这一张页 window 上的桥、硬地板那一整套是两家共用的，
     归 _shared/sh-load.js 的 packApp —— 宿主这边不声明就用那一把，免得两个程序的组件待遇不一样。
     桌面重画/时钟重画这两个请求也只有 Flow-Desk 有（WNW 没有桌面），就摆在这份 more 里。 */
  more:{
    fitBox, coverWrap, fullStyle:FULL_STYLE, mountLauncher, segCtrl, esc,
    fmtDate, parseDate, addDays, weekOfYear,
    rerenderDesktop(){ Shell.render(); },
    rerenderClock(){ Shell.tickClock(); },
    /* 为写内核：搬进这一张页之后它是一个可调用的一份，收一个容器、拆干净再走。
       这一份答卷排在闭包之前求值，那时候内核还没挂上来，所以只能到用的时候再去认，
       认不到就给一句实话 —— 插件禁止自己摸窗口上的名字，这条通道必须由宿主递过去。 */
    wnw:{
      start(host){ const k = window.WNW_KERNEL; if(!k) throw new Error(WNW_MISSING); return k.start(host); },
      stop(){ const k = window.WNW_KERNEL; if(!k) throw new Error(WNW_MISSING); return k.stop(); },
      get running(){ const k = window.WNW_KERNEL; return k ? k.running() : false; },
      get version(){ const k = window.WNW_KERNEL; return k ? k.version : WNW_MISSING; },
      get available(){ return typeof window.WNW_KERNEL === 'object' && window.WNW_KERNEL !== null; }
    },
    /* 声笔输入法练习内核：和上面那一条同一个形状（同一趟搬法，见 _build/rp-kernel.mjs）——
       也是收一个容器、拆干净再走，也是到用的时候才认窗口上那一份。 */
    rp:{
      start(host){ const k = window.RP_KERNEL; if(!k) throw new Error(RP_MISSING); return k.start(host); },
      stop(){ const k = window.RP_KERNEL; if(!k) throw new Error(RP_MISSING); return k.stop(); },
      get running(){ const k = window.RP_KERNEL; return k ? k.running() : false; },
      get version(){ const k = window.RP_KERNEL; return k ? k.version : RP_MISSING; },
      get available(){ return typeof window.RP_KERNEL === 'object' && window.RP_KERNEL !== null; }
    },
    /* 组件定制内核（外39 分离，形状照为写那一套）：源码住 src\_wcustom\src\ 那四份，
       由那一棵自己的 build-kernel.mjs 出成一颗产物，生成时贴进整页顶层。
       和上面两条不一样的一处：它不套闭包，名字（GenWizard / Gen / codeEntry…）本来就落在顶层，
       外壳那几只入口判的就是「这个名字在不在」—— 理由写在那棵的 build-kernel.mjs 开头。
       所以这里认内核在不在，也照同一个判法。 */
    wcustom:{
      get available(){ return typeof GenWizard !== 'undefined'; },
      open(onSaved){
        if(!this.available) throw new Error(WCUSTOM_MISSING);
        GenWizard.onSaved = onSaved || null;
        GenWizard.open('');
      },
      get version(){ return this.available ? (typeof FD_VERSION === 'string' ? FD_VERSION : '') : WCUSTOM_MISSING; }
    }
  }
});
PackLoader.use({ host:'fd', base:DATA_PRE + 'plugins/' });
/* 「改代码」存完只重载这一家（PackLoader.reload）：桌面整层重画一遍，
   这张卡重新挂的是刚落盘的那份新代码，别的卡各自从自己的明文文件重读，数据不动。 */
Bus.on('pack:reload', () => { try{ Shell.render(); }catch(e){ console.warn('重载这一家之后重画桌面没走通：' + ((e && e.message) || e)); } });
