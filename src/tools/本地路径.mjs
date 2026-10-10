/* 本地那一颗「本地路径.cjs」的取口（它不进仓，所以公开面上读不到这台机器的盘符和私人目录）。
   这一份进仓，取值一律走这儿：没那一颗就回空串，用它的工具各自有「不在就不量 / 不在就报错」那一句。
   换机器怎么办：照 本地路径.cjs 那份形状自己写一颗，或者像 src\tools\colour-v1.mjs 那样直接给命令行参数。 */
const 表 = await import('./本地路径.cjs').then(m => m.default || {}).catch(() => ({}));
const 清 = s => String(s || '').replace(/[\\/]+$/, '');
export const 素材目录 = 清(表.素材目录);
export const 色表 = 表.色表 || (素材目录 ? 素材目录 + '/Colour v1.md' : '');
export const 音乐目录 = 清(表.音乐目录);
export const 点名曲 = String(表.点名曲 || '');
export const 工区 = 清(表.工区);
export const 存档落点 = 清(表.存档落点);
export const 探针沙盒 = 清(表.探针沙盒);
