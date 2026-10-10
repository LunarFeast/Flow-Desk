/* 外30 丙组 · 图18「连线样式不好看，字样看不清」
   截图那一条是上下排的两个节点（结识白衣 → 夺宝），连线是竖的，「前置」两个字 11 像素、跟线同色、
   正压在线上 —— 线挤成一条细弯，字糊成一团。这一台量两件事：
   ① linkGeom：上下对齐的两头改走直线、字挪到线右边；左右分开的照旧走曲线、字在曲线中点上方
   ② 接线与 CSS：字色回正文色、围一圈画布底色光晕，text-anchor 不许在 CSS 里钉死（钉住就盖掉逐条那一句）
   切的是仓库里那一份原文，一颗不抄。 */
import vm from 'node:vm';
import { rd, 切, 记账 } from './lib-slice.mjs';

const R = 记账('test-linklab');
const W11 = rd('src/_wnw/src/w11-board.js');
const 沙 = { R };
vm.createContext(沙);
vm.runInContext(切(W11, 'linkGeom'), 沙);
const 形 = 沙.linkGeom;

R.题('一、左右分开的两头：照旧那条曲线，字在曲线中点上方');
{
  const g = 形(100, 80, 400, 260);
  R.判('曲线三段控制点还是水平中点（改画法没把老样子改掉）',
    g.d === 'M100 80 C250 80 250 260 400 260', g.d);
  R.判('字摆在中点上方 6 像素、居中（不压在线上）', g.x === 250 && g.y === 164 && g.锚 === 'middle',
    [g.x, g.y, g.锚].join(' / '));
}
R.题('二、几乎上下对齐的两头：走直线，字挪到线右边');
{
  const g = 形(200, 80, 204, 300);
  R.判('两头只差 4 像素横 → 直线一条（不再挤成细弯）', g.d === 'M200 80 L204 300', g.d);
  R.判('字在线右边 7 像素、垂直居中、左对齐（截图那种一团糊就是这么来的）',
    g.x === 209 && g.y === 194 && g.锚 === 'start', [g.x, g.y, g.锚].join(' / '));
  const 界 = 形(200, 80, 223, 300), 外 = 形(200, 80, 224, 300);
  R.判('临界按「不到 24 像素」算：23 走直线、24 走曲线',
    /^M200 80 L/.test(界.d) && /^M200 80 C/.test(外.d), 界.d + ' / ' + 外.d);
}
R.题('三、两头对调不许让字跳位');
{
  const 正 = 形(100, 80, 400, 260), 反 = 形(400, 260, 100, 80);
  R.判('横向那条：字的位置一模一样（中点是对称的）', 正.x === 反.x && 正.y === 反.y, 正.x + ',' + 正.y + ' / ' + 反.x + ',' + 反.y);
  const 竖 = 形(200, 80, 200, 300), 竖反 = 形(200, 300, 200, 80);
  R.判('竖向那条：也一样，而且始终摆在线右边（不是有时左有时右）',
    竖.x === 竖反.x && 竖.y === 竖反.y && 竖.锚 === 'start', [竖.x, 竖.y, 竖反.x, 竖反.y].join(','));
  R.判('完全重合的两头（自己连自己）也算得出来，不出 NaN',
    Number.isFinite(形(150, 150, 150, 150).x) && 形(150, 150, 150, 150).d === 'M150 150 L150 150',
    JSON.stringify(形(150, 150, 150, 150)));
}
R.题('四、接线与 CSS');
{
  R.判('画那条线的一支改走 linkGeom 交回的 d（不再就地拼字符串）',
    /const 形 = linkGeom\(x1, y1, x2, y2\);\s*\n\s*const p = document\.createElementNS\(svg\.namespaceURI, 'path'\);\s*\n\s*p\.setAttribute\('d', 形\.d\)/.test(W11),
    /p\.setAttribute\('d',[^\n]*/.exec(W11)[0]);
  R.判('字的 x / y / text-anchor 三样都逐条取自 linkGeom',
    /tx\.setAttribute\('x', 形\.x\); tx\.setAttribute\('y', 形\.y\)/.test(W11) && /setAttribute\('text-anchor', 形\.锚\)/.test(W11),
    /tx\.setAttribute\('x'[^\n]*/.exec(W11)[0]);
  const 条 = /\.wnw-bd-lab\{[^}]*\}/.exec(W11);
  R.判('CSS 里那一条不再钉 text-anchor（钉住会盖掉元素上逐条那一句，字就永远居中压线）',
    !!条 && !/text-anchor/.test(条[0]), 条 && 条[0]);
  R.判('字色回正文色（从前跟线同色，浅色那条线基本读不出）', !!条 && /fill:var\(--text\)/.test(条[0]), 条 && 条[0]);
  R.判('围一圈画布底色光晕，线从字底下穿过也读得清（paint-order 让描边先铺）',
    !!条 && /paint-order:stroke/.test(条[0]) && /stroke:var\(--page-bg\)/.test(条[0]) && /stroke-width:4px/.test(条[0]),
    条 && 条[0]);
  R.判('字号不再钉死 11 像素（截图那种一团糊）', !!条 && !/font-size:11px/.test(条[0]), 条 && 条[0]);
  R.判('元素上不再设 fill（设了会被 CSS 盖掉，白写一笔）',
    !/tx\.setAttribute\('fill'/.test(W11), /tx\.setAttribute\('class'[^\n]*/.exec(W11)[0]);
}
R.题('五、咬口');
{
  const 坏一 = 切(W11, 'linkGeom').replace('if(Math.abs(x2 - x1) < 24)', 'if(false)');
  const 沙2 = {}; vm.createContext(沙2); vm.runInContext(坏一, 沙2);
  R.判('咬口一：拿掉那一支之后，上下对齐的两头又画成细弯（第二条判法当场失效）',
    /^M200 80 C/.test(沙2.linkGeom(200, 80, 204, 300).d), 沙2.linkGeom(200, 80, 204, 300).d);
  const 坏二 = 切(W11, 'linkGeom').replace('x:mx + 7, y:my + 4, 锚:\'start\'', 'x:mx, y:my - 6, 锚:\'middle\'');
  const 沙3 = {}; vm.createContext(沙3); vm.runInContext(坏二, 沙3);
  const g = 沙3.linkGeom(200, 80, 200, 300);
  R.判('咬口二：竖线那一支的字若还居中，就又回到线上（截图那一团糊），量到 x=' + g.x + ' 锚=' + g.锚,
    g.x === 200 && g.锚 === 'middle', [g.x, g.y, g.锚].join(','));
}
R.收尾();
