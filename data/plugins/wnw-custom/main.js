/* 组件定制启动卡 · 组件包 ES module（外39 · 2026-10-09 他定「组件定制本身也要分离出来，改名为 wnw-custom」）
   这一张卡只管开那一台向导 —— 改代码、导出配方、导入组件那些入口照旧长在每张卡自己身上
   （_fd/src/fd3-shell.js 和 _wnw/src/w3-shell.js 各摆一遍，判的是「那个名字在不在」）。
   内核不住这一格里：那四份源码在 Flow-Desk-plugin-WNW-Custom 那一棵（本地 src\_wcustom\src\），
   由它自己的 build-kernel.mjs 出成一颗产物，生成时贴进整页顶层。所以这一版页面没带内核的时候，
   这里直接说一句实话，不给一个点了没动静的入口 —— 和为写那张同一个处理。 */
export default {
  noTitle:true, minW:5, minH:2, def:{ w:7, h:2 },
  mount(body, ctx){
    if(!ctx.wcustom || !ctx.wcustom.available)
      return ctx.mountLauncher(body, { action:'但这一版页面里没有组件定制的内核，开不了', open(){} }, ctx);
    return ctx.mountLauncher(body, {
      action:'定制组件（打开向导）',
      open(){
        /* 造完新组件要有人把桌面重画一遍，不然新那张卡在名单上却不出现 ——
           外壳那颗「定制组件」按钮交的是同一份回调（Shell.pickWidget）。 */
        try{ ctx.wcustom.open(() => { if(typeof ctx.rerenderDesktop === 'function') ctx.rerenderDesktop(); }); }
        catch(e){ ctx.toast('组件定制没开起来：' + ((e && e.message) || e)); }
      }
    }, ctx);
  }
};
