/* ============================================================
   FD v0.2 启动
   ============================================================ */
(async function boot(){
  /* 图标先从主进程那份清单读回来（icons\ 一层 + 各个包自己的 images\）：
     这一句排在画第一屏之前；主进程那一份读不回来时，页面上还有出厂那一份线稿可画 */
  Ico.link(window.FD_APP);
  /* exe 里数据默认就落 data\userdata-fd\（明文，不用授权）；
     镜像期攒下的东西第一次进来时搬过去，搬之前各留一份 *.old.json */
  await Store.appInit();
  try{
    await Store.restore();
    const moved = await Store.migrateToApp();
    if(moved) setTimeout(() => toast('镜像期的 ' + moved + ' 份数据已搬成这台机器上的明文文件'), 900);
  }catch(e){ console.warn('数据后端没就绪，先按镜像模式跑：' + e.message); }
  await Settings.load();
  /* 界面文字清单（批⑤-6）：先把 数据\ui-text.yaml 读进来盯住，后面现出来的字才认得该换哪句。
     这一份不在 data\ 时由主进程从出厂那层落过来；旧第 14 条的 phrases.json 要是还有改动，
     这一趟搬进清单右边那一栏（原文件不删不动），搬完界面上立刻生效。 */
  await Txt.boot();
  try{
    const ph = await Store.loadJSON('phrases.json', {});
    const keys = ph && typeof ph === 'object' ? Object.keys(ph) : [];
    if(keys.length && window.FD_APP && window.FD_APP.uiTextAdopt){
      const r = await window.FD_APP.uiTextAdopt(ph);
      if(r && r.adopted) toast('旧「提示语」页里改过的 ' + r.adopted + ' 句已搬进界面文字清单');
    }
  }catch(e){}
  /* 卡片大小清单（#251）：读磁盘那一份盖大小，排在组件加载之前 —— 新摆的卡片注册那一刻就吃到清单里的新默认。
     之后外部编辑器存盘、别的窗口保存，都靠下面接的广播当场跟上。 */
  try{ await SizeList.boot(); }catch(e){}
  /* 插件在这一刻从 data\plugins\ 加载进来（名单 → 插件清单 → import main.js → 登记）。
     排在卡片大小清单之后：新摆的卡片吃清单盖过的大小，注册那一刻就得盖上；
     排在 Shell.init 之前：首页那几张卡要摆得出。一家崩了只立它自己那张错误卡。 */
  try{ await PackLoader.load(); }catch(e){ console.warn('插件加载这一趟没走通：' + ((e && e.message) || e)); }
  await Palette.init();
  await Theme.init();
  /* #292 外观方案：色卡已经在 Palette.init 里认完，这一趟把 数据\looks.yaml 认下来，
     并把「磁盘那一份被外部编辑器改了」这一路广播接上（两份库文件共用一条）。 */
  try{ await bootLibs(); }catch(e){ console.warn('外观方案没认下来：' + ((e && e.message) || e)); }
  /* 明暗那一轴（外13-M）：排在两份库都认下来之后、第一次上色之前 ——
     它要看色卡里 明暗 那一栏划色卡，也要看外观方案里 配色 那一栏挑方案，两边都得先认完。
     这一步里包含「开机向主进程问一次系统深浅」（只问这一次，往后全听事件推）。
     问不到不碍事：那一趟回的是空值，轴按上一回 / 手动那个值落，不会拦着开机。 */
  try{ await Ming.boot(); }catch(e){ console.warn('明暗那一轴没认下来：' + ((e && e.message) || e)); }
  /* 老版本只有一档圆角，存在设置顶上；第一次开机时并进卡片圆角，之后就只认 theme 里那两档 */
  if(!Settings.get('radiusMig', false)){
    const rc = await Store.loadSetting('radiusCard', null);
    if(rc !== null){ Theme.cfg.radiusCard = clampRadius(rc); Theme.save(); }
    Settings.set('radiusMig', true);
  }
  /* 标记色（外13-N）：排在两份库和明暗轴都认完、第一次上色之前。
     这一节从没定过值（老存档升上来 / 第一次用这一档）才照当前配色落一串种子，落定之后再也不动 ——
     换配色、换外观方案、换明暗都不会重算它，只有 设置·外观 那一档里用户自己按的按钮会改。 */
  try{ Marks.boot(); }catch(e){ console.warn('标记色没认下来：' + ((e && e.message) || e)); }
  Theme.apply();
  /* 还没内嵌进 html 的配方先从 kv 里装回来，首页才摆得出这张卡 */
  if(typeof GenLocal !== 'undefined') await GenLocal.warm();
  await Shell.init();
  /* 卡片大小清单（#251）补一趟：boot 那一趟读清单时桌上还没有卡片，盖不着。
     这里排在 Shell.init 之后 —— 程序关着的时候改的清单（包括「把上一轮盖掉的那张恢复回去」），
     桌上这些没亲手拉过的卡片在这一趟里跟上。 */
  try{ SizeList.reapply(); }catch(e){}
  /* Flow-Desk.exe 开机静默读一遍系统字体清单；开发服务器里读不到就什么都不做，选择器里那个按钮是唯一入口 */
  Fonts.auto();
  /* 全局那张字体表（标记 / 置顶 / 用过几次）在 FD 里改了就重播一次，展开的组件才跟得上 */
  Fonts.hooks.add(() => Theme.pushToFrames());
  /* 定期备份（外30 戊组）：认一遍配置，问一账磁盘上上一次抄到什么时候，摆一颗到点的表。
     到点了就当场抄一趟（主进程那边抄，不挡这一屏），没到点就把表设到下一刻 —— 不是一遍遍地问时间。 */
  try{ await Backup.boot(); }catch(e){ console.warn('定期备份没认下来：' + ((e && e.message) || e)); }
  /* Rime 配色那条线（读 weasel yaml、开机自动重读）已在 件-9 整条撤下，不再从小企鹅那边往里灌。
     外29 乙组又改了一处：从图取色、色卡图认到的色只进色卡，不再各自登记成一套配色 ——
     色卡那一头剩下的来源是自带两套 + 自己新建。 */
  addEventListener('pagehide', () => { if(Store.dirty.size) Store.flush(); });
  /* 从前这里有一句「第一次开机问一句数据存哪儿」（askDataHome）：那是只给开发用的开法才走得到的分支，
     Flow-Desk.exe 里数据默认就在它旁边的明文目录，没有「要不要授权」这回事 —— 2026-10-03 那一支连着函数一起删了，
     数据目录想换就在 设置 · 数据 里点「换到别的目录」。 */
  /* 从前这里有一趟每四秒一次的「把声笔输入法练习那层的配色抓进全局池」（Theme.scrapeRp）：
     抓进来的都是小企鹅的 weasel 皮肤，件-9 整条撤下 Rime 配色之后这条路一并断了，
     打字练习的配色从外13-A 起就归它自己管，不再回灌宿主。 */
})().catch(e => {
  console.error(e);
  document.getElementById('fdGrid').innerHTML = '<div class="fd-empty">Flow-Desk 启动失败：' + esc(e.message) + '</div>';
});
