/* ============================================================
   构建脚本共用的那把尺（第 15 条：一棵树分两层）
   Flow-Desk\
     pages\   出厂的 html 产物 —— 软件更新整层换掉的就是它
     data\    用户自己长出来的东西：书、plugins 配方、生成记录、两份自建词库、help 工作副本、userdata-*
   所以构建时是「往 pages\ 生成、从 data\ 取配方和词库」。
   口径和 src\pack\main.cjs 一致：FD_TREE 指到别处（探针的测试树就用它）。
   只有一处和程序不一样：这一把尺还认老中文名，取的时候英文名优先。
   为什么——程序开机第一件事就把 页面\/数据\/更新\ 改成英文名（main.cjs 的 prepareTrees），
   而三个程序还开着的时候改不动。构建脚本落在哪个名字上都对：
   改之前写进 页面\，下一次开机改名，它跟着变成 pages\；改之后只剩 pages\，也没第二条路。
   程序自己（读数据、换版）只认英文名，不留老名字的后门。
     const T = require('./tree.cjs')(__dirname);   // T.tree / T.pages / T.data
   ============================================================ */
const fs = require('fs');
const path = require('path');
function pick(list){ for(const p of list){ try{ if(fs.existsSync(p)) return p; }catch(e){} } return null; }
module.exports = function(fromDir){
  const tree = process.env.FD_TREE ? path.resolve(process.env.FD_TREE) : path.resolve(fromDir, '../..');
  return {
    tree,
    pages: pick([path.join(tree, 'pages'), path.join(tree, '页面')]) || path.join(tree, 'pages'),
    data: pick([path.join(tree, 'data'), path.join(tree, '数据')]) || path.join(tree, 'data')
  };
};
