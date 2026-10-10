/* 插件 id 改名那一张表（同步 GitHub 第 3 条 · 2026-10-09 他定「改程序、代码命名（本体名字和各处引用）」）
   ------------------------------------------------------------
   为什么改：包 id 对齐成当初那七家插件仓的仓库名（去掉 Flow-Desk-plugin- 那截前缀；外46 四起六家并回主仓，id 一个字不改），
   从前 id 和仓库名各一套（your-notes ↔ Notes、to-music ↔ Music-Remote、rime-practice ↔ Singbit-Input-Practice），
   看 issue、看提交、找包三处要各认各的名字。这一张表把 id 对齐过去；
   your-sentences、schedule、why-not-write 本来就已经对得上，所以不在表里。
   为什么只有一份：id 同时是盘上的文件夹名、插件清单里的 id、桌面布局里的 widget、
   表单键的前缀（State 认「id 打头」那一串），所以搬家和改代码两头必须同一张嘴 ——
   生成页面时这一份被写进页顶（var PACK_RENAME，和 FD_VERSION 同一趟），
   node 那边 src\\tools\\rename-packs.mjs 直接 import 这一份。
   只进不出：这一张表是历史，新名字以后不再改；旧名字搬完一次就不再认。 */
export const PACK_RENAME = {
  'your-notes': 'notes',
  'to-music': 'music-remote',
  'rime-practice': 'singbit-input-practice'
};
