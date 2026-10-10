/* 丁组 · 设置-外观横向次级标签那一台（外29 第 56 轮）
   作者的原话：「外观加上横向的次级标签页：1、方案与明暗 …… 3、方案编辑 初始为不可切换的灰色标签，
   在方案设定页选中后，可以手动切换到"方案编辑"页，也可以点击方案编辑按钮跳转到"方案编辑页"」
   这一台把真 subTabs 搬进虚拟机跑（不是照抄一份）：四页在不在、锁着的那页点不动、放开之后点得动、
   左右键跳过锁着的、锁着当前页时会退到第一页没锁的。 */
import fs from 'node:fs';
import vm from 'node:vm';
const SRC = fs.readFileSync('D:/Programs/Flow-Desk/src/_fd/src/fd4-builtin.js', 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if(c){ pass++; console.log('  PASS ' + n); } else { fail++; console.log('  FAIL ' + n + (x ? ' · ' + x : '')); } };

function braceSlice(src, marker){
  const i = src.indexOf(marker); if(i < 0) throw new Error('找不到 ' + marker);
  let d = 0, j = src.indexOf('{', i);
  for(let k = j; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}'){ d--; if(!d) return src.slice(i, k + 1); } }
  throw new Error(marker + ' 花括号没配平');
}
/* 假 DOM：只做到这一台真会用到的那几样，属性 / 类 / 子节点 / 事件都留痕，量得到不是猜的 */
function mkEl(tag){
  const n = { tag, attrs:{}, kids:[], cls:new Set(), listeners:{}, disabled:false, text:'', focused:0 };
  n.classList = { toggle:(c, on) => { if(on === undefined || on) n.cls.add(c); else n.cls.delete(c); },
    add:c => n.cls.add(c), remove:c => n.cls.delete(c), contains:c => n.cls.has(c) };
  n.setAttribute = (k, v) => { n.attrs[k] = String(v); };
  n.getAttribute = k => (k in n.attrs ? n.attrs[k] : null);
  n.appendChild = c => { n.kids.push(c); return c; };
  n.replaceChildren = (...cs) => { n.kids = cs.slice(); };
  n.addEventListener = (t, f) => { (n.listeners[t] = n.listeners[t] || []).push(f); };
  n.focus = () => { n.focused++; };
  Object.defineProperty(n, 'className', { get:() => [...n.cls].join(' '), set:v => { n.cls = new Set(String(v).split(/\s+/).filter(Boolean)); } });
  return n;
}
const h = (tag, props, kids) => {
  const n = mkEl(tag);
  if(typeof props === 'string' || Array.isArray(props)){ kids = props; props = null; }
  if(props) for(const k in props){
    const v = props[k];
    if(k === 'class') n.className = v;
    else if(k === 'style') n.styleText = v;
    else if(k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if(k === 'id' || k === 'role' || k === 'title') n.setAttribute(k, v);
    else if(k === 'tabindex' || k.startsWith('aria-')) n.setAttribute(k, v);
    else n[k] = v;
  }
  (Array.isArray(kids) ? kids : kids === undefined ? [] : [kids]).filter(Boolean)
    .forEach(x => n.appendChild(typeof x === 'string' ? Object.assign(mkEl('#t'), { text:x }) : x));
  return n;
};
const sb = { h };
vm.createContext(sb);
vm.runInContext(braceSlice(SRC, 'function subTabs(') + '\nthis.subTabs = subTabs;', sb);
const subTabs = sb.subTabs;
const P3 = '方案编辑';
const pages = ['方案与明暗', '方案设定', P3, '方案资源'].map(n => ({ name:n, build:() => h('div', { class:'p-' + n }) }));
const st = subTabs(pages, '方案与明暗');

const tabEls = st.bar.kids;
ok('1 四页的标签都摆出来了，顺序就是「方案与明暗 / 方案设定 / 方案编辑 / 方案资源」',
  tabEls.length === 4 && tabEls.map(x => x.kids[0] && x.kids[0].text).join('|') === pages.map(p => p.name).join('|'),
  tabEls.map(x => x.kids[0] && x.kids[0].text).join('|'));
ok('2 是真标签（不是四个按钮）：列 role=tablist、方向是横的、每一项 role=tab + aria-controls',
  st.bar.getAttribute('role') === 'tablist' && st.bar.getAttribute('aria-orientation') === 'horizontal'
  && tabEls.every(b => b.getAttribute('role') === 'tab' && b.getAttribute('aria-controls') === 'fd-sub-pane'));
ok('3 内容区是 role=tabpanel，切页时 aria-labelledby 指着当前那一格',
  st.pane.getAttribute('role') === 'tabpanel' && st.pane.getAttribute('aria-labelledby') === 'fd-sub-方案与明暗');
ok('4 当前这一格 aria-selected=true、tabindex=0，其余 false / -1（读屏说得出在哪一档，Tab 键不在这一列里一格一格过）',
  tabEls[0].getAttribute('aria-selected') === 'true' && tabEls[0].getAttribute('tabindex') === '0'
  && tabEls.slice(1).every(b => b.getAttribute('aria-selected') === 'false' && b.getAttribute('tabindex') === '-1'));

/* ---- 锁着的那一页 ---- */
st.lock(P3, true);
const t3 = tabEls[2];
ok('5 锁上「方案编辑」：这一格 disabled=true、挂了 .off 类（灰的），点它不切页',
  t3.disabled === true && t3.classList.contains('off') && st.go(P3) === false && st.cur() === '方案与明暗');
ok('6 锁着的那一格只是灰、不是消失（没挂 hidden、没从列里摘掉 —— 让人知道有这一页、现在还不许进）',
  tabEls.length === 4 && st.bar.kids.includes(t3) && t3.attrs.hidden === undefined);
ok('7 放开之后点得动：go 成功、选中态跟着走、内容区换成那一页',
  (st.lock(P3, false), st.go(P3) === true && st.cur() === P3 && st.pane.getAttribute('aria-labelledby') === 'fd-sub-方案编辑'
    && st.pane.kids[0].className === 'p-方案编辑'));
ok('8 左右键跳过锁着的：把「方案设定」和「方案编辑」锁掉，从第一页按右键直接到第四页',
  (() => { st.go('方案与明暗'); st.lock('方案设定', true); st.lock(P3, true);
    const kd = st.bar.listeners.keydown[0]; kd({ key:'ArrowRight', preventDefault(){} });
    const r = st.cur(); st.lock('方案设定', false); st.lock(P3, false); return r === '方案资源'; })());
ok('9 锁掉的正好是当前这一页 → 退回第一个没锁的页，不把人关在一页里出不来',
  (() => { st.go(P3); st.lock(P3, true); const r = st.cur(); st.lock(P3, false); return r === '方案与明暗'; })());
ok('10 每一页的内容是切到那一档才建（build 只被当前这档调用过）',
  (() => { let n = 0; const s2 = subTabs([{ name:'甲', build:() => { n++; return h('div'); } }, { name:'乙', build:() => { n++; return h('div'); } }], '甲');
    return n === 1 && (s2.go('乙'), n === 2); })());

/* ---- 四页各摆了什么（源码现场数，不是凭记忆） ---- */
const TL = braceSlice(SRC, 'function tabLook()');
ok('11 第 1 页两样齐：明暗那一摊 + 在下拉里切换所用方案',
  /gMing\.body\.appendChild\(mingBox\)/.test(TL) && /gMing\.body\.appendChild\(row\('外观方案', schemeSel\.wrap\)\)/.test(TL));
ok('12 第 2 页四样齐：重命名、删除、新建、跳去「方案编辑」（分组那一档另说）',
  /LookLib\.rename\(/.test(TL) && /LookLib\.remove\(/.test(TL) && /saveAsDlg\(/.test(TL) && /sub\.go\(P_EDIT\)/.test(TL));
ok('13 第 3 页把这套方案自己的每一样都收进来了（字体 / 卡面 / 纹理 / 配色来源 / 背景 / 渐变 / 标记用颜色 / 写盘那一行 / 恢复出厂）',
  ['p3box.appendChild(dScheme)', 'p3box.appendChild(gCard.wrap)', 'p3box.appendChild(gTex.wrap)', 'p3box.appendChild(dPal)',
   'p3box.appendChild(bar)', 'p3box.appendChild(gWall.wrap)', 'p3box.appendChild(gGrad.wrap)', 'p3box.appendChild(markSection())',
   "p3box.appendChild(row('恢复出厂取值'"].every(x => TL.includes(x)));
ok('14 第 4 页是资源那一摊（配色库 + 色卡池），且初始锁着第 3 页',
  /gPal\.body\.appendChild\(lib\)/.test(TL) && /sub\.lock\(P_EDIT, !chosen\)/.test(TL));
ok('15 从前的七组分屏不再整列摆上屏（那句 box.appendChild 的 for 循环撤了）',
  !/for\(const g of \[gMing, gLook, gCard, gTex, gWall, gGrad, gPal\]\) box\.appendChild/.test(TL));
ok('16 横向次级标签的样式在页面模板里（.fd-sub-tabs / .off），并且控件那一串名单也收了它（同一档高度只有一处口径）',
  /\.fd-sub-tabs\{/.test(fs.readFileSync('D:/Programs/Flow-Desk/src/_fd/template.html', 'utf8'))
  && fs.readFileSync('D:/Programs/Flow-Desk/src/_shared/sh-look.js', 'utf8').includes('.fd-sub-tabs button'));

/* ---------- 方案分组（作者原话：「方案分组」）---------- */
const LIB = fs.readFileSync('D:/Programs/Flow-Desk/src/_fd/src/fd3-lib.js', 'utf8');
ok('17 分组这一栏三处齐：写文件（fields）、读文件（scheme）、表头那一串',
  LIB.includes("分组:s.分组 || '',") && LIB.includes("分组:n('分组'),") && LIB.includes("'背景图', '分组', '按语言'"));
const sb2 = { console, String, Array, Object, Set, localeCompare:0 };
vm.createContext(sb2);
/* 这两件是对象里的方法写法（setGroup(name, g){…}），搬出来单跑得先补上 function 这个词 */
vm.runInContext('function ' + braceSlice(LIB, '  setGroup(name, g){').replace(/^  /, '') + '\nfunction ' +
  braceSlice(LIB, '  groups(){').replace(/^  /, '') + '\nthis.G = { setGroup, groups };', sb2);
const L2 = { list:[{ 方案名:'甲', 分组:'常用' }, { 方案名:'乙' }, { 方案名:'丙', 分组:'写作' }], saveNow(){ this.saved = (this.saved || 0) + 1; } };
L2.setGroup = sb2.G.setGroup; L2.groups = sb2.G.groups;
const g1 = L2.groups();
ok('18 函数层真跑：groups() 交出「常用 / 写作」两组（空着的不算一组、按中文排），setGroup 给「乙」记上「深夜」后变三组',
  g1.join('|') === '常用|写作' && L2.setGroup('乙', '深夜').ok && L2.groups().join('|') === '常用|深夜|写作', g1.join('|'));
const g2 = L2.setGroup('乙', '  ');
ok('19 归组可以退回不归组：写空白 = 从组里拿出来（不留一个空字串的假组）',
  g2.ok && g2.group === '' && L2.groups().join('|') === '常用|写作');
ok('20 第 2 页有「方案分组」那一行（输入框 + 现成组名当候选 + 归组那个按钮），第 1 页那只下拉的标签带上组名',
  TL.includes("row('方案分组'") && TL.includes('fd-look-grps') && TL.includes("s.分组 ? s.分组 + ' · ' : ''"));

/* ---------- 改名和删一条（第 56 轮报过「已完成」只数到源码，这一轮补真跑）---------- */
vm.runInContext('function ' + braceSlice(LIB, '  rename(from, to){').replace(/^  /, '') + '\nfunction ' +
  braceSlice(LIB, '  remove(name){').replace(/^  /, '') + '\nthis.G2 = { rename, remove };', sb2);
const L3 = () => ({ list:[{ 方案名:'甲' }, { 方案名:'乙' }], cur:'甲', 写盘:0, 上的:null,
  saveNow(){ this.写盘++; }, saveState(){}, apply(r){ this.上的 = r; },
  get(){ return this.list.find(x => x.方案名 === this.cur) || null; },
  rename:sb2.G2.rename, remove:sb2.G2.remove });
const R1 = L3();
const r1 = R1.rename('甲', '  丙  ');
const r1撞 = R1.rename('乙', '丙');
ok('21 函数层真跑：改名把库里那条和正用着的那个名字一起改口（cur ' + R1.cur + '），落盘 ' + R1.写盘 +
   ' 回；撞名那一次不当成功（' + r1撞.msg + '），库里不会出现两条同名',
  r1.ok && r1.name === '丙' && R1.cur === '丙' && R1.list[0].方案名 === '丙' && R1.写盘 === 1 && !r1撞.ok
  && R1.list.map(x => x.方案名).join(',') === '丙,乙');
const r空 = R1.rename('丙', '   ');
const r没 = R1.rename('没这一套', '丁');
ok('22 改名那一步两种不成立的都拦住：名字空着（' + r空.msg + '）、库里没这一套（' + r没.msg + '），拦住的时候一个字不写盘',
  !r空.ok && !r没.ok && R1.写盘 === 1);
const D1 = L3();
const d1 = D1.remove('甲');
ok('23 函数层真跑：删掉的正是在用那一套 → 切到库里剩下的第一条并重铺一遍（cur ' + D1.cur + '、上屏的是「' +
   (D1.上的 && D1.上的.方案名) + '」）、落盘 ' + D1.写盘 + ' 回',
  d1.ok && D1.list.length === 1 && D1.cur === '乙' && !!D1.上的 && D1.上的.方案名 === '乙' && D1.写盘 >= 1, D1.cur + '/' + D1.写盘);
const D2 = L3(); D2.list = [{ 方案名:'只此一套' }]; D2.cur = '只此一套';
const d2 = D2.remove('只此一套');
ok('24 就剩一套时删不掉（外观不能没有方案），交回的那句话是：' + d2.msg, !d2.ok && D2.list.length === 1);

console.log('\n' + pass + ' 过 ' + fail + ' 不过');
process.exit(fail ? 1 : 0);
