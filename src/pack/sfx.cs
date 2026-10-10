/* ============================================================
   Flow-Desk 的首装那一个壳（自解压单 exe）
   ------------------------------------------------------------
   这一份是给 publish.mjs 当"信封"用的：publish 把这棵树的出厂内容压成一包 zip，
   整段粘在这个 exe 屁股后面（Windows 不在乎 exe 后面多出几百 MB，照样跑得起来），
   双击它 = 自己摊成一棵 Flow-Desk\ 然后开起来。
   为什么用"粘在后面"而不是"塞进资源里"：塞进资源要把内容编译进源文件，
   而粘在后面这个壳编一次能配每一版用，publish 只管换尾巴。

   只用 Windows 自带的那点东西：.NET Framework 4 的 csc.exe 编译（Win10/11 就有），
   不引第三方压缩库 —— zip 的目录自己读，压住的那一段交给 DeflateStream。
   参数（都是自测和特殊场合用的，双击时一个都不用给）：
     --dest=<路径>   摊到哪儿（默认：这个 exe 旁边的 Flow-Desk\）
     --no-run        摊完不开程序
     --quiet         不弹窗，闷头摊（探针跑这条，看返回值和磁盘上的东西验收）
   ============================================================ */
using System;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Collections.Generic;
using System.Windows.Forms;
using System.Drawing;

static class Sfx
{
    /* ---------- zip：只读，认自己写出去那一种（store / deflate，名字一律 utf8）---------- */
    class Entry
    {
        public string Name;      /* 用 / 分隔的树内相对路径 */
        public long LocalOff;    /* 本地头在这包 zip 里的起点（还没加整包的偏移） */
        public long CSize;
        public long USize;
        public int Method;
    }

    class Payload
    {
        public List<Entry> Items = new List<Entry>();
        public long Start;       /* 这包 zip 从这个 exe 的第几字节开始 */
        public long Total;
    }

    /* 读条目的数据时不许越过本条的长度：DeflateStream 会往前多要一口，
       不加这道闸就把下一条的开头一起吃掉了。 */
    class Bound : Stream
    {
        Stream inner; long left;
        public Bound(Stream s, long n){ inner = s; left = n; }
        public override bool CanRead { get { return true; } }
        public override bool CanSeek { get { return false; } }
        public override bool CanWrite { get { return false; } }
        public override void Flush() { }
        public override long Length { get { return left; } }
        public override long Position { get { return 0; } set { throw new Exception("不许找"); } }
        public override int Read(byte[] buf, int o, int c)
        {
            if(left <= 0) return 0;
            int n = inner.Read(buf, o, (int)Math.Min(c, left));
            left -= n;
            return n;
        }
        public override long Seek(long o, SeekOrigin r){ throw new Exception("不许找"); }
        public override void SetLength(long v){ throw new Exception("不许改"); }
        public override void Write(byte[] b, int o, int c){ throw new Exception("不许写"); }
        protected override void Dispose(bool disposing){ }   /* 关的是这层闸，不是里面那把文件 */
    }

    static ushort U16(byte[] b, int i){ return BitConverter.ToUInt16(b, i); }
    static uint  U32(byte[] b, int i){ return BitConverter.ToUInt32(b, i); }

    /* 从末尾往回找中央目录结尾（EOCD），再算出整包在这个 exe 里的起点：
       中央目录正好停在 EOCD 前面，所以「EOCD 的位置 − 目录大小 − 目录里写的起点」就是这包的起点
       （目录里那些偏移都是"包里第几字节"，取任何一条的数据前都得把这个起点加上）。 */
    static Payload Open(string self)
    {
        using(FileStream fs = File.OpenRead(self))
        {
            long len = fs.Length;
            int back = (int)Math.Min(len, 66000);
            byte[] tail = new byte[back];
            fs.Seek(len - back, SeekOrigin.Begin);
            fs.Read(tail, 0, back);
            int p = -1;
            for(int i = back - 22; i >= 0; i--)
                if(tail[i] == 0x50 && tail[i+1] == 0x4b && tail[i+2] == 0x05 && tail[i+3] == 0x06){ p = i; break; }
            if(p < 0) return null;
            int count = U16(tail, p + 10);
            long cdSize = U32(tail, p + 12);
            long cdOff = U32(tail, p + 16);
            long start = (len - back + p) - cdSize - cdOff;
            if(start < 0 || count <= 0) return null;

            Payload pl = new Payload();
            pl.Start = start;
            fs.Seek(start + cdOff, SeekOrigin.Begin);
            byte[] head = new byte[46];
            for(int k = 0; k < count; k++)
            {
                fs.Read(head, 0, 46);
                if(U32(head, 0) != 0x02014b50) return null;
                int nl = U16(head, 28), el = U16(head, 30), cl = U16(head, 32);
                byte[] nm = new byte[nl];
                fs.Read(nm, 0, nl);
                Entry e = new Entry();
                e.Name = Encoding.UTF8.GetString(nm);
                e.Method = U16(head, 10);
                e.CSize = U32(head, 20);
                e.USize = U32(head, 24);
                e.LocalOff = U32(head, 42);
                pl.Items.Add(e);
                pl.Total += e.USize;
                fs.Seek(el + cl, SeekOrigin.Current);
            }
            return pl;
        }
    }

    /* 路径先审一遍：.. 跳出去的、带盘符的一概不要 */
    static bool Clean(string name)
    {
        if(string.IsNullOrEmpty(name)) return false;
        if(name.IndexOf(':') >= 0) return false;
        foreach(string s in name.Replace('\\', '/').Split('/'))
            if(s == "..") return false;
        return true;
    }

    /* 本地头里的名字/附加长度和中央目录里可能不一样，取数据起点以本地头为准 */
    static long DataStart(FileStream fs, long localHeader)
    {
        long back = fs.Position;
        fs.Seek(localHeader, SeekOrigin.Begin);
        byte[] lh = new byte[30];
        fs.Read(lh, 0, 30);
        if(U32(lh, 0) != 0x04034b50) throw new Exception("包里文件头对不上");
        long at = localHeader + 30 + U16(lh, 26) + U16(lh, 28);
        fs.Seek(back, SeekOrigin.Begin);
        return at;
    }

    static long Copy(Stream src, Stream dst)
    {
        byte[] buf = new byte[1 << 20];
        long n0 = 0;
        int n;
        while((n = src.Read(buf, 0, buf.Length)) > 0)
        {
            dst.Write(buf, 0, n);
            n0 += n;
        }
        return n0;
    }

    static long Copy(Stream src, Stream dst, Action<long> tick)
    {
        byte[] buf = new byte[1 << 20];
        long n0 = 0;
        int n;
        while((n = src.Read(buf, 0, buf.Length)) > 0)
        {
            dst.Write(buf, 0, n);
            n0 += n;
            if(tick != null) tick(n);
        }
        return n0;
    }

    /* 包里的一个小文件整个读进内存（就用来看那份安装标记） */
    static byte[] ReadEntry(FileStream fs, long zipStart, Entry it)
    {
        fs.Seek(DataStart(fs, zipStart + it.LocalOff), SeekOrigin.Begin);
        byte[] raw = new byte[it.CSize];
        fs.Read(raw, 0, raw.Length);
        if(it.Method == 0) return raw;
        using(MemoryStream ms = new MemoryStream(raw))
        using(DeflateStream ds = new DeflateStream(ms, CompressionMode.Decompress))
        using(MemoryStream outm = new MemoryStream())
        {
            Copy(ds, outm);
            return outm.ToArray();
        }
    }

    /* 标记里那一行给人看的版本号（"label" 那一个字段）：不引 JSON 库，掐字符串够用 */
    static string MarkerLabel(FileStream fs, Payload pl)
    {
        Entry it = pl.Items.Find(delegate(Entry e){ return e.Name == "flow-desk-install.json"; });
        if(it == null) return "";
        try{
            string txt = Encoding.UTF8.GetString(ReadEntry(fs, pl.Start, it));
            int i = txt.IndexOf("\"label\"");
            if(i < 0) return "";
            int a = txt.IndexOf('"', txt.IndexOf(':', i) + 1);
            int b = txt.IndexOf('"', a + 1);
            if(a < 0 || b <= a) return "";
            return txt.Substring(a + 1, b - a - 1);
        }catch(Exception){ return ""; }
    }

    /* ---------- 正事：把尾巴上那一包摊到 dest 里 ---------- */
    class Result { public int Files; public long Bytes; public string Error; }

    static Result Extract(string self, string dest, Action<long, long> onProgress)
    {
        Result r = new Result();
        try{
            Payload pl = Open(self);
            if(pl == null){ r.Error = "这个 exe 后面没有包：要么它不是发布出来的首装包，要么拷贝/下载被截断了。"; return r; }
            long total = pl.Total, done = 0;
            using(FileStream fs = File.OpenRead(self))
            {
                foreach(Entry it in pl.Items)
                {
                    if(!Clean(it.Name)){ r.Error = "包里有跳出去的路径：" + it.Name; return r; }
                    string to = Path.Combine(dest, it.Name.Replace('/', Path.DirectorySeparatorChar));
                    Directory.CreateDirectory(Path.GetDirectoryName(to));
                    fs.Seek(DataStart(fs, pl.Start + it.LocalOff), SeekOrigin.Begin);
                    Stream src = it.Method == 0
                        ? (Stream)new Bound(fs, it.CSize)
                        : new DeflateStream(new Bound(fs, it.CSize), CompressionMode.Decompress);
                    using(src)
                    using(Stream w = new FileStream(to, FileMode.Create, FileAccess.Write, FileShare.None))
                    {
                        long got = Copy(src, w, null);
                        if(got != it.USize){ r.Error = it.Name + " 摊出来的字节数不对（" + got + " ≠ " + it.USize + "），这一包别用了。"; return r; }
                        done += got;
                    }
                    r.Files++; r.Bytes += it.USize;
                    if(onProgress != null) onProgress(done, total);
                }
            }
        }catch(Exception e){ r.Error = e.Message; }
        return r;
    }

    /* ---------- 界面：一句话 + 目标目录 + 一根进度条，别整花活 ---------- */
    class Dlg : Form
    {
        public TextBox Box;
        public Button Go, Pick;
        public ProgressBar Bar;
        public Label Info, Stat;
        public Dlg(string label, string def)
        {
            Text = "Flow-Desk 首装";
            StartPosition = FormStartPosition.CenterScreen;
            MaximizeBox = false;
            ClientSize = new Size(520, 214);
            Info = new Label();
            Info.Left = 16; Info.Top = 14; Info.Width = 488; Info.Height = 52;
            Info.Text = label + "\r\n摊到这儿（整个文件夹挪走就算卸载，不写注册表）：";
            Box = new TextBox();
            Box.Left = 16; Box.Top = 72; Box.Width = 400; Box.Text = def;
            Pick = new Button();
            Pick.Left = 424; Pick.Top = 68; Pick.Width = 80; Pick.Height = 26; Pick.Text = "换个地方";
            Pick.Click += delegate{
                using(FolderBrowserDialog f = new FolderBrowserDialog()){
                    f.SelectedPath = Box.Text;
                    if(f.ShowDialog(this) == DialogResult.OK) Box.Text = f.SelectedPath;
                }
            };
            Go = new Button();
            Go.Left = 16; Go.Top = 108; Go.Width = 120; Go.Height = 30; Go.Text = "开始安装";
            Bar = new ProgressBar();
            Bar.Left = 16; Bar.Top = 150; Bar.Width = 488; Bar.Height = 14; Bar.Maximum = 1000;
            Stat = new Label();
            Stat.Left = 16; Stat.Top = 172; Stat.Width = 488; Stat.Height = 20; Stat.Text = "还没开始";
            Controls.Add(Info); Controls.Add(Box); Controls.Add(Pick); Controls.Add(Go);
            Controls.Add(Bar); Controls.Add(Stat);
        }
    }

    static string DestOf(Dlg d){ return d.Box.Text.Trim().Trim('"'); }

    static int Finish(Dlg d, Result r, bool run)
    {
        string dest = DestOf(d);
        if(r.Error != null){
            MessageBox.Show(d, "没摊成：" + r.Error + "\r\n已经摊出来的那一半在\r\n" + dest + "\r\n整个文件夹删掉重来就行。",
                "Flow-Desk 首装", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 4;
        }
        if(!File.Exists(Path.Combine(dest, "Flow-Desk.exe"))){
            MessageBox.Show(d, "摊完了，可这棵树的根上没有 Flow-Desk.exe —— 这一包不全，换个下载来源再试。",
                "Flow-Desk 首装", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 6;
        }
        try{ d.Bar.Value = 1000; d.Stat.Text = "摊好了 · " + r.Files + " 个文件 · " + MB(r.Bytes) + (run ? "，这就开" : ""); }catch(Exception){ }
        if(run) Launch(dest);
        Thread.Sleep(700);
        return 0;
    }

    [STAThread]
    static int Main(string[] argv)
    {
        string self = Process.GetCurrentProcess().MainModule.FileName;
        string dest = null;
        bool run = true, quiet = false;
        foreach(string a in argv)
        {
            if(a.StartsWith("--dest=")) dest = a.Substring(7);
            else if(a == "--no-run") run = false;
            else if(a == "--quiet") quiet = true;
        }
        if(string.IsNullOrEmpty(dest)) dest = Path.Combine(Path.GetDirectoryName(self), "Flow-Desk");
        dest = Path.GetFullPath(dest);

        if(IsTree(dest))
        {
            Say(quiet, "这儿已经有一棵 Flow-Desk 了：\r\n" + dest +
                "\r\n升级别用这一个 —— 打开它，在 设置 → 程序 → 本地更新 里挑更新包（那才会把旧的那一份挪进备份）。");
            return 2;
        }

        if(quiet)
        {
            Result r = Extract(self, dest, null);
            if(r.Error != null){ Console.WriteLine("没摊成：" + r.Error); return 4; }
            if(!File.Exists(Path.Combine(dest, "Flow-Desk.exe"))){ Console.WriteLine("摊完了，但根上没有 Flow-Desk.exe"); return 6; }
            if(run) Launch(dest);
            Console.WriteLine("摊好 " + r.Files + " 个文件 · " + MB(r.Bytes) + " → " + dest);
            return 0;
        }

        Payload peek = Open(self);
        string label = "Flow-Desk 便携版";
        if(peek == null){ MessageBox.Show("这个 exe 后面没有包，摊不出东西来。", "Flow-Desk 首装"); return 3; }
        using(FileStream fs = File.OpenRead(self)) label = MarkerLabel(fs, peek);
        if(string.IsNullOrEmpty(label)) label = "Flow-Desk 便携版";

        Application.EnableVisualStyles();
        Dlg d = new Dlg(label, dest);
        int code = 5;   /* 5 = 没点安装就关了 */
        d.Go.Click += delegate{
            d.Go.Enabled = false; d.Pick.Enabled = false; d.Box.Enabled = false;
            Thread th = new Thread(delegate(){
                Result r = Extract(self, DestOf(d), delegate(long done, long total){
                    try{
                        d.BeginInvoke((Action)delegate{
                            d.Bar.Value = total <= 0 ? 0 : (int)Math.Min(1000, done * 1000 / total);
                            d.Stat.Text = "正在摊开 " + MB(done) + " / " + MB(total);
                        });
                    }catch(Exception){}
                });
                code = Finish(d, r, run);
                try{ d.BeginInvoke((Action)delegate{ d.Close(); }); }catch(Exception){}
            });
            th.IsBackground = true;
            th.Start();
        };
        Application.Run(d);
        return code;
    }

    static void Launch(string dest)
    {
        try{
            ProcessStartInfo si = new ProcessStartInfo(Path.Combine(dest, "Flow-Desk.exe"));
            si.WorkingDirectory = dest;
            si.UseShellExecute = true;
            Process.Start(si);
        }catch(Exception){}
    }

    static bool IsTree(string dest)
    {
        return File.Exists(Path.Combine(Path.Combine(dest, "resources"), Path.Combine("app", "main.cjs")));
    }

    static string MB(long b){ return (b / 1048576.0).ToString("0.#") + " MB"; }

    static void Say(bool quiet, string msg)
    {
        if(quiet){ Console.WriteLine(msg); return; }
        MessageBox.Show(msg, "Flow-Desk 首装", MessageBoxButtons.OK, MessageBoxIcon.Information);
    }
}
