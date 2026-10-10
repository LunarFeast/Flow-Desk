/* ============================================================
   外观这一层 · Flow-Desk / 为写 / 声笔输入法练习 共用一份
   ----------
   两件事各管各的，不许互相顶：
     · 配色 —— 各色号定在色卡里，由 fd3-shell.js 那一头写进 --page-bg / --card-bg / --accent 这些变量
     · 外观模式 —— 只管边框、阴影、边界线、发光：纯平 / 无界 / 辉光 / 质感
   卡片底只有一档，不用再选：实色。2026-10-04 把拟液态玻璃 / 凝态 / 霜态 三档玻璃连同
   「真液态对比」那个折射开关一并撤了（第 1 条那句「这也叫玻璃？」），界面上材质那一行整行不摆。
   卡片因此完全不透 —— 底下铺了图片壁纸时，画面只在卡片外面那片空处露着，卡面里透不出东西。
   辉光那一档在浅色配色上只画强调色那圈细边框，外发光和标题光晕不画：浅底上它会糊成一片。
   ----------
   一处说在明处的例外，免得以后又被当成越界：
     · 卡面往墨色掺（--card-ink）：这一趟既不是配色也不是模式，是外观这一层给
       「卡片」和「摆在卡片上的控件」之间分边界用的 —— 配色派生出来的输入框底、按钮底、分段选择的槽
       都是从卡面色号往外一点点混出来的，实测 54 套配色 × 4 档外观模式 ×（无纹理 / 纹理 40）
       这 432 个组合里，这三样跟卡面的对比没有一个够得上条款要的那 3:1（都在 1.x 那一档）。卡面整体往墨色收 20%，
       控件那几块（各自独立算出来的）就相对亮出来了，一层结构就把边界分出来，不用描第二圈厚边。
       方向和它本来该做的「透出底下画面」相反：往卡面上盖一层色是往外推，这一路是往回收（浅底收暗），
       同向就把卡面推向槽色那个方向，边界反而更窄。
       掺多少写死在 LOOK_INK 一处（两底都 20%）。
       掺的方向 2026-10-05 改过一次：从前浅底掺纯黑 / 深底掺纯白，会把带色相的卡面
       （浅蓝 / 浅米 / 浅薄荷）一起拖成灰 —— 蓝精灵那套界面整套发灰就是这么来的。
       外13-A 起这一条归到配色引擎那边、跟着「识别方案」切换（函数是 sh-color.js 的 CV.cardInk）：
       甲案按 --card-bg 同色相推一档明度（浅底 -25% L / 深底 +25% L），色相留着，
       卡面本来就是中性色（S=0）那几套推完还是中性色，结果和从前一致；
       乙 / 丙 / 丁三案退回纯黑 / 纯白。readable() 只负责把算好的那个色号写出去。
       20% 这一档换来的是「卡面 vs 控件」分开，但那条 1px 细边的对比不能只靠它：
       白色卡面掺 20% 是 #cccccc，压在它上面的输入框底（再往白掺 85%）约 #e5e5e5，两者只有 1.6 ——
       所以控件边界那 3:1 由 --ctl-edge 那一条细边自己扛（见 readable 那一段），卡面掺墨只是把整体层次拉开。
   ----------
   做法：模式算成一串 CSS 变量，由宿主写在根元素上（在配色变量之后写，才盖得住）；
   宿主的卡片样式吃这几个变量就行，不各自发明一套。三个宿主共用这一份，长相不会一端一个样。
   纹理由来：自己往图片库导一张、用途写「纹理·四方连续图」（data\images.yaml），铺上去就是原图；
   要它只当无色材质就用「去色」那一档，两档都在这一个文件里定，不在样式表里各写一套。
   ----------
   深浅两套数：底色往白掺还是往黑压、辉光那两档影子的浓度，都分深浅。
   判定只看一对 WCAG 相对亮度：根元素上已经写好的 --page-bg 和 --text，
   字比底亮就是黑暗系、字比底暗就是明亮系（规则在 sh-color.js 的 mingDark 里，
   外13-A 起不再拿「背景自己的亮度对不对得上一个门槛」当判定）。
   两个读数挨得太近、这一对分不出明暗时不硬判：这时退回背景自己的那条老规则，
   而且外观这一层只用来挑深浅两套数 —— 真站不站得住由配色那一头的对比下限自检说了算。
   标记由这一份自己打，钉成 data-dark，三家都不用各自记得钉（从前只有 Flow-Desk 钉，另两家掉回浅底那一套）。
   ----------
   影子的大小跟被投影的那一块自己走：三档高度的偏移和模糊全乘 var(--ck)。
   Flow-Desk 摆卡片时按这一张占几行几列钉一个 --ck，小卡就不顶着大晕；
   别处不钉，默认 1。
   ----------
   宿主契约（三家一样）：
     1) 配置串 cfg = { mode:外观模式, tex:纹理名 }，
        住在外壳的外观方案里（Flow-Desk 那边是 data\looks.yaml 的一条），三家读同一套字段名。
        纹理强度那一路（旧字段 texOn）2026-10-08 整串撤了：图上不叠透明度，原图进。
     2) 开机和改动时各调一次 Look.apply(cfg)：它把变量和 data-mode / data-tex / data-dark
        写到根元素上，这一句必须排在配色那一系列变量之后。
     3) 样式表由本文件自己注入（id 是 fd-look-style），宿主不要再写一遍卡片底，也不要把影子写死。
     4) 纹理图地址由 Ico 给（图片库里那一张在表里叫 images-<文件名>）；
        读不到那一张时纹理自动不上，其余照旧。
     5) 卡面掺墨之后底下那块面换了色 —— 配色算对比度时按配色里那张原始卡面算的数会失真。
        这一份出 Look.readable(tokens, cfg)：算出真正压在字底下那块面（卡面掺墨 20% 的那一块），
        读不动的文字色由它推回来，
        顺带把那块面本身（--face-solid）、控件那条 3:1 细边（--ctl-edge）、
        日程条的浅色填充和色位圆点（--slot-N-bar / --slot-N-bar-text / --slot-N-dot）一起算出来。
        谁引入的问题谁补：这是掺墨引入的，所以复检放在这一头，配色那一份只管原始卡面那一档下限。
        宿主想自己调就调在 apply 之前，把返回的那一组色号一起写到根元素上（Flow-Desk 走的就是这一条）；
        忘了调也不漏：apply 会先从根元素上把配色那几项现读回来补一遍同样的数（readableFromRoot），
        推的规则是「够数就不动」，调过两遍还是同一个色号，不会越推越深。
        为写和声笔输入法练习拼在同一张页里，吃的是宿主这一趟钉好的那一套，不再各自往根元素钉第二遍。
     6) 卡片一律实色，底下有没有铺画面都不影响这一块面，所以这一份不读 data-wall。
        壁纸仍然归 Flow-Desk 那一头钉（根元素上 data-wall 那一个值管的是 #wall 那一层），
        它只在卡片外面那片空处露着。
   ============================================================ */

/* ---------- 卡片底：只有实色这一档 ----------
   2026-10-04 撤掉的三样：拟液态玻璃 / 凝态 / 霜态 三档（连带各自的透、糊、饱和、彩色薄膜、白化、
   边缘那圈 1.5px 亮边），和「真液态对比」那一个折射开关（SVG 位移滤镜）。
   留下来的卡面就一个算法：配色里那张卡往墨色掺 LOOK_INK，掺完就是字坐在上面的那块面。
   深浅两个方向由 vars() 按 data-dark 挑（浅底收暗、深底提亮），墨色本身由 CV.cardInk() 按当前
   选的「识别方案」算（甲：同色相推一档明度；乙 / 丙 / 丁：纯黑 / 纯白）—— 见文件顶上那条例外。 */
const LOOK_INK = 20;

/* ---------- 外观模式：边框、阴影、边界线、发光 ----------
   四档各自只动这几样，卡片底色一律不碰（那是配色管的，掺墨那一趟由这一份算，见文件顶上那条例外）。
   bw 给到 1px 的有两档：纯平那道线看得见（边框色是文字色 18%），无界那道线几乎看不见（8%）——
   两档都不是「什么都不画」，区别在线的轻重；卡片之间的分别仍然交给空处。
   2026-10-04 撤掉浮雕那一档（一明一暗两道影子、整页换成页面底、输入框和槽凹进去那套）：
   存档或别的程序播过来的配置里写着 emboss 的，lookMode() 认不出就落回默认那一档（质感）。 */
const LOOK_MODES = [
  { k:'material', name:'质感', border:'none', bw:0, shadow:'lift',  tip:'不画边框，靠一层环境影加一层投影分高低；一行、一张卡、一个浮层各一档。' },
  { k:'glow',     name:'辉光', border:'glow', bw:1, shadow:'glow',  tip:'一圈霓虹描边加外发光，标题带一点光晕；静态光晕最多两层、不超过 20px；浅色底只画那圈描边，发光和光晕不画，会糊成一片。' },
  { k:'flat',     name:'纯平', border:'line', bw:1, shadow:'none',  tip:'一道细边框把卡片和控件圈出来，没有投影也没有发光，层次只靠底色深浅分。' },
  { k:'bare',     name:'无界', border:'line', bw:1, shadow:'none',  tip:'什么都不画，只留一根几乎看不见的分隔线，其余交给空处。' },
];
/* ---------- 纹理：一张平铺小图反复贴 ----------
   预设那 11 张（纸质 5 + 布质 6，原先住在 icons\textures\）2026-10-08 按作者的话整批撤干净：
   「删除当前所有预设纹理，删除纹理强度系列设置」—— 图文件、那份清单（data\textures.yaml）、
   那一格（data\textures\）、开发服务器上的 /_tex 那一条，全不在程序里了。
   现在纹理只有一条来路：他自己往图片库（data\images.yaml）导一张，用途写「纹理·四方连续图」。 */
/* ---------- 图片库里当纹理用的那几张 ----------
   图标那一层（sh-ico.js）把 data\images\ 扫成「images-<文件名>」那一张表，
   所以这一份只记两样：
     k    = 去掉后缀的物理文件名（导进来那一步现生成的，只用英文数字，撞不上名）
     name = 界面上那一个名字（他自己写的中国话，比如「水磨石」）
   名单由 Flow-Desk 那一份图片清单（data\images.yaml）认好之后递进来（lookTexSet）：
   外观层只管「有哪几档纹理可使」，不读文件、不认 YAML，来源那条路归页面。
   图上不再叠透明度：挑上就是原图进（作者定的两种走法之一，另一种「去色」归方案编辑那一页）。 */
let CUSTOM_TEX = [];
function lookTexSet(list){
  CUSTOM_TEX = (Array.isArray(list) ? list : []).filter(t => t && t.k && t.name)
    .map(t => ({ k:String(t.k), name:String(t.name) }));
}
/* 按内部 key 认一条 */
function lookTex(k){ return CUSTOM_TEX.find(t => t.k === k) || null; }
/* 按界面上那一个名字认一条。从前只有内置那一批认得到，
   自己导入的那一张挑上了就是「文件里写着名字、屏幕上什么都不铺、也不告诉你」—— 那一手早就改了，现在只有这一批。 */
function lookTexName(n){ return CUSTOM_TEX.find(t => t.name === n) || null; }
/* 从前这里还有一条 lookTexGroups()（下拉按「内置 / 自己导入」分组摆）：预设那批撤了、
   下拉又改成直接吃图片库那份清单（fd3-lib.js 的 ImgLib.byUse），这一条就没人走了（外29 丁组撤干净）。 */
function lookMode(x){ return LOOK_MODES.find(t => t.k === x) || LOOK_MODES[0]; }
/* 这一档默认吃什么：没存过外观时的样子 */
const LOOK_DEFAULT = { mode:'material', tex:'' };

/* ============================================================
   壁纸那两层：模糊 + 压暗提亮（外13-R D3-b）
   ----------
   两根滑杆的上限不同，是因为两张图铺法不同：
     普通图片 —— 一张图铺满整屏（居中裁切），模糊是把图里那些"太花、字读不动"的细节抹掉，
                 0~24 像素滑杆走满；
     四方连续 —— 一张小图平铺 N 次糊一整屏，糊过头整屏就没细节了，所以只给 0~6 像素。
   压暗 / 提亮 0~30：出厂那两档就是从前 CSS 里写死的 6%（深底压黑）/ 14%（浅底提白），
   方向仍然由这套配色的明暗自己定，用户能调的只有深浅；这一层只压在壁纸上，
   纯色和渐变不经过它 —— 那两档的对比已由 readable() 按未压过的页面底算过，
   再罩一层调子就等于拿一套没参与计算的数去量字。
   ----------
   糊之前这一层往四周各放大一点：CSS 的 blur 会把画面往里"啃"掉约一个影响半径，
   层边缘就会露出一条没糊的底色。放大量取 max(8, 半径 × 3)。 */
const LOOK_WALL_BLUR = { min:0, max:24 };
/* 从前还有一档 LOOK_TILE_BLUR（四方连续壁纸顶 6 像素）：2026-10-08 纹理和四方连续图并成一档，
   那一层不再是「壁纸的一种」，而是铺在好几块面上的材质，糊这一档就归背景那一根滑杆。 */
const LOOK_TINT = { min:0, max:30, dark:6, light:14 };
/* 去色那一档给这一层让出来的比例：灰纹留 45%，底下的色透 55% 上来。
   这一条不是从前那根「纹理强度」滑杆（那根 2026-10-08 整串撤了，用户不再调透明度）——
   它是「去色」这一档自己的画法，两档之间没有中间值，所以钉成一个数写在根上。 */
const LOOK_TEX_GRAY = .45;
function lookClamp(v, lo, hi){
  const n = +v;
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo;
}
function lookWallPad(blur){ return Math.max(8, Math.round(blur * 3)); }
/* 这一层该铺在哪一层上：由 背景 那一档决定，图没选就不铺（回 solid 由 apply() 兜）。
   从前这里还认 'tile'（四方连续当壁纸那一档）—— 2026-10-08 作者把纹理和四方连续图定成同一样东西，
   那一档从背景这一排里退出去了，屏幕上要铺纹理就用 --tex-* 那一串（它会连背景一起铺）。 */
function lookWallLayer(cfg){
  const w = (cfg && cfg.wall) || 'solid';
  return w === 'image' ? w : '';
}

/* ============================================================
   最小格位：四方连续壁纸 / 无缝纹理「一张占几 × 几格」（外13-R D3-c）
   ----------
   只有会平铺的两种东西才谈格位 —— 普通图片壁纸是一张图铺满整屏（居中裁切），
   没有"一张占几格"这回事。
   为什么用格子当单位：首页是 64 × 36 的栅格（fd3-shell.js 的 GRID_COLS / GRID_ROWS），
   在 16:9 的画幅下格子正好是正方形，于是一张图的最小可放单位就等于它的比例本身：
     1:1  → 1 × 1 = 一格
     4:3  → 4 × 3 = 十二格
     16:9 → 16 × 9 = 一百四十四格
   要放大只能按整数倍往上（4:3 可以放成 8×6、12×9……；16:9 可以放成 32×18、48×27……），
   倍数的顶 = 放到铺满整屏那一档为止（64 格宽 / 36 格高）。
   界面因此只写「一张占几 × 几格」，不写缩放百分比 —— 百分比说不清"占几格"这件事。
   ----------
   比例约分：先按真公约数约（1920×1080 → 16×9）；约完还剩大数的（800×533 这种随手截的图）
   退一步，在 18 以内找一个最接近的整数比。 */
const TILE_CELL_MAX_DEN = 18;
function lookGcd(a, b){ return b ? lookGcd(b, a % b) : a; }
function lookAspectCells(w, h){
  if(!(w > 0 && h > 0)) return { w:1, h:1 };
  const r = w / h;
  const g = lookGcd(Math.round(w), Math.round(h)) || 1;
  const a = Math.round(w / g), b = Math.round(h / g);
  if(a <= TILE_CELL_MAX_DEN && b <= TILE_CELL_MAX_DEN) return { w:a, h:b };
  let best = { w:Math.max(1, Math.round(r)), h:1 }, err = Math.abs(best.w / best.h - r);
  for(let y = 2; y <= TILE_CELL_MAX_DEN; y++){
    const x = Math.max(1, Math.round(r * y));
    const e = Math.abs(x / y - r);
    /* 严格更好才换：同样的误差留住分母更小的那一档（4:3 而不是 8:6） */
    if(e < err - 1e-9){ err = e; best = { w:x, h:y }; }
  }
  return best;
}
/* 从基准那一档往上能放的倍数：放到不超过整屏栅格（64 × 36）为止，至少留 1× */
function lookCellSteps(base){
  const cols = (typeof GRID_COLS === 'number' && GRID_COLS) || 64;
  const rows = (typeof GRID_ROWS === 'number' && GRID_ROWS) || 36;
  const n = Math.max(1, Math.min(Math.floor(cols / base.w), Math.floor(rows / base.h)));
  const out = [];
  for(let i = 1; i <= n; i++) out.push({ w:base.w * i, h:base.h * i });
  return out;
}
/* 占几 × 几格 → background-size：拿栅格那两个现成的变量（--cw / --ch，fitGrid 每次排版都重写），
   所以窗口怎么拉，一张图的格位都跟着走，不需要这里再量一次屏幕。 */
function lookTileSize(cell){
  if(!cell || !(cell.w > 0) || !(cell.h > 0)) return 'auto';
  return 'calc(var(--cw,30px) * ' + cell.w + ') calc(var(--ch,30px) * ' + cell.h + ')';
}

/* ============================================================
   背景渐变的五种形状（外13-R D3）
   ----------
   规则的真身在《配色原则与渐变规则》第二节，这一份是它的机器版；两处要改必须一起改。
   分型只问三件事，三件都能从配色引擎已经派生出来的那几个色号现读，不问「好不好看」：
     带彩度的锚几个 —— 页面底 / 卡面 / 主强调 / 次强调这四个位置上饱和度 ≥ GRAD_SAT 的有几个
     色相跨度       —— 那几个彩色之间最大的色相角距（折到 0~180°）
     明度跨度       —— 卡面和页面底差几个明度点（卡片「浮起来多少」靠的就是这个数）
   判定按先后次序走，前面先命中（文档里那张七行的表，这里一个都不改）。
   ----------
   两条硬规矩写在函数里，不留在文档里：
     1) 每一个停靠点只取自这套色彩已经派生出来的色号（页面底 / 卡面 / 主强调 / 次强调 / 五个色位 /
        现有那两个渐变空处 --wall-a --wall-b），外加「页面底往明暗方向挪几个明度点」——
        那还是同一个色号在挪明度，不是凭空多出来的第四个颜色；
     2) 渐变不许把这套配色的明暗结论翻面。每一个停靠点都拿 mingDark(那一点, 正文) 复核一次，
        结论和页面底相反的就往页面底那一头收回来（每收一成复算一次），收到一致或收到判不出为止；
        两头都收不住的（掺的都是现成色号，实际到不了这一步）就直接落在页面底上。
   ----------
   这一份不算 data-wall：它只交出「该画哪一条渐变」，什么时候画由 Flow-Desk 那一头钉（见文件顶部那条分工）。
   纯函数，不碰 DOM —— 数值自检（look-check.mjs）在 node 里跑的是同一份。
   ============================================================ */
const GRAD_SAT = .18;                 /* 「带彩度」那条线：和丙 · 双锚插值一直在用的同一条，不新发明 */
const GRAD_KINDS = [
  { k:'luma',    name:'明度微渐',     tip:'只往明暗走，一点不引入新色相；卡面不参与。' },
  { k:'family',  name:'同族二档线性', tip:'两个同族色相排一条线，页面底往主强调掺一点。' },
  { k:'accent',  name:'强调牵引',     tip:'起点带一点强调色的浅染，中段往明暗偏，终点收到卡面。' },
  { k:'radial',  name:'双色相径向',   tip:'色相跨到 60° 以上，排成直线就成了彩虹带 —— 改成从一角往外散的光。' },
  { k:'diffuse', name:'弥散',         tip:'四个锚全带彩度（或色相互补），任何方向都不成立，只能散成团。' },
  { k:'none',    name:'不给渐变',     tip:'这套连深浅都没结论（或者明度也拉不开），分层交给卡片外框。' },
];
const gradDef = k => GRAD_KINDS.find(x => x.k === k) || GRAD_KINDS[GRAD_KINDS.length - 1];
/* 可调项的默认值和上下限：界面上的滑杆行程按这一张表摆，读回来的数也按这一张表夹 */
const GRAD_DEFAULT = { angle:150, lumaSpan:6, famMix:8, famStop:68, accMid:58, accEnd:true,
  radSpan:90, radHue2:8, blobR:20, blobMix:14 };
const GRAD_RANGE = { angle:[0,360], lumaSpan:[1,6], famMix:[6,12], famStop:[50,85], accMid:[35,70],
  radSpan:[60,120], radHue2:[0,8], blobR:[10,22], blobMix:[8,20] };
/* 径向那五档圆心：默认左上 = 卡片密度最高的那一角 */
const GRAD_CENTERS = [{ v:'tl', t:'左上', css:'top left' }, { v:'tr', t:'右上', css:'top right' },
  { v:'bl', t:'左下', css:'bottom left' }, { v:'br', t:'右下', css:'bottom right' }, { v:'c', t:'正中', css:'center' }];
/* 弥散的团摆在四个象限的中心（左上 / 右上 / 左下 / 右下），挑三到四个 = 团数 */
const GRAD_QUADRANTS = [{ t:'左上', x:25, y:25 }, { t:'右上', x:75, y:25 }, { t:'左下', x:25, y:75 }, { t:'右下', x:75, y:75 }];

/* 可调项归一：界面上写得出去、手工也改得了，读回来一律夹回区间；认不得的落回默认 */
function gradTune(cfg){
  const c = (cfg && cfg.grad) || {};
  const t = {};
  for(const k in GRAD_RANGE){
    const r = GRAD_RANGE[k], v = +c[k];
    t[k] = isFinite(v) ? Math.max(r[0], Math.min(r[1], Math.round(v))) : GRAD_DEFAULT[k];
  }
  t.accEnd = c.accEnd === undefined ? GRAD_DEFAULT.accEnd : !!c.accEnd;
  t.radCenter = GRAD_CENTERS.some(x => x.v === c.radCenter) ? c.radCenter : 'tl';
  /* 去重后不足三团就整串落回默认：文档钉的硬规矩是「最多四团」，而这一档存在的理由就是
     团少、团大、彼此分得开 —— 一团两团的「弥散」不是弥散，是另一个形状，不该由这一档出。 */
  const bs = [...new Set((Array.isArray(c.blobs) ? c.blobs : []).map(x => Math.round(+x)).filter(x => x >= 0 && x <= 3))];
  t.blobs = bs.length >= 3 ? bs.slice(0, 4) : [0, 1, 2];
  return t;
}

const gradHex = v => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim())) ? v.trim().toLowerCase() : '';
/* 几个色相角之间的最大角距，折到 0~180° */
function gradHueGap(hues){
  let g = 0;
  for(let i = 0; i < hues.length; i++) for(let j = i + 1; j < hues.length; j++){
    const d = Math.abs(hues[i] - hues[j]) % 1;
    g = Math.max(g, Math.min(d, 1 - d) * 360);
  }
  return g;
}
/* 三个跨度 + 明暗结论，一次读完交给判定和自检用 */
function gradRead(tokens){
  const t = tokens || {};
  const anchors = ['--page-bg', '--card-bg', '--accent', '--accent2'].map(k => gradHex(t[k])).filter(Boolean);
  const hsl = anchors.map(h => CV.hslOf(h));
  const chroma = hsl.filter(x => x[1] >= GRAD_SAT);
  const page = gradHex(t['--page-bg']) || '#ffffff';
  const card = gradHex(t['--card-bg']) || page;
  const text = gradHex(t['--text']) || '';
  const base = text ? mingDark(page, text) : '';
  return { page, card, text, anchors, k:chroma.length,
    dH:gradHueGap(chroma.map(x => x[0])),
    dL:Math.abs(CV.hslOf(card)[2] - CV.hslOf(page)[2]) * 100,
    base, dark:base === 'dark' };
}
/* 判定先后：文档那张表的次序，前面的先命中 */
function gradKindOf(sp){
  if(!sp.base) return 'none';
  if(sp.k <= 1 && sp.dL < 2) return 'none';
  if(sp.k >= 4 || sp.dH >= 180) return 'diffuse';
  if(sp.k >= 2 && sp.dH >= 60) return 'radial';
  if(sp.k >= 3 || (sp.k === 2 && sp.dH >= 30)) return 'accent';
  if(sp.k === 2) return 'family';
  return 'luma';
}
/* 五个色位里和主强调色距最大、且自己带彩度的那一个（径向档的第二色相族） */
function gradFarSlot(tokens, sp){
  const ah = CV.hslOf(gradHex(tokens['--accent']) || sp.page)[0];
  let best = '', gap = 0;
  for(let i = 1; i <= 5; i++){
    const c = gradHex(tokens['--slot-' + i]);
    if(!c || CV.hslOf(c)[1] < GRAD_SAT) continue;
    const d = Math.abs(CV.hslOf(c)[0] - ah) % 1;
    const g = Math.min(d, 1 - d) * 360;
    if(g > gap){ gap = g; best = c; }
  }
  return gap >= 30 ? best : '';
}
/* 明暗不许翻面：这一点和页面底的结论相反就往页面底收，每收一成复算一次 */
function gradHold(color, sp){
  for(let i = 10; i >= 0; i--){
    const c = i === 10 ? color : CV.mix(sp.page, color, i / 10);
    const g = sp.text ? mingDark(c, sp.text) : '';
    if(!g || g === sp.base) return c;
  }
  return sp.page;
}
/* 弥散那几团取哪些色：主强调、次强调、五个色位里带彩度的那几个（去重），不新造 */
function gradBlobColors(tokens, sp){
  const out = [];
  for(const c of ['--accent', '--accent2', '--slot-1', '--slot-2', '--slot-3', '--slot-4', '--slot-5']
    .map(k => gradHex(tokens[k])).filter(Boolean)){
    if(!out.includes(c) && CV.hslOf(c)[1] >= GRAD_SAT) out.push(c);
  }
  return out.length ? out : [sp.dark ? CV.mix(sp.page, '#ffffff', .1) : CV.mix(sp.page, '#000000', .1)];
}

/* ---------- 交回这一档的画法：停靠点 + 一条能直接写进 background-image 的值 ----------
   linear / radial 吃 stops（停靠点会被明暗那条复核），diffuse 自己拼多层 radial-gradient。 */
function gradDraw(kind, tokens, sp, t){
  const stops = [];
  /* 不给渐变这一档画不出东西，也不该画：早退，别往下拼成一条空停靠点的 gradient() ——
     那种值写进 CSS 是整条声明作废，界面上「自动判成不给渐变」的那套配色就变成背景什么都不铺。 */
  if(kind === 'none') return { kind, image:'', stops:[sp.page] };
  if(kind === 'luma'){
    /* 两端都在页面底的族里：另一端就是页面底往「该档深浅方向」挪 t.lumaSpan 个明度点那一个色号，卡面不参与 */
    stops.push([sp.page, 0], [CV.adjust(sp.page, (sp.dark ? 1 : -1) * t.lumaSpan / 100, 1), 100]);
  } else if(kind === 'family'){
    const full = CV.mix(sp.page, gradHex(tokens['--accent']) || sp.page, t.famMix / 100);
    stops.push([sp.page, 0], [CV.mix(sp.page, full, .5), t.famStop], [full, 100]);
  } else if(kind === 'accent'){
    /* 就是从前界面里那一条：起点带一点强调的浅染（--wall-a），中段往明暗偏（--wall-b），
       终点收到卡面 —— 收尾和卡片接上，卡片像是从背景里浮出来的。关掉那一档就两端都在页面底的族里。 */
    const a = gradHex(tokens['--wall-a']) || sp.page, b = gradHex(tokens['--wall-b']) || sp.page;
    stops.push([a, 0], [b, t.accMid], [t.accEnd ? sp.card : sp.page, 100]);
  } else if(kind === 'radial'){
    const near = CV.mix(sp.page, gradHex(tokens['--accent']) || sp.page, .12);
    const far = gradFarSlot(tokens, sp);
    const mid = (far && t.radHue2 > 0) ? CV.mix(sp.page, far, t.radHue2 / 100) : sp.page;
    stops.push([near, 0], [mid, 55], [sp.page, 100]);
  }
  if(kind !== 'diffuse'){
    const list = stops.map(s => [gradHold(s[0], sp), s[1]]);
    const at = list.map(s => s[0] + ' ' + s[1] + '%').join(', ');
    const cs = GRAD_CENTERS.find(c => c.v === t.radCenter) || GRAD_CENTERS[0];
    const img = kind === 'radial'
      ? 'radial-gradient(circle ' + t.radSpan + 'vw at ' + cs.css + ', ' + at + ')'
      : 'linear-gradient(' + t.angle + 'deg, ' + at + ')';
    return { kind, image:img, stops:list.map(s => s[0]),
      geom:{ kind, angle:t.angle, center:cs.v, radiusVw:t.radSpan / 100,
        stops:list.map(s => ({ c:s[0], at:s[1] / 100 })) } };
  }
  /* 弥散：底色仍是页面底，上面叠三到四团大半径柔色斑。
     硬约束三条（文档第二节第五档）钉在这里，不给滑杆越过去：
       最多四团（blobs 夹到 3~4）；每团直径不超过视宽 45% → 半径顶到 22.5vw，滑杆的顶就是 22；
       两团中心之间不少于视宽 25% → 四团只摆四个象限的中心，横竖各差 50vw/50vh，天生过这一条。 */
  const cols = gradBlobColors(tokens, sp);
  const layers = t.blobs.map((q, i) => {
    const c = gradHold(cols[i % cols.length], sp);
    const g = GRAD_QUADRANTS[q];
    return { x:g.x / 100, y:g.y / 100, rVw:t.blobR / 100, fade:t.blobR / 100 * (100 - t.blobR) / 100,
             c:CV.mix(sp.page, c, t.blobMix / 100) };
  });
  return { kind, image:layers.map(L => 'radial-gradient(circle ' + Math.round(L.rVw * 100) + 'vw at ' +
      Math.round(L.x * 100) + '% ' + Math.round(L.y * 100) + '%, ' + L.c + ' 0%, ' +
      'rgba(' + CV.hexRgb(sp.page).join(',') + ',0) ' + Math.round(L.fade / L.rVw * 100) + '%)').join(', '),
    stops:layers.length ? cols.slice(0, layers.length) : [sp.page],
    geom:{ kind, page:sp.page, blobs:layers } };
}

/* ---------- 渐变上某一点是什么色号 ----------
   文档第三节那两处要按「卡片正下方那一点」量、壁纸糊完那一次复核要按 16×9 取平均，
   两边都得问得出「屏幕这一处的渐变是什么色号」，所以这里按 gradDraw 交回来的那一份几何算回去：
   不去解析已经写进 CSS 的那一条字符串（浏览器怎么插值不归自检管，自检只要同一把尺），
   也不在这儿再拼一份画法 —— 停靠点和几何是同一趟算出来的，画在屏上的和拿来量的不会是两套色。
   x / y 是窗口内的相对位置（0 = 左 / 上，1 = 右 / 下），W / H 是窗口宽高像素；
   径向和弥散那两档的半径按 vw 换成像素，和 CSS 里那一条一致。 */
function gradStopsAt(stops, f){
  if(!stops || !stops.length) return '';
  if(f <= stops[0].at) return stops[0].c;
  for(let i = 1; i < stops.length; i++){
    if(f <= stops[i].at){
      const a = stops[i - 1], b = stops[i];
      const k = b.at === a.at ? 0 : (f - a.at) / (b.at - a.at);
      const ar = CV.hexRgb(a.c), br = CV.hexRgb(b.c);
      return CV.rgbHex(ar.map((v, j) => Math.round(v + (br[j] - v) * k)));
    }
  }
  return stops[stops.length - 1].c;
}
function gradColorAt(g, W, H, x, y){
  if(!g || g.kind === 'none') return '';
  if(g.kind === 'diffuse'){
    /* CSS 那条 background-image 列表里写在最前面的那一层画在最上面，所以从数组尾巴往回叠 */
    let cur = g.page;
    for(let i = g.blobs.length - 1; i >= 0; i--){
      const b = g.blobs[i];
      const d = Math.hypot(x * W - b.x * W, y * H - b.y * H);
      const a = 1 - d / (b.fade * W);
      if(a > 0) cur = CV.mix(cur, b.c, Math.min(1, a));
    }
    return cur;
  }
  if(g.kind === 'radial'){
    const cs = { tl:[0, 0], tr:[W, 0], bl:[0, H], br:[W, H], c:[W / 2, H / 2] }[g.center] || [W / 2, H / 2];
    const f = Math.hypot(x * W - cs[0], y * H - cs[1]) / Math.max(1, g.radiusVw * W);
    return gradStopsAt(g.stops, Math.min(1, f));
  }
  const A = g.angle * Math.PI / 180, dx = Math.sin(A), dy = -Math.cos(A);
  const L = Math.abs(W * dx) + Math.abs(H * dy);
  return gradStopsAt(g.stops, ((x * W - W / 2) * dx + (y * H - H / 2) * dy) / L + .5);
}
/* 16×9 网格采样：第三节第一条那条「任何一点都不许把明暗结论翻过去」就是拿这一串点数出来的，
   壁纸那一条「糊完按 16×9 取平均得一个等效底」也复用同一把尺。 */
function gradGrid(g, W, H, nx, ny){
  const out = [];
  for(let j = 0; j < (ny || 9); j++)
    for(let i = 0; i < (nx || 16); i++)
      out.push(gradColorAt(g, W, H, (i + .5) / (nx || 16), (j + .5) / (ny || 9)));
  return out.filter(Boolean);
}

const Look = {
  /* ---------- 归一 ----------
     认不出的档位（存档里那条老配置、或者别的程序播过来写着已撤掉的浮雕那一份）由 lookMode() 落回默认那一档。
     纹理不跟着退：那张平铺小图谁都不归谁管，实色卡片铺一层宣纸正是纸感。 */
  eff(cfg){
    const mode = lookMode(cfg && cfg.mode);
    return { mode, ink:LOOK_INK, tex:String((cfg && cfg.tex) || ''),
      /* 纹理怎么用：去色 = 只当无色材质，颜色由这套配色供（样式表里那两下见 apply() 末尾） */
      texGray:!!(cfg && cfg.texGray) };
  },
  /* ---------- 这套配色是深底还是浅底 ----------
     口径（外13-A）：认的是「底」和「正文」那一对 WCAG 相对亮度 —— 字比底亮算深底、字比底暗算浅底，
     不是拿背景自己的绝对亮度去对一个阈值（那一条在中明度的底上会猜反，整套派生跟着走偏）。
     两处现读：根元素上已经写好的 --page-bg 和 --text（配色那一趟刚写完，紧接着轮到这一份）。
     两头都勉强（亮度差不到 .02）、判不出结论时，退回背景绝对亮度那一条老规则挑一套数 ——
     这里只是「挑深浅两套公式」，不是给这套配色下明暗结论，结论在配色文件和界面那两处走 mingDark。
     读不到色号时退回看宿主自己钉过的 data-dark，再读不到当浅底算。 */
  dark(root){
    const el = root || (typeof document !== 'undefined' && document.documentElement);
    if(!el) return false;
    const read = k => {
      let v = '';
      try{ v = (el.style && el.style.getPropertyValue(k)) ||
               (typeof getComputedStyle === 'function' ? getComputedStyle(el).getPropertyValue(k) : ''); }catch(e){}
      return String(v || '').trim();
    };
    const page = read('--page-bg');
    if(page && typeof CV !== 'undefined') return this.darkOf(page, read('--text'));
    try{ if(el.dataset && el.dataset.dark) return el.dataset.dark === '1'; }catch(e){}
    return false;
  },
  /* 纹理图地址：由 Ico 那张表给（图片库里那张念作 images-<文件名>，换图不用重启）。
     传进来的名字先换成清单上那一个英文名：界面上挑的是中国话那一个（水磨石），
     文件躺在盘上叫 img-lz8k2.png —— 拿中文名去拼拼不出来，
     从前就是这样一直铺不上那张平铺小图（名字传得过去、图是空的，还不报错）。
     传进来本来就是英文名（老存档里那种）照旧认。
     图标那一层住在同一张页的 sh-ico.js 里，这一段整页只有一份，直接读它 —
     从前声笔输入法练习在另一个窗口里、够不着这份 const，才另挂过一句窗口上的口子；
     独立那一页退了，那一口子跟着撤。 */
  url(k){
    if(!k) return '';
    let key = String(k);
    if(!lookTex(key)){
      const t = lookTexName(key);
      if(t) key = t.k;
    }
    try{
      if(typeof Ico !== 'undefined' && Ico.url) return Ico.url('images-' + key) || '';
    }catch(e){}
    return '';
  },
  /* ---------- 背景渐变：这一套配色该走哪一档、那一档怎么画 ----------
     传进来的 tokens 是配色那一趟刚派生完（含 Look.readable 复检）的那一串，不是草稿。
     存档里 grad.kind 写「auto」就由这套配色自己认；写了别的就是用户改口指定那一档 ——
     指定的那一档一样要过明暗那条复核（gradDraw 里逐点收），所以改口不会把深浅翻面。
     回 { kind, name, image, auto, spans }：image 空 = 不给渐变（那一档本来就不画）。 */
  grad(tokens, cfg){
    if(typeof CV === 'undefined' || typeof mingDark !== 'function') return { kind:'none', name:'', image:'', auto:'none', spans:null, geom:null };
    const sp = gradRead(tokens);
    const auto = gradKindOf(sp);
    const pick = (cfg && cfg.grad && cfg.grad.kind) || 'auto';
    const kind = pick === 'auto' ? auto : (GRAD_KINDS.some(x => x.k === pick) ? pick : auto);
    const d = gradDef(kind);
    const drawn = kind === 'none' ? { image:'', stops:[sp.page], geom:null } : gradDraw(kind, tokens, sp, gradTune(cfg));
    return { kind, name:d.name, tip:d.tip, image:drawn.image, stops:drawn.stops, geom:drawn.geom,
      auto, autoName:gradDef(auto).name, spans:sp };
  },
  /* 屏幕上某一点铺的是渐变里哪一个色号 —— 卡片要走这一个（第三节第二条：按卡片正下方那一点量明度差），
     几何就是 gradDraw 交回来那一份，窗口宽高现读。渐变没铺（纯色 / 图片 / 判成不给渐变）时退回页面底。 */
  gradPoint(gd, x, y){
    const W = (typeof innerWidth === 'number' && innerWidth) || 1920;
    const H = (typeof innerHeight === 'number' && innerHeight) || 1080;
    if(!gd || !gd.geom) return (gd && gd.spans && gd.spans.page) || '';
    return gradColorAt(gd.geom, W, H, x, y);
  },
  /* 整屏渐变按 16×9 采一遍：明暗翻面那一条拦它，壁纸糊完那一次「等效底」也拿同一串数取平均 */
  gradGridAvg(gd){
    if(!gd || !gd.geom) return (gd && gd.spans && gd.spans.page) || '';
    const cs = gradGrid(gd.geom, innerWidth || 1920, innerHeight || 1080);
    if(!cs.length) return gd.spans.page;
    const acc = cs.reduce((a, c) => a.map((v, i) => v + CV.hexRgb(c)[i]), [0, 0, 0]);
    return CV.rgbHex(acc.map(v => Math.round(v / cs.length)));
  },
  /* ---------- 背景该写的那几个变量 ----------
     一层：一张图 center/cover 铺满整屏，糊 0~24（样式表里那一层单独一个伪元素，卡片和卡片里的控件不吃糊）。
     调子（压暗 / 提亮）只压这一层，纯色和渐变不经过 —— 见上面那段说明。
     从前这里还有第二层（四方连续 --tile-image / --tile-size，顶糊 6 像素）：2026-10-08 纹理和四方连续图
     并成一档之后，那一层由 --tex-image 那一串接管（它会连背景一起铺，见 Look.apply 末尾那几句）。
     urls 由宿主递（Theme 从图片库现读的那个地址），这里不自己造，避免每次换配色都新建一个句柄。 */
  wallVars(cfg, dark, urls){
    const e = cfg || {};
    const dk = dark === undefined ? this.dark() : !!dark;
    const layer = lookWallLayer(e);
    const wallBlur = lookClamp(e.wallBlur, LOOK_WALL_BLUR.min, LOOK_WALL_BLUR.max);
    /* 存档里没动过这根滑杆（空串）就按明暗取出厂那一档；动过就用动过的那个数，方向仍跟着明暗走 */
    const tint = (e.wallTint === '' || e.wallTint == null)
      ? (dk ? LOOK_TINT.dark : LOOK_TINT.light)
      : lookClamp(e.wallTint, LOOK_TINT.min, LOOK_TINT.max);
    const u = urls || {};
    const v = {
      '--wall-image': (layer === 'image' && u.wall) ? 'url("' + u.wall + '")' : 'none',
      '--wall-blur': wallBlur + 'px',
      '--wall-pad': lookWallPad(wallBlur) + 'px',
      '--wall-tint': layer ? (dk ? 'rgba(0,0,0,' + (tint / 100) + ')' : 'rgba(255,255,255,' + (tint / 100) + ')')
                           : 'rgba(0,0,0,0)',
    };
    return { vars:v, layer, blur:wallBlur, pad:lookWallPad(wallBlur), tint, wallBlur };
  },
  /* ---------- 壁纸糊完之后的「等效底」（第三节那两条复核要用的输入） ----------
     取屏幕上真能看到的那 16×9 = 144 个点：先按窗口比例缩到 160 宽的画布、
     把滑杆上的模糊半径按同一个比例折成画布像素糊一遍，再压成 16×9 读回来。
     普通图片走 cover 裁切那一块（居中）；四方连续那一档画布就是「一张图自己」——
     整屏是这一张反复贴出来的，平均色和明暗跨度都等于单张的，糊的半径按「一张图在屏幕上
     占多宽」折（占得越小，同样的像素糊得越狠）；没定过格位时它按图自己的像素铺，就按那个宽度折。
     最后把调子（压暗 / 提亮）也混进去：这一层是真的盖在壁纸上面的。
     回 { avg, min, max, points } 或 null（图没选 / 读不出来）。
     —— 这一串数只拿去给提示，不拦任何操作：文档那条写死了
        「两条里任何一条不满足，界面上就把『再糊一点』这条路继续留着，而不是拦着不让调」。 */
  wallBase(url, blur, mode, tint, dark, tileScreenW){
    return new Promise(resolve => {
      if(!url || typeof CV === 'undefined' || typeof document === 'undefined') return resolve(null);
      const img = new Image();
      img.onload = () => {
        let out = null;
        try{
          const W = innerWidth || 1920, H = innerHeight || 1080;
          const cw = 160;
          /* 屏幕像素 → 画布像素：普通图片按整屏宽折；四方连续按「一张图在屏幕上占多宽」折，
             因为那一档的画布装的是重复单位本身，不是整屏 */
          const tileScreen = mode === 'tile'
            ? Math.max(1, tileScreenW > 0 ? tileScreenW : img.naturalWidth) : 0;
          const k = mode === 'tile' ? cw / tileScreen : cw / W;
          const ch = mode === 'tile' ? Math.max(2, Math.round(cw * img.naturalHeight / img.naturalWidth))
                                     : Math.max(2, Math.round(cw * H / W));
          const c = document.createElement('canvas'); c.width = cw; c.height = ch;
          const g = c.getContext('2d'); if(!g) return resolve(null);
          let dw = cw, dh = ch, dx = 0, dy = 0;
          if(mode !== 'tile'){
            const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
            dw = img.naturalWidth * s; dh = img.naturalHeight * s;
            dx = (cw - dw) / 2; dy = (ch - dh) / 2;
          }
          /* 小图放大到铺满整屏时，折到画布上只剩几个像素 —— 那一档本来就该糊得重；
             反过来大格位（一张占 40 格）折出来不到 0.5 画布像素，那就是"糊不到什么"的意思，
             不是 bug：一张 400 像素宽的图糊 6 像素本来就只抹掉细节里最细的那一层。 */
          try{ g.filter = 'blur(' + (Math.max(0, (+blur || 0) * k)).toFixed(2) + 'px)'; }catch(e){}
          g.drawImage(img, dx, dy, dw, dh);
          const s2 = document.createElement('canvas'); s2.width = 16; s2.height = 9;
          const g2 = s2.getContext('2d'); if(!g2) return resolve(null);
          g2.drawImage(c, 0, 0, 16, 9);                    // 缩到 16×9 本身就是一次面积平均
          const d = g2.getImageData(0, 0, 16, 9).data;
          const pts = [];
          for(let i = 0; i < d.length; i += 4) pts.push(CV.rgbHex([d[i], d[i + 1], d[i + 2]]));
          const shade = Math.max(0, Math.min(30, +tint || 0)) / 100;
          const inkHex = dark ? '#000000' : '#ffffff';
          const list = shade > 0 ? pts.map(x => CV.mix(x, inkHex, shade)) : pts;
          const acc = list.reduce((a, x) => a.map((v, i) => v + CV.hexRgb(x)[i]), [0, 0, 0]);
          const avg = CV.rgbHex(acc.map(v => Math.round(v / list.length)));
          /* 明度点用 HSL 的 L × 100 —— 和文档、自检脚本里那一条「卡面和脚下差 4~28 个明度点」同一个单位 */
          const ls = list.map(x => CV.hslOf(x)[2] * 100);
          const lo = Math.min(...ls), hi = Math.max(...ls);
          out = { avg, points:list, min:list[ls.indexOf(lo)], max:list[ls.indexOf(hi)],
                  lumMin:lo, lumMax:hi, spread:hi - lo };
        }catch(e){ out = null; }
        resolve(out);
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  },
  /* ---------- 算成 CSS 变量 ----------
     交回一串「变量名 → 值」，宿主在配色变量之后写到根元素上。
     色号有两种写法：能当场算死的（那两道影子）就按深浅算成实数写出来，
     因为从前拿 --page-bg 按固定比例混实色，一侧永远和页面同色、直接看不见；
     跟着配色换的（边框、发光）仍写 var() 和 color-mix，换配色不用回来重算。
     阴影三条各按档位拼好，CSS 那边只管用，不当场拼的原因是 box-shadow 的逗号列表里塞一个 none 会把整条作废。 */
  vars(cfg, dark){
    const dk = dark === undefined ? this.dark() : !!dark;
    const e = this.eff(cfg), m = e.mode;
    /* 辉光在浅色配色上从前是整条换成「什么都不画」，结果就是#2 说的那句「辉光很弱」：
       彩色方案里这一档看起来和没开一样。现在浅底留两样 —— 那圈强调色描边（--look-glow 那一条，
       不在这个开关里）和一层向外散开的强调色光晕，光晕的深度改吃质感那三档高度、颜色仍吃强调色；
       深底照旧画两层。真正撤掉的只有标题那一道 text-shadow（浅底上它会把字糊成一团）。 */
    const quiet = m.k === 'glow' && !dk;
    /* 偏移和模糊都乘 --ck：小卡不该顶着为大卡算的那一层大晕。
       负偏移一律写成 calc(-3px * …)：减号直接扣在 calc 前面（-calc(3px * …)）CSS 认不下，
       而认不下的是整条 box-shadow 不是其中那一道 —— 一条声明里有一处不合法，整条作废。 */
    const ck = n => 'calc(' + n + 'px * var(--ck,1))';
    const three = {
      /* 质感：一层环境影 + 一层投影，横偏移永远是 0（参照页每一档都是 0） */
      lift:['0 ' + ck(1) + ' ' + ck(2) + ' rgba(0,0,0,.08), 0 ' + ck(1) + ' ' + ck(3) + ' rgba(0,0,0,.12)',
            '0 ' + ck(2) + ' ' + ck(4) + ' rgba(0,0,0,.08), 0 ' + ck(4) + ' ' + ck(8) + ' rgba(0,0,0,.12)',
            '0 ' + ck(6) + ' ' + ck(12) + ' rgba(0,0,0,.10), 0 ' + ck(12) + ' ' + ck(24) + ' rgba(0,0,0,.14)'],
      /* 辉光（深底）：静态最多两层、模糊不超过 20px；15px 开外那一档只留给悬停和聚焦。
         每一档的彩度都比从前抬了一成多（40→55、45→60、22→32、50→65、28→40），
         抬之前那一圈在深色底上几乎只剩「边稍微亮一点」，就是#2 说的辉光很弱。 */
      glow:['0 0 ' + ck(6) + ' color-mix(in srgb, var(--accent) 55%, transparent)',
            '0 0 ' + ck(10) + ' color-mix(in srgb, var(--accent) 60%, transparent), 0 0 ' + ck(20) + ' color-mix(in srgb, var(--accent) 32%, transparent)',
            '0 0 ' + ck(14) + ' color-mix(in srgb, var(--accent) 65%, transparent), 0 0 ' + ck(20) + ' color-mix(in srgb, var(--accent) 40%, transparent)'],
      /* 辉光（浅底）：零偏移的那圈光晕照画，深度对齐质感那三档（4/8/12），彩度给到 40%~45%。
         从前这一整串换成「什么都不画」，等于浅色方案里辉光这一档按纯平画 —— 现在只撤标题那道光晕。 */
      glowLite:['0 0 ' + ck(4) + ' color-mix(in srgb, var(--accent) 40%, transparent)',
            '0 0 ' + ck(8) + ' color-mix(in srgb, var(--accent) 42%, transparent)',
            '0 0 ' + ck(12) + ' color-mix(in srgb, var(--accent) 45%, transparent)'],
      /* 「什么都不画」这一档不能写 none：样式表里 box-shadow 是逗号列表，列表里出现一个
         none 会让整条作废（结果看着也是没影子，但拼在它后面的那一层跟着一起没了，等于静默出错）。
         所以画一道零尺寸全透明的影子占位，逗号列表永远是合法值。 */
      none:['0 0 0 0 transparent','0 0 0 0 transparent','0 0 0 0 transparent']
    }[quiet ? 'glowLite' : m.shadow] || ['0 0 0 0 transparent','0 0 0 0 transparent','0 0 0 0 transparent'];
    const v = {
      /* 卡面往墨色掺这一档（深底往白掺）：来由见文件顶上那条例外。
         掺墨是卡片唯一一处不在配色表里的明度调整，也是实色卡片和页面底拉开区别的那一点。 */
      '--card-ink': e.ink + '%',
      /* --card-ink-mix 不在这里写：掺墨方向由 readable() 按当前这套配色的 --card-bg 现算
         （同色相、明度 ±25%），写在这里拿不到 card-bg。vars() 排在 readable() 之后跑，
         这里要是也写一条，会把 readable() 算好的那个色号顶回纯黑 / 纯白 —— 带色相的卡面
         掺完就变灰，正是 2026-10-05 他截图问的那一条。 */
      /* 卡片底只有实色这一档：吃配色里那张卡的颜色，掺完墨直接交出去，不再和底下那块面合成。 */
      '--card-face': 'color-mix(in srgb,var(--card-ink-mix,#000) var(--card-ink,0%),var(--card-bg))',
      /* 模式管的：边框粗细、边框颜色、三档高度（一行 / 一张卡 / 一个浮层） */
      '--bw': m.bw + 'px',
      '--card-border': m.border === 'line'
        ? 'color-mix(in srgb, var(--text) ' + (m.k === 'bare' ? 8 : 18) + '%, transparent)'
        : m.border === 'glow' ? 'color-mix(in srgb, var(--accent) 62%, transparent)' : 'transparent',
      /* 分隔线专用的一条，永远 1px，四档一个样。
         --bw 和 --card-border 那两样管的是「卡片和控件的外框」：质感这一档把外框收成 0，
         靠影子分高低 —— 这是这一档的定义，不是漏。可宿主和组件里有一大半写的是分隔线
         （对话框顶底那两道、设置左边那一列的竖线、日程树那一行、金句标题底下那道 underline、
         便签列表的行线），它们跟着外框一起塌，看着就是「外观模式没应用上」。
         辉光那一档更糟：--card-border 是强调色 62%，分隔线全变成霓虹线。
         所以分隔线不吃那两样，吃这一条 —— 线色由 readable() 现算，和控件那条细边同一个函数、同一个 3.0 下限，
         只是参照的底只有当前这一块面（控件那条要同时压住卡面和输入框底两块）。
         2026-10-04 之前这里是写死的「文字色掺 14%」，量出来 1.3 上下，够不着边界要的 3.0。
         `fd3-shell.js` 顶栏按钮那一条本来自己抄了一份 14%，同一轮换成吃这一条，不再各写各的。
         拆成粗细、颜色、整条三个变量：虚线那种占位框（新建配色的格子、书架上「新建作品」那一张）
         只要颜色和粗细，样式写 dashed，所以不能只给一条 shorthand。 */
      '--hair-w': '1px',
      /* 这一条是兜底：宿主走完 readable() 时会被现算的那个色号顶掉（见下面 readable 里那一处）。
         2026-10-04 从 14% 抬到 50% —— 14% 量出来只有 1.3 上下，够不着条款给边界的 3.0。 */
      '--hair-color': 'color-mix(in srgb, var(--text) 50%, transparent)',
      '--hair': 'var(--hair-w) solid var(--hair-color)',
      '--sh-ctl': three[0],
      '--sh-card': three[1],
      '--sh-float': three[2],
      /* 辉光：标题那几处带光晕，6px 就够，字本身要清楚（浅底那一下不画，见上面 quiet） */
      '--look-glow': (m.k === 'glow' && !quiet) ? '0 0 6px color-mix(in srgb, var(--accent) 70%, transparent)' : 'none',
    };
    /* 纹理：平铺图地址 + 一张铺多大（最小格位，没定过就按图自己的像素铺 —— 从前那几张一直是这个口径）。
       强度那一档整串撤了（2026-10-08 作者的话：删除纹理强度系列设置），图上不再叠透明度：原图进。 */
    v['--tex-image'] = 'none';
    v['--tex-opacity'] = 0;
    v['--tex-size'] = lookTileSize(cfg && cfg.texCell);
    /* 去色 / 直接使用 这两档就在这一处现算，样式表只吃变量（作者的话：
         「去色（纹理/四方连续图仅作为无色材质、颜色跟着配色走）还是直接使用（原图进入）」）：
         直接使用 —— 一个字不加，原图进，顶满这一层；
         去色 —— 先洗成灰的，再把这一层让出一半给底下的色（LOOK_TEX_GRAY 那一个数）：
                 图上只剩下纹路和明暗，颜色由卡面、背景那一档自己供。
       为什么不用 mix-blend-mode 那一套：blend 要在同一个层叠上下文里才吃得到底下的色，
       卡片那一格有 isolation、背景那一层没有，两处要分开兜，反而是这一个透明度两处分毫不差。 */
    v['--tex-filter'] = 'none';
    if(e.tex){
      const u = this.url(e.tex);
      if(u){
        v['--tex-image'] = 'url("' + u + '")';
        v['--tex-opacity'] = e.texGray ? LOOK_TEX_GRAY : 1;
        if(e.texGray) v['--tex-filter'] = 'grayscale(1)';
      }
    }
    return v;
  },
  /* ---------- 压在字底下的到底是哪一块面，以及读不读得动 ----------
     配色那一头算文字色时拿的是「卡片底完全不透」那个色号（sh-color.js 里 7.0 优先、4.6 兜底）。
     上屏要过这一道才会挪动那块面的明度，所以这里照样式表那条 color-mix 复算一次：
       卡面往墨色掺这一档的 ink（浅底掺黑、深底掺白）。
     算出来的面单独播一个 --face-solid：卡片以外的地方（日程条的浅色填充、画板节点底色）
     从前拿 --card-bg 去混，那是没掺墨的卡面，条上的字就按错了底。 */
  readable(tokens, cfg){
    const t = tokens || {};
    const page = t['--page-bg'], card = t['--card-bg'];
    if(!page || !card || typeof CV === 'undefined' || !CV.mix) return null;
    const dk = this.darkOf(page, t['--text']);
    const e = this.eff(cfg);
    const hex = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
    /* 掺墨方向：问配色引擎那一份 CV.cardInk(卡面, 深浅, 当前识别方案)。
       甲案从卡面自身推一档明度（同色相、浅底 -25% L / 深底 +25% L），不拿纯黑 / 纯白去混 ——
       纯黑会把带色相的卡面（浅蓝 / 浅米 / 浅薄荷）一起拖成灰，就是 2026-10-05 他截图问的那一条；
       卡面本来就是中性色（S=0）时同色相推一档还是中性色，结果和从前混纯黑没区别。
       乙 / 丙 / 丁 三案由那一份自己退回纯黑 / 纯白。规则只写在 sh-color.js 一处，这一头不再抄第二遍，
       免得界面、自检、打字练习三处各算各的。
       这一条由 readable() 写，vars() 不再写 --card-ink-mix（vars() 排在后面跑，会顶回来）。 */
    let inkMix;
    try{ inkMix = (typeof CV.cardInk === 'function') ? CV.cardInk(card, dk) : (dk ? '#ffffff' : '#000000'); }
    catch(err){ inkMix = dk ? '#ffffff' : '#000000'; }
    let face;
    try{ face = CV.mix(card, inkMix, e.ink / 100); }
    catch(err){ return null; }
    /* 从前这里有一条「这块面正好等于卡面就直接返回」的近路，看着省事，其实漏了两件事：
       铺纹理那一档的下限（5.5 / 5.4）也是按这块面推的，早退就把纹理的余量跳过了；
       按钮底现在也在这条路上现算，近路得再抄一遍。复检本身是「够线就不动」，白跑一趟不改数，
       所以近路删掉，只留下面这一条道。 */
    const out = {};
    /* 铺了纹理就把下限抬高一档：那一张平铺小图压在字底下，取最暗和最亮两个像素量的数。
       正文 5.5、次级 5.4 这两个数是 2026-10-07 按「预设 11 张 + 强度顶 40（图层不透明度 0.24）」量出来的余量定的；
       2026-10-08 预设纹理和强度那一系列整串撤了、改成原图进（不透明度 1），这两个数先按原样留着
       —— 没有重新量过一张真图，此处留一句实话而不是假装它还是现算的结论。 */
    const tex = !!(e.tex && this.url(e.tex));
    const fix = (k, bg, min, aim) => {
      if(!hex(bg)) return;
      const cur = out[k] || t[k];
      if(!hex(cur) || CV.contrast(cur, bg) >= min) return;
      let v;
      try{ v = CV.ensure(cur, bg, aim || min); }catch(err){ return; }
      /* 按 7.0 那一档推完还是没到下限（这块面本来就到不了），退回按下限推一次 */
      if(!v || CV.contrast(v, bg) < min) { try{ v = CV.ensure(cur, bg, min); }catch(err){ return; } }
      if(!v || v === cur) return;
      /* 幂等钉（外13-B）：--text 是这一趟深浅判定 darkOf(page, --text) 的输入之一，
         复检却也可能改写它。CV.ensure 推不动时按「与这块面对比最高的头」收场，允许从亮头
         换到黑头（琥珀竹烟 · 丁：#fff8f0 → #1a1a1a），换完正文跨到页面底亮度的另一头，
         mingDark 跟着翻面 → 第二遍 darkOf 挑出反方向的 dk → inkMix / face / ctl-edge 整套跟着翻，
         这就是「第二遍又推了一次」。规则：复检推出来的正文不许改变这一趟正在用的深浅判定，
         会翻面的一律不收（这块面本来两头都读不动的配色，由 FLOOR 那一条按真实值报不通过）。
         其余键不吃 dk，不需要这一道。 */
      if(k === '--text' && this.darkOf(page, v) !== dk) return;
      out[k] = v;
    };
    /* 压在卡面上的那些字都按这一块面复检 —— 卡片只有实色这一档，底下铺了壁纸也不透，
       所以「正常那一档 / 退化那一档」两块面并算那一段跟着材质一起撤了。 */
    const fixOn = (k, min, aim) => fix(k, face, min, aim);
    fixOn('--text', tex ? 5.5 : 4.6, 7);
    /* 按钮底跟着「掺完墨之后的这块面」走，不跟着配色那张原卡走，按钮的字再按这块底复检一次
       （无障碍走查 A-1）：配色那头算的是 cardBg 掺 10% 强调色，可字是坐在掺墨后的面上比出来的，
       最差那一套实测只有 3.03。一处算、一处用，不再各推各的。 */
    out['--btn-bg'] = this.btnBg(face, t['--accent'], dk);
    /* 这一条不跟纹理抬档：那块底是两块实色混出来的一个色号（不透明），纹理那层铺在卡片里、
       在控件底下（名单已经把 CTL 撤出去），字压不到纹理上，所以按 4.6 那一线就够。 */
    fix('--text', out['--btn-bg'], 4.6, 0);
    fixOn('--text-light', tex ? 5.4 : 4.5, 0);
    /* 分段选择未选项：平时那一格的底是槽色（不透明、不掺墨），所以先按槽色复检，再按卡面复检一次 */
    fix('--seg-text', t['--candidate-bg'], tex ? 5.4 : 4.5, 0);
    fixOn('--seg-text', tex ? 5.4 : 4.5, 0);
    /* 状态色既当图标色也当说明文字色，按 4.5 复检一次（下限已由配色那一头从 3.0 抬到 4.5） */
    for(const k of ['--ok', '--bad', '--warn']) fixOn(k, 4.5, 0);
    /* 这三色反过来当底用的那几处（删除按钮悬停、为写那一条警告横条）从前一律写字用纯白 ——
       浅底那几套推完 4.5 的状态色是中等明度，白字压上去只剩 2.x（第 4 条说的「没融入配色」）。
       和主按钮那个反白字同一个规则：按这一块底的明暗挑一头，再按 4.5 推。 */
    for(const k of ['--ok', '--bad', '--warn']){
      const bg = out[k] || t[k];
      if(!hex(bg)) continue;
      out[k + '-text'] = CV.ensure(CV.lum(bg) > .5 ? '#1a1a1a' : '#ffffff', bg, 4.5);
    }
    /* 拿强调色当文字色的那几处（页签选中、菜单项悬停、周末表头…）走的是另一个色号（无障碍走查 A-4）：
       --accent 那一档只管「图形边界」的 3:1，当字用要 4.5。这里从强调色出发往可读那一头推，
       色相尽量留着 —— 界面不吃强调色的地方不动，吃的那 9 处换成 --accent-text。 */
    if(hex(t['--accent'])){
      out['--accent-text'] = t['--accent'];
      fix('--accent-text', t['--accent-light'], 4.5, 0);
      fixOn('--accent-text', tex ? 5.4 : 4.5, 0);
    }
    out['--face-solid'] = face;
    /* 把上面算的掺墨方向交出去：样式表里 --card-face 那条 color-mix 吃它，
       宿主没调 readable 时 vars() 那条兜底公式会退回纯黑（见 vars 里那一段说明）。 */
    out['--card-ink-mix'] = inkMix;
    out['--ctl-edge'] = this.edge(face, [t['--input-bg'], t['--candidate-bg']], dk);
    out['--hair-color'] = this.edge(face, [], dk);
    this.barTints(t, face, out, out['--text'] || t['--text']);
    return Object.keys(out).length ? out : null;
  },
  /* 这套配色是深底还是浅底：readable 拿的是色号本本（不一定上过根元素），不能走 dark() 那一条读样式的。
     第二个参数是同一套配色里的正文色 —— 判定按「底 vs 文」那一对亮度走（见上面 dark() 那一段），
     传不进来（宿主只给了底、或者兜底那一趟读不到 --text）才退回背景的绝对亮度。 */
  darkOf(pageHex, textHex){
    try{
      if(typeof CV === 'undefined') return false;
      if(typeof mingDark === 'function'){
        const md = mingDark(pageHex, textHex);
        if(md) return md === 'dark';
      }
      return CV.lum((typeof hex6 === 'function' ? hex6(pageHex) : '') || pageHex) < .22;
    }catch(e){ return false; }
  },
  /* 控件那条 3:1 细边的色号：从卡面往墨色那一头一小步一小步推（深底往白推），
     推到和「卡面」「输入框底」「分段槽底」相邻的这几块都够 3:1 才停 —— 相邻哪一块不够，
     那条线就在那一块上看不见。强调色底不在这份名单里：深底那几套的强调色本身偏亮
     （RP 黑暗 #7aa7e8 对卡面 6.95），一条线要同时离深色卡面和亮强调色都差 3 倍以上，
     数学上要卡面↔强调色 ≥9 才有解，54 套里没有；硬放进去只会推到头变成纯墨，把分隔线一起带坏。
     坐在强调色底上的那几个（主按钮、分段选中格）的焦点框另走一句：用反白字那个色号，
     它本来就是按这块底配出来的（样式表末尾那一条）。 */
  edge(face, other, dk){
    const ink = dk ? '#ffffff' : '#000000';
    if(typeof CV === 'undefined' || !CV.mix || !/^#[0-9a-f]{6}$/i.test(face)) return ink;
    const near = [face].concat(Array.isArray(other) ? other : [other])
      .filter(c => /^#[0-9a-f]{6}$/i.test(c));
    for(let p = .02; p <= 1.0001; p += .02){
      const c = CV.mix(face, ink, p);
      if(near.every(b => CV.contrast(c, b) >= 3)) return c;
    }
    return ink;
  },
  /* 按钮那块底：合成后的卡面掺强调色，浅底 10% / 深底 18%（浓淡照配色那头给的那一对，不改）。
     跟着这块面走而不是跟着原卡走，见 readable() 里那一条（无障碍走查 A-1）。 */
  btnBg(face, accent, dk){
    if(typeof CV === 'undefined' || !CV.mix || !/^#[0-9a-f]{6}$/i.test(accent)
      || !/^#[0-9a-f]{6}$/i.test(face)) return face;
    try{ return CV.mix(face, accent, dk ? .18 : .10); }catch(err){ return face; }
  },
  /* 日程条那一档浅色填充：底 = 掺完墨的那块卡面里掺 18% 的色位，条上的字按这块新底再推一次 4.5；
     色位圆点按与这块面 3:1 推一次（条款要的是图形边界，不是文字）。
     字推不动时改条子不改字：色位一旦把那块填充推到中间明度，白字和黑字两头都够不着 4.5
     （RP 黑暗 纯色底上 #5e7e81：白字顶到 4.40、黑字 3.96），而条上的字应该和卡片正文一路色 ——
     所以这一趟把填充本身的深浅往远离字色那一头推一格，色相不动，字色留着。
     54 套配色 × 4 档外观模式 × 5 个色位 = 1080 个数，跑法见 src\_fd\look-check.mjs。 */
  barTints(t, face, out, text){
    for(let i = 1; i <= 5; i++){
      const s = t['--slot-' + i];
      if(!/^#[0-9a-f]{6}$/i.test(s) || !/^#[0-9a-f]{6}$/i.test(face)) continue;
      let tint, dot;
      try{
        tint = CV.mix(face, s, .18);
        dot = CV.ensure(s, face, 3);
        out['--slot-' + i + '-dot'] = dot;
        /* 这一档纯色当底用的那处（书架那一块书封）：字从前写死纯白，色位是中等明度的一档，
           白字压上去够不着 4.5（RP 明亮 那一套的 #ab6a40 上只剩 4.31）。走的是上面日程条那一条
           现成的规矩：字按底的明暗挑一头，挑完还是够不着就推底、不动字 —— 色相留着。 */
        const ink = CV.lum(s) > .5 ? '#1a1a1a' : '#ffffff';
        const cover = CV.ensure(s, ink, 4.5);
        out['--slot-' + i + '-cover'] = cover;
        out['--slot-' + i + '-cover-ink'] = CV.ensure(ink, cover, 4.5);
        if(/^#[0-9a-f]{6}$/i.test(tint)){
          /* 条上的字以推过的正文色为起点：日程条和卡片正文要还是一路字色，只有落在深色位上才推 */
          const bar = text && /^#[0-9a-f]{6}$/i.test(text) ? text : '#000000';
          if(CV.contrast(bar, tint) < 4.5) tint = CV.ensure(tint, bar, 4.5);
          out['--slot-' + i + '-bar'] = tint;
          out['--slot-' + i + '-bar-text'] = CV.ensure(bar, tint, 4.5);
        }
      }catch(err){}
    }
  },
  /* ---------- 根元素上现读一次配色（宿主没调 readable 时的兜底） ----------
     三家宿主的配色各自写在自己的根元素上，写完了才调 apply。所以这里把那几项色号
     从样式里捞回来当输入，算出来的还是同一套数 —— 为写单开、声笔输入法练习单开、
     还有哪一家将来忘了调那一句，读不动的字都由这一趟补上。
     重复调不会越推越深：readable 的规则是「够数就不动」，第二趟进来每一项都已经够。 */
  readableFromRoot(el, cfg){
    if(typeof CV === 'undefined' || !CV.mix) return null;
    /* 强调色那两个也必须捞：readable 里 --accent-text 是从 --accent 推的、--btn-bg 是拿 --accent 掺的，
       名单少了它们，兜底这一趟就把宿主刚算好的那两个数顶成「undefined」和素卡面。 */
    const keys = ['--page-bg', '--card-bg', '--input-bg', '--candidate-bg', '--text', '--text-light',
      '--seg-text', '--ok', '--bad', '--warn', '--accent', '--accent-light',
      '--slot-1', '--slot-2', '--slot-3', '--slot-4', '--slot-5'];
    let cs;
    try{ cs = getComputedStyle(el); }catch(err){ return null; }
    const t = {};
    for(const k of keys){ const v = cs.getPropertyValue(k); if(v) t[k] = v.trim(); }
    return this.readable(t, cfg);
  },
  /* ---------- 上到根元素 ----------
     宿主要在配色变量之后调这一句：这一趟盖的是 --card-face / --card-border 这些模式说了算的。
     顺手把 data-dark 钉上：深浅两套数靠它挑，三家不必各自记得钉。
     卡面掺墨之后底下那块面换了色，读不动的字由 readable 推回来；宿主调过了，
     这里现读一遍再补一次也是同一个数，不会推两回。 */
  apply(cfg, root){
    const el = root || document.documentElement;
    const dk = this.dark(el), e = this.eff(cfg);
    const fix = this.readableFromRoot(el, cfg);
    if(fix) for(const k in fix) el.style.setProperty(k, fix[k]);
    const v = this.vars(cfg, dk);
    for(const k in v) el.style.setProperty(k, v[k]);
    el.dataset.mode = e.mode.k;
    el.dataset.tex = e.tex || 'none';
    el.dataset.dark = dk ? '1' : '0';
  },
};

/* ---------- 这一层的样式：变量说清的那几样之外，只剩下面这几种皮 ----------
   · 表面（卡片 / 面板 / 对话框 / 菜单）：底色吃实色卡面 + 掺墨，影子吃模式那一档
   · 控件（按钮 / 输入框 / 分段选择 / 下拉 / 书卡 / 提示条）：吃控件那一档高度，
     从前只有 13 个表面类拿得到影子，控件一个都没有 —— 「卡片有模式皮、按钮和细节没有」就是这么来的
   · 细边（输入框 + 按钮）：一条 1px 的 --ctl-edge，按与相邻两块面 3:1 推出来的（WCAG 1.4.11）
   · 焦点框（所有控件的 :focus-visible）：单独一条 2px 描边，不吃模式那档边框粗细（WCAG 2.4.7）
   · 区域（为写工作台那几栏整块到边的地方：图标条 / 章纲栏 / 正文栏 / 侧栏栏 / 页签条 / 文档上下两条）：
     底色和纹理跟表面一样吃，唯独不吃卡片那一档影子
   · 纹理那一层：一张平铺小图，压在底色之上、内容之下，只铺卡片和到边的栏两张名单
     （控件那一串 2026-10-04 从这一条里撤了：织纹会把按钮和输入框的轮廓一起吃掉，
     见那份数值表第七节第 11 项）
   2026-10-04 同一轮把四档材质和「真液态对比」那个折射开关撤了：卡片一律实色，
   样式表里不再有 backdrop-filter、亮环、薄膜、凹陷槽这几段。
   选择器认的是三个宿主已有的那几张表面和控件，名单就按下面那几串为准（Flow-Desk 的 .fd-card / .fd-dialog / .fd-menu / .fd-btn / .fd-input / .fd-seg / .fd-set-tabs / .fd-sel-btn / .fd-sel-menu / #toast，
   为写的 .wnw-panel / .wnw-card / .wnw-dock-card / .wnw-insp / .wnw-menu / .wnw-bd-node / .wnw-tip / .wnw-book / .wnw-book-row / .wnw-olcard / .wnw-midq / .wnw-hl-pv / .wnw-note / .wnw-cg / .wnw-btn / .wnw-input / .wnw-seg / .wnw-tab / .wnw-btab / .wnw-badd / .wnw-chip / .wnw-opt，
   两边共用的 .wnw-result / .sh-mod / .ff-drop，声笔输入法练习的 .pick-btn / #text-input）；
   页签那一排（.wnw-tabx）和它选中那一片走的是区域那一档，不在表面和控件这两串里，理由写在下面 AREA 那一段。
   以后新加的表面和控件挂一个 data-look（表面）、data-look-ctl（控件）或 data-look-edge（描边）就并进这一堆，不用回来改这一段。 */
(function(){
  if(typeof document === 'undefined') return;
  /* 三张名单：卡片 / 面板这一档吃第二层高度，对话框和浮层吃第三层，控件吃第一层。
     REL 那一串本来没有定位（伪元素那一层要贴着它的边框画，得有个定位当参照），
     卡片、菜单、白板节点、悬停提示这些本来就已经 relative / fixed / absolute 的不许进来 ——
     这一条带着 `html ` 前缀，比宿主自己那一条更重，写进来就把人家的 fixed 顶成 relative，
     提示条会跟着鼠标跑回页面流里。已经定位过的元素本来就是参照，不需要这一条。 */
  /* 2026-10-04 这一轮补进来的那些，都是宿主自己铺了一层 --card-bg / --candidate-bg、
     从来没经过材质和外观模式的表面：为写的书架卡（.wnw-book / .wnw-book-row）、章纲卡片（.wnw-olcard）、
     中响应询问条（.wnw-midq）、高亮预览格（.wnw-hl-pv）、批注与修订痕迹条（.wnw-note）、
     模板编辑器里那一组（.wnw-cg），两边共用的结果块（.wnw-result）、模块块（.sh-mod）、
     字体下拉里那一叠（.ff-drop，带 :not(:empty) —— 空着的那一格不给底色也不给影子，不然多一块浮着的空卡）。
     这几张在宿主侧的 background 已经撤掉了：留着也只是被这一条压住，看着还像「材质没应用上」。
     2026-10-04 同一轮补的是声笔输入法练习那三栏文件卡（.file-card）：它跟 .fd-card 是一个用途，
     名字不带 .fd- 前缀，所以从前一直留着宿主自己铺的那层白，四档材质看着是一档。 */
  const SURF = '.fd-card,.fd-dialog,.fd-menu,.wnw-panel,.wnw-card,.wnw-dock-card,.wnw-insp,.wnw-menu,.wnw-bd-node,.wnw-tip,.fd-sel-menu,.wnw-book,.wnw-book-row,.wnw-olcard,.wnw-midq,.wnw-hl-pv,.wnw-note,.wnw-cg,.wnw-result,.sh-mod,.ff-drop:not(:empty),.file-card,[data-look]';
  const FLOAT = '.fd-dialog,.fd-menu,.wnw-panel,.wnw-menu,.wnw-tip,.wnw-warn,.fd-sel-menu,#toast';
  /* 名单里有声笔输入法练习那一份（.pick-btn / #text-input / #input-area）：
     它的按钮和输入框不是 .fd- / .wnw- 那两个前缀，不写进来就吃不到外观模式的边框与影子，
     三个程序里就数它那一页最素。名字都不重，Flow-Desk 与为写没有这几个选择器。
     #input-area 是这一页的取码输入框（跟练习区的 #text-input 不是一个）：
     质感这一档 --bw 是 0，它自己那圈 --input-border 当场没了，而输入框的底又正跟卡面同一个色 ——
     不给边框就只剩一条光标在空地上闪，所以描边那一档（EDGE）把它顶回来。 */
  /* 控件吃第一档高度。标签那一列认的是里面那一个一个（.fd-set-tabs button / .wnw-tab），
     不是外面那个装它们的条 —— 条本身没有底，给它影子就是给一列空白影子；
     为写那一排页签的外框 .wnw-tabx 自己画边，不并进这一串。
     书架那两张卡（.wnw-book / .wnw-book-row）从前挂在这一串里，只拿到控件那一档的影子，
     底色还是宿主自己铺的那一层 —— 它是卡片不是控件，2026-10-04 挪到上面 SURF 那一串去了。
     这一轮补进来的是为写顶栏那两排胶囊（书架标签 .wnw-btab / 新建作品 .wnw-badd）
     和小标签（.wnw-chip）与选项豆（.wnw-opt）：四套都自己画过一圈 --input-border，
     质感那一档 --bw 是 0，那一圈当场没了，按钮看着不像按钮。 */
  const CTL = '.fd-btn,.wnw-btn,.fd-input,.wnw-input,.fd-seg,.wnw-seg,.fd-set-tabs button,.fd-sub-tabs button,.fd-sel-btn,.wnw-tab,.wnw-btab,.wnw-badd,.wnw-chip,.wnw-opt,.pick-btn,.unload-btn,.record-btns button,select,#text-input,#input-area,.text-view,.sh-bank-ta,.sh-bank-q,.wnw-f .txt,[data-look-ctl]';
  /* 描边那一档只给「空着也要认得出来」的两类：输入框（含正文编辑区、下拉）和按钮。
     分段选择不描边是那份数值表第九节定下来的一条：槽底那 4.5% / 7% 的色差已经把格分出来了，
     再描一圈就是两层结构。卡片角上那三个、工具条上只摆图片的那些不描（见下面 BARE 那一条）。
     「新建作品」那一个（.wnw-badd）底是空的、字又是次级色，光靠底分不出来，所以给它描边；
     书架标签和一堆小标签有自己的底色，不描。 */
  const EDGE = '.fd-input,.wnw-input,#text-input,#input-area,.text-view,select,.fd-btn,.wnw-btn,.pick-btn,.unload-btn,.fd-sel-btn,.wnw-badd,.sh-bank-ta,.sh-bank-q,.wnw-f .txt,[data-look-edge]';
  /* 一行按钮里那种只摆图片的、卡角上那三个：不给影子（没底可投），也不描边（一个一个圈起来把那行切碎）。
     这一串和样式表里「不给影子」那一条是同一批，改一批要记得改两批。 */
  const BARE = '.wnw-btn.mini.ico,.fd-tool,.fd-mbtn,.fd-wbtn,.fd-sel-dot,.fd-sel-arrow';
  /* 纹理那一层是 absolute 的伪元素，贴在谁的边框里就得有个定位当参照。
     这一串 = 上面 SURF 里那些本来没定位的：书架长条、章纲卡、询问条、预览格、批注条、组框、
     结果块、模块块、字体下拉那一叠、声笔练习那三栏文件卡。（书架方卡 .wnw-book 本来就有 position:relative，不必进来。） */
  const REL = '.fd-dialog,.wnw-panel,.wnw-card,.wnw-dock-card,.wnw-insp,.wnw-book-row,.wnw-olcard,.wnw-midq,.wnw-hl-pv,.wnw-note,.wnw-cg,.wnw-result,.sh-mod,.ff-drop,.file-card,[data-look]';
  /* 「在一排颜色里挑一个」的那几个（外13-O）：为写的色点（.wnw-dot）、高亮色位（.wnw-slot）、
     Flow-Desk 和日程共用的色点（.fd-dot）。三家从前各画各的选中态 —— 一处一圈强调色、
     一处一个 outline、一处只把透明度从 .5 提到 1，同一个动作三种样子。下面那一组样式给一套确认语言。 */
  const PICK = 'button.wnw-dot,button.wnw-slot,button.fd-dot';
  /* 焦点框那一条例外要认的名单（2026-10-04 逐屏复验补的，理由写在下面那条样式里）。
     .fd-sel-item 是自绘下拉里的一个个选项（Flow-Desk 的外观方案·配色·纹理三处）：无障碍走查 C-1 把它们从 DIV 换成了真 <button role=option>，
     键盘能 Tab 到、能按方向键走，那就得看得见焦点落在哪一个 —— 补进这一串。
     2026-10-05 再补两处：挑色的那几个圆点（PICK）和盖在色块里那个透明取色器（.fd-chip-in）。 */
  const FOCUS = CTL + ',.fd-seg button,.wnw-seg button,.fd-sel-item,' + BARE + ',input[type=range],' + PICK + ',.fd-chip-in';
  /* 区域那一档：为写工作台里整块顶到边的地方。跟卡片一样吃实色卡面、一样铺纹理，唯独不给卡片那一档影子 ——
     栏不是摆在页面上的那张卡，投影等于把栏的宽度算进阴影里，相邻两栏中间那条分界线还会被晕糊掉；
     栏和栏怎么分？靠模式那一档的边框线（--bw / --card-border），宿主自己已经画在栏的边上了。
     面分两种，各自跟着宿主原来的样子：
       · 卡片面：图标条 / 章纲栏 / 页签条 / 正文那一栏顶上标题行和底下状态行 —— 吃 --card-face；
       · 页面面：正文栏本身和右边停靠栏（里头那一叠面板自己才是卡片），还有页签里选中那一片（选中页签要跟正文同一块面才连得上）。
     为什么 .wnw-tabx.on 单独一条而不连着 .wnw-tabx：没选中的页签底下压着正文，只有选中那一片该跟正文同色。 */
  const AREA_CARD = '.wnw-rail,.wnw-left,.wnw-strip,.wnw-doc-top,.wnw-doc-foot';
  const AREA_PAGE = '.wnw-pane,.wnw-right,.wnw-tabx.on';
  /* 每一条选择器各自顶着 `html ` —— 各宿主的模块样式什么时候注入不一定，加这一级才不看先后。
     三个坑都在这：
       · 写成 `html A,B,C` 时逗号列表不会把前缀分给后面几条，只有 A 沾到光；
       · 拼的时候漏了那个空格（html.fd-card）就变成「带这个 class 的根元素」，一条都不认，整层皮静默消失；
       · 尾缀同理：`A,B,C::after` 只给 C 加了伪元素，前面 A、B 变成给元素本身画那一条 ——
         卡片会被铺上 opacity:0 和 background:none，整张卡直接不见了。
     所以带前后缀的选择器一律逐条摊开。 */
  const pre = list => list.split(',').map(s => 'html ' + s.trim()).join(',');
  const suf = (list, end) => list.split(',').map(s => 'html ' + s.trim() + end).join(',');
  /* 带属性前缀的那一段（html[data-mode="glow"] 后面挂名单），同样逐条摊开、空格不能少 */
  const under = (base, list) => list.split(',').map(s => base + ' ' + s.trim()).join(',');
  /* 区域的底色和表面用的是同一条，只是最里面那个面不一样，所以写成函数，抄两遍迟早改漏一边。 */
  const areaBg = face => `isolation:isolate;position:relative;background:${face};`;
  /* --ctl-edge 由 Look.readable() 按当前这套配色 + 模式算出来。宿主钉它的那一趟还没跑到时
     （开机首帧）退回这一条：文字色往卡面里掺 55% 推出来的一条灰线 ——
     大致在 3:1 那一档上下，不如算出来的准，但不至于一条边都没有。 */
  const EDGE_V = 'var(--ctl-edge,color-mix(in srgb,var(--text) 55%,var(--card-bg)))';
  const CSS = `
/* 原生控件不吃 CSS 变量，只认 color-scheme：滑杆的轨道和滑块、勾选框、单选钮、原生下拉那张列表、
   还有没被样式表接住的滚动条槽，全都按它挑的一套系统色画。这一份从前没钉过 color-scheme，
   Chromium 就一律按 light 画 —— 深底配色上那一条滑杆顶着一截纯白底板，就是 #4 说的「滑块、按钮、
   滚动条等地方还有纯白，没有融入配色」。data-dark 由 apply 按「底色对正文」那一对比出来钉上
   （文件顶上第 2 条和 dark() 那一段），
   所以钉这一条不用各宿主再记一遍；强调色那头由各宿主的 accent-color 管，两样合起来
   原生滑杆就是「这套配色的深浅底 + 强调色」，不再是一块白底板。 */
html{color-scheme:light;}
html[data-dark="1"]{color-scheme:dark;}
/* 滚动条：滑块（thumb）各宿主都已经吃 --scrollbar，槽（track）和两根条交叉那一小块没人管过，
   于是留着系统那层浅灰白。给成透明 —— 底下露出来的就是这块面板自己的颜色，等于跟着配色走，
   不必再发明一个「槽色」token。 */
::-webkit-scrollbar-track,::-webkit-scrollbar-corner{background:transparent;}
/* 表面：底色 = 卡面掺完墨那一个色号（--card-ink 那一档，墨色由 CV.cardInk() 按识别方案给：
   甲走卡面自己那个色相、其余三案浅底掺黑 / 深底掺白），实色，不再和底下那块面合成。
   影子 = 模式算好的那一条；底下铺了壁纸时，画面只在卡片外面那片空处露着。 */
${pre(SURF)}{isolation:isolate;
  background:var(--card-face,var(--card-bg));
  box-shadow:var(--sh-card,none);}
${pre(FLOAT)}{box-shadow:var(--sh-float,none);}
${pre(REL)}{position:relative;}
/* 区域：整块到边的栏吃和卡片同一个面、同一层纹理，不吃影子（不给影子这件事见上面 AREA 那一段）。
   两条各带自己的面：卡片面就是掺完墨的卡面，页面面从头就是页面底那个色。 */
${pre(AREA_CARD)}{${areaBg('var(--card-face,var(--card-bg))')}}
${pre(AREA_PAGE)}{${areaBg('var(--page-bg)')}}
/* 控件：吃第一档高度。边框只在纯平 / 无界 / 辉光这三档出现（其余档位 --bw 是 0），
   所以这一句不用分档写，换档时它自己跟着变。定位是给纹理那一层当参照的。 */
${pre(CTL)}{position:relative;isolation:isolate;
  box-shadow:var(--sh-ctl,none);border:var(--bw) solid var(--card-border);}
/* 输入框和按钮那一条 3:1 细边：排在模式那条边框之后，所以质感这一档收成 0 的宽度由这一条顶上。
   颜色是 Look.readable() 现算的 --ctl-edge（与卡面、输入框底相邻两块都够 3:1 才停）。
   代价说在明处：辉光那一档原本给这两类控件的强调色描边被这一条顶掉了（边界要的是对比，不是色相），
   发光那一圈照旧；输入框从前吃配色里的 --input-border（比卡面重一点，但只有 1.x 的对比），现在也归这条细边。
   分段选择不描边、卡片角上那三个和工具条上只摆图片的不描边。 */
${pre(EDGE)}{border:1px solid ${EDGE_V};}
/* 一行按钮里那种只摆图片的、卡角上那三个：不给影子（没底可投），也不描边。
   这一串的选择器比上面那一条重一级，所以 border:0 顶得住。 */
${under('html', BARE)}{box-shadow:none;border:0;}
/* 焦点框：单独一条描边，不吃模式那档边框粗细 —— 质感这一档的边框宽度是 0，
   从前只在 :focus 里改一下边框色等于根本没有焦点框（WCAG 2.4.7）。
   用 outline 不占位、不挤布局，2px 的线按上面那条细边同一个色号走，和相邻那块面 3:1。
   名单比描边那一串宽三处，都是 2026-10-04 在设置那一屏键盘Tab 走查出来的：
     · 分段选择里那一个一个（.fd-seg button / .wnw-seg button）—— 控件是外面那一圈 .fd-seg，
       里面这几个是裸 button，按定稿不描边（槽底那点色差已经把格分开了），但键盘是一个一个走的，
       不给这一条就只剩浏览器自己那条细线，和旁边那个按钮的焦点框两种样子；
     · 只摆图片的那几个（BARE 那一串：卡片角上、工具条上）—— 不描边是不给影子不圈边框，
       不等于键盘走过去没有落点；
     · 滑杆（圆角字号那几条；纹理强度那根 2026-10-08 整串撤了）—— 控件名单里从来没有 input[type=range]。 */
${suf(FOCUS, ':focus-visible')}{outline:2px solid ${EDGE_V};outline-offset:2px;}
/* 分段选择里那几个的焦点框往里画：外面那一圈 .fd-seg / .wnw-seg 带 overflow:hidden（选中那个的
   底色得被圆角裁住），往外的描边当场被裁掉，四边只剩一截都没有。改成 -2px 贴着格子内侧画，
   同样是 2px 的 --ctl-edge，一样不占位、不挤布局。 */
${suf('.fd-seg button,.wnw-seg button', ':focus-visible')}{outline:2px solid ${EDGE_V};outline-offset:-2px;}
/* 坐在强调色底上的那几个（主按钮、分段选择里选中的那一格）：焦点框换成反白字那个色号。
   上面那条灰线是按「卡面 / 输入框底 / 分段槽底」推的，一块线做不到同时离深色卡面和亮强调色
   都差 3 倍以上（RP 黑暗那套两头只有 6.95，数学上要 ≥9 才有解）；--sel-text 本来就是按这块底
   配出来的，拿它当焦点框颜色稳过 3:1。出处：无障碍走查 C-4。 */
${suf('.fd-btn.primary,.wnw-btn.primary,.fd-seg button.on,.wnw-seg button.on', ':focus-visible')}{outline-color:var(--sel-text,#fff);}
/* 鼠标指上去要有看得出的变化（无障碍走查 D-1 / D-3）：
   · 分段选择那一排从前压根没有 :hover，指上去只变光标，看不出这一格能按；
   · 卡角和工具条上那几个只摆图片的，从前铺的是「槽底」或「卡面掺一点」，而 --candidate-bg
     与卡面只差 1.09，按下去等于没变。
   两处都改成往正文文字色那一头掺：文字色对卡面至少 4.6，掺一成就是一级明度台阶，
   四档外观模式都成立。选中那一格（.on）不参与，免得把「选中」的那层底冲淡。 */
${suf('.fd-seg button:not(.on),.wnw-seg button:not(.on)', ':hover')}{background:color-mix(in srgb,var(--text) 8%,transparent);color:var(--text);}
${suf('.fd-tool,.fd-mbtn,.fd-wbtn,.wnw-btab:not(.on)', ':hover')}{background:color-mix(in srgb,var(--text) 10%,transparent);}
/* 纹理那一层：卡片表面和到边的栏铺，控件那一串 2026-10-04 从这一条里撤了 ——
   织纹压在按钮和输入框的轮廓上，会把刚分出来的那条细边一起吃掉（数值表第七节第 11 项）。
   不拦鼠标，也不盖住内容（isolation 把 z-index:-1 关在这一格里）。
   区域这一份是后补的：铺不到章纲栏和正文栏，就是「卡片有纸纹、正文和它旁边那两栏没纸纹」。
   Flow-Desk 的背景那一格不吃这一条（它不在这些块里），走的是模板里 #wallTex 那一条 ——
   同一串变量、同一张图、同一个格位、同一个去色法（2026-10-08 作者的话：纹理会进入
   「所有的FD背景、卡片背景、展开后的组件背景等」）。 */
${suf(SURF + ',' + AREA_CARD + ',' + AREA_PAGE, '::after')}{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;pointer-events:none;
  background:var(--tex-image,none) repeat;background-size:var(--tex-size,auto);opacity:var(--tex-opacity,0);
  filter:var(--tex-filter,none);}
/* 按下那一瞬间的反馈（无障碍走查 D-4）：从前只有浮雕档有，其余几档按下去只有边框换个色，
   看不出「按到了」。2026-10-04 撤掉浮雕那一档，这一句留下当各档共用的那一条：
   用逗号把这一档原有的那条控件影子原样带上，再往里叠一道细内影。 */
${suf('.fd-btn,.wnw-btn', ':active')}{box-shadow:var(--sh-ctl,none),inset 0 1px 2px rgba(0,0,0,.18);}
/* ---------- 挑色那一排：一套「选中了哪一个」的确认语言（外13-O 定这套，外15 改轻）----------
   只留外面那一圈环，色点自己那一小块面一个像素都不盖：
     描边 —— 外头两圈：先一圈和所在那块面同色的间隔（0 0 0 2px），再一圈正文文字色的实心环（0 0 0 3px）。
        间隔那一圈是让外环不贴在相邻那个色点上糊成一团，环本身走 --text，四套外观模式都够 3:1。
   外13-O 那两遍还画过的那两件 2026-10-05 撤了：色点内侧那一圈同面色的环、点中心那枚勾。
   两件都落在色点自己身上，14~15 像素的一个点被盖掉中间一圈，看不出这一个到底是什么颜色。
   没选中的那几个一起降到五成半，和选中的那一个差一大截。
   键盘焦点框照旧是那条 2px 描边（外11-A / 外11-E / 外9-E 定的那一条不缩），只是往外挪到 4px，
   免得焦点环和选中环叠在一起看不出是两条。 */
${under('html', PICK)}{position:relative;}
${under('html', PICK.split(',').map(s => s + ':not(.on)').join(','))}{opacity:.55;}
/* 色卡那一屏（.fd-dots-pool）是上面那一条压暗的唯一例外（作者 2026-10-09：
   「不要选中变色！！！！！！！！！！会让用户感觉选错了」）。那一屏一次摆几百颗，
   挑中一颗就把其余全压到五成半 —— 满屏的颜色一起变淡，看着既像自己点错了，又像这一屏的色被改了。
   这一屏只留下面那一圈环当选中态，一颗都不许变。 */
${under('html', '.fd-dots-pool button.fd-dot:not(.on)')}{opacity:1;}
${under('html', PICK.split(',').map(s => s + '.on').join(','))}{opacity:1;
  box-shadow:0 0 0 2px var(--card-face,var(--card-bg)),0 0 0 3px var(--text);}
${suf(PICK.split(',').map(s => s + '.on').join(','), ':focus-visible')}{outline-offset:4px;}
/* 下拉里「这一条正被选用」的确认：和上面同一套语言里的勾那一件（行的形状，圈不成环）。
   底色 + 加粗从前只写着「不一样」，没写着「就是它」，1.4.1 也不许只靠颜色分别。 */
${suf('.fd-sel-item.on.on', '::after')}{content:"";flex:0 0 auto;width:7px;height:3.5px;margin-left:6px;
  border-left:2px solid var(--text);border-bottom:2px solid var(--text);transform:rotate(-45deg) translateY(-2px);}
/* 辉光：标题那几处带光晕，正文和次级文字不给（参照页里次级文字也是干净的） */
${under('html[data-mode="glow"]', '.fd-card-head,.fd-dialog-head,.wnw-panel-head,.wnw-card-title')}{text-shadow:var(--look-glow,none);}`;
  const put = () => {
    let el = document.getElementById('fd-look-style');
    if(!el){ el = document.createElement('style'); el.id = 'fd-look-style'; (document.head || document.documentElement).appendChild(el); }
    el.textContent = CSS;
  };
  put();
})();
