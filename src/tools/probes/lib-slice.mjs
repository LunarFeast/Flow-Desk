/* 探针共用的「从真源码里切一颗」的尺 —— 外30 这一批新台子都用它，不再各自抄第二份。
   规矩和 test-marks.mjs 那把一样：切的是仓库里那一份原文（不抄第二份），
   函数看到配对的大括号就收，常量看到浅层分号就收；字符串、注释、正则字面量里的括号不算数。
   文件名不带 test-/gate-/klog- 前缀：selfcheck 那一头只点那三类，这一颗是零件不是台子。 */
import fs from 'node:fs';

export const ROOT = 'D:/Programs/Flow-Desk/';
export const rd = p => fs.readFileSync(ROOT + p, 'utf8');

function 扫过(s, i){
  const c = s[i], d = s[i + 1];
  if(c === '/' && d === '/'){ const n = s.indexOf('\n', i); return n < 0 ? s.length : n; }
  if(c === '/' && d === '*'){ const n = s.indexOf('*/', i + 2); return n < 0 ? s.length : n + 2; }
  if(c === '"' || c === "'" || c === '`'){
    let k = i + 1;
    while(k < s.length){ if(s[k] === '\\'){ k += 2; continue; } if(s[k] === c) return k + 1; k++; }
    return s.length;
  }
  if(c === '/'){
    let k = i + 1, 方 = false;
    while(k < s.length){
      const x = s[k];
      if(x === '\\'){ k += 2; continue; }
      if(x === '\n') break;
      if(方){ if(x === ']') 方 = false; k++; continue; }
      if(x === '['){ 方 = true; k++; continue; }
      if(x === '/') return k + 1;
      k++;
    }
    return i + 1;
  }
  return i;
}
const 正则位 = c => c === undefined || '(,=:[!&|?{};+\n'.includes(c);

/* 从一份源码文本里按名字切出一整颗顶层声明（const / let / var / function / async function） */
export function 切(src, 名){
  const 起 = new RegExp('^(?:const|let|var|function|async[ \\t]+function)[ \\t]+' + 名 + '(?![\\w$])', 'm').exec(src);
  if(!起) throw new Error('切不到这一颗：' + 名);
  const 函数 = /function/.test(起[0]);
  let i = 起.index + 起[0].length, d = 0, 开过 = false, 前 = ' ';
  while(i < src.length){
    const c = src[i];
    if(c === '/' || c === '"' || c === "'" || c === '`'){
      const n = (c === '/' && !正则位(前)) ? i + 1 : 扫过(src, i);
      if(n === i){ 前 = c; i++; } else { i = n; 前 = '/'; }
      continue;
    }
    if(c === '{' || c === '[' || c === '('){ d++; 开过 = true; }
    else if(c === '}' || c === ']' || c === ')'){ d--; if(函数 && c === '}' && d === 0 && 开过) return src.slice(起.index, i + 1); }
    else if(!函数 && c === ';' && d === 0) return src.slice(起.index, i + 1);
    if(!/\s/.test(c)) 前 = c;
    i++;
  }
  if(!函数 && d === 0) return src.slice(起.index);
  throw new Error(名 + ' 没收尾');
}

/* 从对象字面量 / class 里切一颗方法（Cards.put、CardView.dirty 这种：给方法名那一行的开头，连缩进原样端出来）。
   同名方法一家 class 里到处都有（dirty / draw 满天飞），所以给一个「从哪儿往后找」的起点；
   再给一个「到哪儿为止」（下一个 class 的开头）—— 越界就当没找到抛出来：
   从前这里少给一个界，CardView.dirty 改过签名之后静悄悄切到了后面某一家的同名方法，跑出来的是替身的账。 */
export function 切方法(src, 头, 起 = 0, 止 = src.length){
  const i = src.indexOf('\n' + 头, 起);
  if(i < 0 || i >= 止) throw new Error('切不到这一颗方法：' + 头.trim() + (起 ? '（从第 ' + 起 + ' 个字往后、到第 ' + 止 + ' 个字为止）' : ''));
  let j = src.indexOf('{', i + 1), d = 0;
  let k = j, 前 = ' ';
  while(k < src.length){
    const c = src[k];
    if(c === '/' || c === '"' || c === "'" || c === '`'){
      const n = (c === '/' && !正则位(前)) ? k + 1 : 扫过(src, k);
      if(n === k){ 前 = c; k++; } else { k = n; 前 = '/'; }
      continue;
    }
    if(c === '{' || c === '[' || c === '(') d++;
    else if(c === '}' || c === ']' || c === ')'){ d--; if(d === 0 && c === '}') return src.slice(i + 1, k + 1); }
    if(!/\s/.test(c)) 前 = c;
    k++;
  }
  throw new Error(头.trim() + ' 没收尾');
}

/* 一台结果账：判() 每条都要报数，最后 收尾() 打印并退出码 */
export function 记账(台名){
  let pass = 0, fail = 0;
  const 目 = [];
  return {
    题(t){ console.log('\n=== ' + t + '（' + 台名 + '）'); },
    判(n, c, extra){
      if(c){ pass++; console.log('  PASS ' + n); }
      else { fail++; console.log('  FAIL ' + n + (extra === undefined ? '' : ' · 实际：' + fmt(extra))); }
      目.push([n, !!c]);
      return !!c;
    },
    数(k, v){ console.log('  · ' + k + ' = ' + fmt(v)); },
    收尾(){
      console.log('\n' + 台名 + '：' + pass + ' 过 ' + fail + ' 不过（共 ' + (pass + fail) + ' 条）');
      if(!pass && !fail) { console.log('这台一条都没判 —— 哑台，不算跑过'); process.exitCode = 1; }
      if(fail) process.exitCode = 1;
    }
  };
}
function fmt(v){
  if(typeof v === 'string') return v;
  try{ return JSON.stringify(v); }catch(e){ return String(v); }
}
