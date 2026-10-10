/* ============================================================
   帮助文档的装载器。
   内容不在这里 —— Flow-Desk.exe 读的是数据层那份明文 data\help.md（第 15 条：软件更新换 pages\ 时
   不会把你改过的帮助一起吃掉；出厂原本还留在 pages\help.md，由程序按出厂版的更新刷这份工作副本）。
   排版交给共享的那台小机器 DocMd（_shared/sh-doc.js）：只认几样记号（# / ## 标题、"- " 列表、
   **粗**、`码`、``` 代码块），全程 textNode 摆出来，文档里就算写了脚本也只是几个字，不执行它带的任何东西。
   样式全挂 CSS 变量，所以这一页在哪个配色下就跟着哪个配色走。
   用 Notepad++ 改完保存，回 FD 再点「帮助」就是新的：每次点开都现读，
   不缓存、不内嵌、不用重新构建（no-store 是必须的，不然换的是旧那份）。
   旧版的 html 帮助（data\help.html）如果用户改过，程序留着不删，但这里不再读它。
   读不到就是那份明文被挪走或改了名：界面上只说人话和下一步，一个路径字符都不写（撞「界面不出现文件名/路径」
   那条硬约束）；真实原因（哪一份、什么错）走 console.error —— 主进程把页面里 level 3 的报错收进
   data\logs\ 那一棵日志（pack\main.cjs 的 watchLogs「页面」），诊断能力不丢。
   ============================================================ */
const HELP_FILE = DATA_PRE + 'help.md';

const Help = {
  async open(){
    const box = document.getElementById('fdCoverBody');
    let txt = null, err = '';
    try{
      const r = await fetch(HELP_FILE, { cache:'no-store' });
      if(r.ok) txt = await r.text();
      else err = '服务器回了 ' + r.status;
    }catch(e){ err = String(e && e.message || e); }
    box.innerHTML = '';
    if(txt === null){
      /* 界面上只说「读不到」和下一步；哪一份、什么错只往日志那一层送（见文件头那条硬约束） */
      console.error('帮助这一页读不到：' + HELP_FILE + ' · ' + err);
      box.appendChild(h('div', { class:'fd-help-miss' }, [
        h('p', {}, '这份帮助读不到。'),
        h('p', {}, '这一页每次都现读那一份明文，不缓存 —— 它被挪走、改了名，或者这台电脑上还没装上，都会读不到。' +
          '具体原因记在程序日志里，那一行写清了是哪一份、卡在哪一步。'),
        h('p', { class:'i' }, '下一步：把那份明文放回原来的位置（还用原来的名字），或者重装一次组件；弄完再点「帮助」就是新的。')
      ]));
      Cover.begin('帮助', null);
      return;
    }
    /* 铺进一个新节点，别把样式类挂到 fdCoverBody 上 —— 那一格不止帮助在用 */
    const doc = h('div');
    box.appendChild(doc);
    DocMd.mount(doc, txt);
    Cover.begin('帮助', null);
  }
};
window.FD_openHelp = () => Help.open();

/* ============================================================
   第 23 条：用户数据详单。
   设置·数据 那页一个按钮，点开的是站内的一篇固定文档（数据层那份 userdata-list.md），
   每一次都现读、不缓存：清单本身是明文，改完保存再点就是新的（和帮助页同款走法）。
   排版交给共享的那台小机器 DocMd（_shared/sh-doc.js），样式挂 CSS 变量，跟着 FD 的配色走。
   读不到就是那份明文被挪走或改了名：和帮助那屏一样，界面上只说人话，原因往日志那一层送。
   ============================================================ */
const USERDATA_FILE = DATA_PRE + 'userdata-list.md';
const UserList = {
  async open(){
    const box = document.getElementById('fdCoverBody');
    let txt = null, err = '';
    try{
      const r = await fetch(USERDATA_FILE, { cache:'no-store' });
      if(r.ok) txt = await r.text();
      else err = '服务器回了 ' + r.status;
    }catch(e){ err = String(e && e.message || e); }
    box.innerHTML = '';
    if(txt === null){
      /* 同帮助那一屏：路径只进日志，界面上一个路径字符都不出现 */
      console.error('用户数据详单读不到：' + USERDATA_FILE + ' · ' + err);
      box.appendChild(h('div', { class:'fd-help-miss' }, [
        h('p', {}, '这份用户数据详单读不到。'),
        h('p', {}, '这一页每次都现读那一份清单，不缓存 —— 它被挪走、改了名，或者这台电脑上还没装上，都会读不到。' +
          '具体原因记在程序日志里，那一行写清了是哪一份、卡在哪一步。'),
        h('p', { class:'i' }, '下一步：把那份清单放回原来的位置（还用原来的名字），或者重装一次组件；弄完再点这个按钮就是新的。')
      ]));
      Cover.begin('用户数据详单', null);
      return;
    }
    /* 铺进一个新节点，别把样式类挂到 fdCoverBody 上 —— 帮助页用的就是那一格 */
    const doc = h('div');
    box.appendChild(doc);
    DocMd.mount(doc, txt);
    Cover.begin('用户数据详单', null);
  }
};
window.FD_openUserList = () => UserList.open();

/* 顶栏「设置」旁边插一个「帮助」；template.html 不动 */
(function addHelpBtn(){
  const set = document.getElementById('fdSetBtn');
  if(!set || document.getElementById('fdHelpBtn')) return;
  const b = h('button', { class:'fd-btn ghost', id:'fdHelpBtn' }, '帮助');
  b.onclick = () => Help.open();
  set.parentNode.insertBefore(b, set);
})();

/* 只给「读不到」那一屏用的样式；文档本体的排版由 DocMd 那台小机器带（见 _shared/sh-doc.js） */
(function missStyle(){
  if(document.getElementById('fd-help-style')) return;
  const st = h('style', { id:'fd-help-style' });
  st.textContent = '.fd-help-miss{height:100%;overflow:auto;padding:26px 30px;color:var(--text);font-size:1rem;line-height:1.9}' +
    '.fd-help-miss p{margin:8px 0}.fd-help-miss .i{color:var(--text-light)}';
  document.head.appendChild(st);
})();
