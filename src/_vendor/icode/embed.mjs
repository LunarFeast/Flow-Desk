/* ============================================================
   内置代码编辑器的两份打包产物 → 打进页面
   读 icode.js（CodeMirror 5 的打包结果）和 icode.css（自带样式 + 外壳配色），
   合成一句 window.ICODE_SRC = {...}；运行时由 _shared/sh-icode.js 第一次用到才塞进 <head>。
   两个宿主的 build.mjs 都从这里取，FD 卡和 WNW 停靠两端拿到的编辑器是同一个。
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(import.meta.dirname);
export function icodeEmbed(){
  const js = fs.readFileSync(path.join(DIR, 'icode.js'), 'utf8');
  const css = fs.readFileSync(path.join(DIR, 'icode.css'), 'utf8');
  /* 单文件产物靠 </script 收尾：这两段里要是冒出这个串，页面从这儿就断了 */
  if(/<\/script/i.test(js) || /<\/script/i.test(css)) throw new Error('icode 产物里有 </script，构建会被截断');
  return 'window.ICODE_SRC = ' + JSON.stringify({ js, css }) + ';';
}
