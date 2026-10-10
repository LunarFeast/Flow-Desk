# ============================================================
#  Flow-Desk - swatch OCR (one-shot child process)
#  Read a color-swatch card image, hand it to the built-in offline OCR
#  (Windows.Media.Ocr) and print ONE json line on stdout:
#    {"ok":true,"ow":<w>,"oh":<h>,"lines":[{"t":"C05","x":..,"y":..,"w":..,"h":..}]}
#  ow/oh is the size of the bitmap that was actually recognised, so the page can
#  map a text box onto the smaller image it sampled the colours from.
#  Nothing is uploaded and nothing is installed: the engine ships with Windows.
#  Usage: powershell -File ocr-swatch.ps1 -Path <image> [-MaxSide 1600]
#  Keep this file ASCII only: PowerShell 5.1 decodes BOM-less files as the
#  local ANSI codepage, so Chinese comments here break parsing.
# ============================================================
param(
  [Parameter(Mandatory = $true)][string]$Path,
  [int]$MaxSide = 1600
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Emit($objOrText){
  if($objOrText -is [string]){ [Console]::Out.WriteLine($objOrText) }
  else { [Console]::Out.WriteLine(($objOrText | ConvertTo-Json -Compress -Depth 4)) }
  [Console]::Out.Flush()
}
function Fail($msg){ Emit (@{ ok = $false; msg = ([string]$msg -replace '\s+', ' ') }) }

$tmp = $null
try {
  if(-not (Test-Path -LiteralPath $Path)){ throw 'file not found: ' + $Path }

  # --- WinRT metadata as compile-time references ------------------------------
  # Add-Type cannot reference a .winmd directly (0x80131047), so copy the ones we
  # need into a per-process temp folder under a .dll name (same trick as the
  # SMTC watcher; per-PID so two FD apps never overwrite each other's copies).
  $wm  = Join-Path $env:SystemRoot 'System32\WinMetadata'
  $ref = Join-Path $env:TEMP ('fd-winmd-ref-' + $PID)
  if(-not (Test-Path $ref)){ New-Item -ItemType Directory -Path $ref | Out-Null }
  $refs = New-Object System.Collections.ArrayList
  foreach($f in @('Windows.foundation', 'Windows.graphics', 'Windows.media', 'Windows.storage', 'Windows.Globalization')){
    $src = Join-Path $wm ($f + '.winmd')
    if(-not (Test-Path $src)){ continue }
    $dst = Join-Path $ref ($f + '.dll')
    Copy-Item $src $dst -Force
    [void]$refs.Add($dst)
  }
  if($refs.Count -lt 3){ throw 'WinMetadata not found, OCR is unavailable on this system' }

  $code = @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Text;
using System.Threading;
using Windows.Foundation;
using Windows.Graphics.Imaging;
using Windows.Media.Ocr;
using Windows.Storage;
using Windows.Storage.Streams;

public static class Sw
{
    /* WinRT async, waited by hand: .AsTask() needs the full Windows metadata,
       which the trimmed System32 winmds do not always carry. */
    static T Await<T>(IAsyncOperation<T> op)
    {
        if (op == null) return default(T);
        ManualResetEvent done = new ManualResetEvent(false);
        op.Completed = delegate { try { done.Set(); } catch (Exception) { } };
        if (!done.WaitOne(25000)) throw new TimeoutException("winrt await timeout");
        return op.GetResults();
    }
    static string Esc(string s)
    {
        StringBuilder b = new StringBuilder();
        foreach (char c in (s ?? "")) {
            if (c == '"') b.Append("\\\""); else if (c == '\\') b.Append("\\\\");
            else if (c == '\n') b.Append("\\n"); else if (c == '\r') b.Append("\\r");
            else if (c == '\t') b.Append("\\t"); else if (c < 32) b.Append(' '); else b.Append(c);
        }
        return b.ToString();
    }

    public static string Run(string path, int maxSide)
    {
        OcrEngine eng = OcrEngine.TryCreateFromUserProfileLanguages();
        if (eng == null) {
            /* Profile language has no recognizer pack: fall back to any language
               on the system that does. */
            try {
                foreach (var lang in OcrEngine.AvailableRecognizerLanguages) {
                    eng = OcrEngine.TryCreateFromLanguage(lang);
                    if (eng != null) break;
                }
            } catch (Exception) { }
            if (eng == null)
                return "{\"ok\":false,\"msg\":\"no OCR language pack installed (Windows settings > time and language > language > OCR)\"}";
        }
        int cap = (int)Math.Max(320L, Math.Min((long)maxSide, (long)OcrEngine.MaxImageDimension));

        /* Downscale with GDI first: keeps the boxes small, and beats whatever
           hard size limit the engine has. MemoryStream so the source file is not locked. */
        string tmp = Path.Combine(Path.GetTempPath(), "fd-ocr-" + System.Diagnostics.Process.GetCurrentProcess().Id + ".png");
        int sw, sh;
        using (Stream fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
        using (Image src = Image.FromStream(fs)) {
            double k = Math.Min(1.0, (double)cap / Math.Max(src.Width, src.Height));
            sw = Math.Max(1, (int)Math.Round(src.Width * k));
            sh = Math.Max(1, (int)Math.Round(src.Height * k));
            using (Bitmap bmp = new Bitmap(sw, sh)) {
                using (Graphics g = Graphics.FromImage(bmp)) {
                    g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                    g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
                    g.DrawImage(src, new Rectangle(0, 0, sw, sh));
                }
                bmp.Save(tmp, ImageFormat.Png);
            }
        }
        try {
            StorageFile sf = Await(StorageFile.GetFileFromPathAsync(tmp));
            if (sf == null) return "{\"ok\":false,\"msg\":\"temp png unreadable\"}";
            IRandomAccessStream rs = Await(sf.OpenAsync(FileAccessMode.Read));
            BitmapDecoder dec = Await(BitmapDecoder.CreateAsync(rs));
            /* Ask the decoder for the pixel format the engine takes; if this
               codec refuses, fall back to whatever the native frame is. */
            SoftwareBitmap bm = null;
            try { bm = Await(dec.GetSoftwareBitmapAsync(BitmapPixelFormat.Bgra8, BitmapAlphaMode.Ignore)); }
            catch (Exception) { bm = null; }
            if (bm == null) bm = Await(dec.GetSoftwareBitmapAsync());
            if (bm == null) return "{\"ok\":false,\"msg\":\"decode failed\"}";
            OcrResult res = Await(eng.RecognizeAsync(bm));
            int ow = bm.PixelWidth, oh = bm.PixelHeight;
            StringBuilder sb = new StringBuilder();
            sb.Append("{\"ok\":true,\"lang\":\"").Append(Esc(eng.RecognizerLanguage.LanguageTag)).Append("\"");
            sb.Append(",\"ow\":").Append(ow).Append(",\"oh\":").Append(oh).Append(",\"lines\":[");
            int n = 0;
            if (res != null) {
                foreach (OcrLine ln in res.Lines) {
                    string t = (ln.Text ?? "").Trim();
                    if (t.Length == 0) continue;
                    double x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
                    foreach (OcrWord w in ln.Words) {
                        Rect r = w.BoundingRect;
                        if (r.X < x0) x0 = r.X;
                        if (r.Y < y0) y0 = r.Y;
                        if (r.X + r.Width > x1) x1 = r.X + r.Width;
                        if (r.Y + r.Height > y1) y1 = r.Y + r.Height;
                    }
                    if (x1 <= x0 || y1 <= y0) { x0 = 0; y0 = 0; x1 = 1; y1 = 1; }
                    if (n++ > 0) sb.Append(',');
                    sb.Append("{\"t\":\"").Append(Esc(t)).Append("\",\"x\":").Append((int)Math.Round(x0));
                    sb.Append(",\"y\":").Append((int)Math.Round(y0)).Append(",\"w\":").Append((int)Math.Round(x1 - x0));
                    sb.Append(",\"h\":").Append((int)Math.Round(y1 - y0)).Append('}');
                }
            }
            sb.Append("]}");
            return sb.ToString();
        } finally {
            try { File.Delete(tmp); } catch (Exception) { }
        }
    }
}
'@
  $more = @('System.Runtime', 'System.Runtime.WindowsRuntime', 'System.Runtime.InteropServices.WindowsRuntime',
            'System.Drawing', 'netstandard', 'System', 'System.Core', 'mscorlib')
  Add-Type -TypeDefinition $code -Language CSharp -ReferencedAssemblies (@($refs) + $more) -ErrorAction Stop
  $line = [Sw]::Run([System.IO.Path]::GetFullPath($Path), [int]$MaxSide)
  Emit $line
} catch {
  $m = $_.Exception.Message
  if([string]::IsNullOrEmpty($m) -or $m -match 'compilation'){
    try { $m = ($_.Exception.ToString() -replace '\s+', ' ') } catch { }
  }
  Fail $m
  exit 1
}
