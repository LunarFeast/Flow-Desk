# ============================================================
#  Flow-Desk · SMTC watcher (resident child process)
#  Windows SMTC (System Media Transport Controls) is the one channel that
#  every modern player publishes: Spotify, PotPlayer, Media Player, Groove,
#  browser tabs, foobar2000 with its component ... plus MusicBee once the
#  Flow-Desk Bridge plugin is installed (MusicBee itself publishes nothing).
#  So this watcher does NOT hardcode a player: it enumerates every session,
#  attaches WinRT events to all of them, and picks the one worth driving.
#    pick order: status Playing > Paused > Opening/Changing > rest,
#                ties broken by what Windows marks as the current session,
#                sessions whose app matches "self" skipped in auto mode.
#    pin order:  as soon as a pin is set, auto mode stops; if the pinned app
#                has no session we say so (pinOk=false) instead of quietly
#                driving a different player.
#  No timers, no polling: while nothing changes we sit in ReadLine. One JSON
#  line per event. Commands arrive on stdin, one JSON object per line:
#    {"cmd":"snapshot"} {"cmd":"play"} {"cmd":"pause"} {"cmd":"toggle"}
#    {"cmd":"next"}    {"cmd":"prev"}  {"cmd":"stop"}  {"cmd":"seek","pos":<ms>}
#    {"cmd":"pick","app":"<SourceAppUserModelId or ''>"}   pin / unpin
#    {"cmd":"self","app":"<our own app id>"}               skip in auto mode
#  Keep this file ASCII only: PowerShell 5.1 decodes BOM-less files as the
#  local ANSI codepage, so Chinese comments here break parsing.
# ============================================================
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Out-Json($obj){
  $line = $obj | ConvertTo-Json -Compress -Depth 6
  [Console]::Out.WriteLine($line); [Console]::Out.Flush()
}
function Fail($msg){ Out-Json @{ ev='bye'; ok=$false; msg=[string]$msg } }

try {
  # --- WinRT metadata as compile-time references -----------------------------
  # Add-Type cannot reference a .winmd directly (0x80131047), so copy the four
  # we need into a per-process temp folder under a .dll name. Per-PID: two FD
  # apps starting at once must not overwrite each other's copies mid-compile.
  $wm  = Join-Path $env:SystemRoot 'System32\WinMetadata'
  $ref = Join-Path $env:TEMP ('fd-winmd-ref-' + $PID)
  if(-not (Test-Path $ref)){ New-Item -ItemType Directory -Path $ref | Out-Null }
  $refs = New-Object System.Collections.ArrayList
  foreach($f in @('Windows.foundation','Windows.media','Windows.storage','Windows.graphics')){
    $src = Join-Path $wm ($f + '.winmd')
    if(-not (Test-Path $src)){ continue }
    $dst = Join-Path $ref ($f + '.dll')
    Copy-Item $src $dst -Force
    [void]$refs.Add($dst)
  }
  if($refs.Count -lt 2){ throw 'WinMetadata not found, SMTC is unavailable on this system' }

  $code = @'
using System;
using System.Collections.Generic;
using System.Text;
using System.Threading;
using Windows.Foundation;
using Windows.Media.Control;

public static class Smtc
{
    class Sink
    {
        public GlobalSystemMediaTransportControlsSession s;
        public TypedEventHandler<GlobalSystemMediaTransportControlsSession, PlaybackInfoChangedEventArgs> a;
        public TypedEventHandler<GlobalSystemMediaTransportControlsSession, MediaPropertiesChangedEventArgs> b;
        public TypedEventHandler<GlobalSystemMediaTransportControlsSession, TimelinePropertiesChangedEventArgs> c;
        public Sink(GlobalSystemMediaTransportControlsSession sess)
        {
            s = sess;
            a = delegate (GlobalSystemMediaTransportControlsSession x, PlaybackInfoChangedEventArgs y) { Say("playback", AppOf(x)); };
            b = delegate (GlobalSystemMediaTransportControlsSession x, MediaPropertiesChangedEventArgs y) { Say("media", AppOf(x)); };
            c = delegate (GlobalSystemMediaTransportControlsSession x, TimelinePropertiesChangedEventArgs y) { Say("timeline", AppOf(x)); };
        }
        public void Attach()
        {
            try { s.PlaybackInfoChanged += a; } catch (Exception) { }
            try { s.MediaPropertiesChanged += b; } catch (Exception) { }
            try { s.TimelinePropertiesChanged += c; } catch (Exception) { }
        }
        public void Detach()
        {
            try { s.PlaybackInfoChanged -= a; } catch (Exception) { }
            try { s.MediaPropertiesChanged -= b; } catch (Exception) { }
            try { s.TimelinePropertiesChanged -= c; } catch (Exception) { }
        }
    }

    static GlobalSystemMediaTransportControlsSessionManager mgr;
    static List<Sink> sinks = new List<Sink>();
    static string pin = "";
    static string self = "";
    static string lastBody = "";
    static long t0;
    static long seq;

    /* WinRT async, waited by hand: .AsTask() needs the full Windows metadata, which the
       trimmed System32 winmds do not always carry. */
    static T Await<T>(IAsyncOperation<T> op)
    {
        return Await(op, 3000);
    }
    /* A provider that has just come up needs longer than a settled one for its first read. */
    static T Await<T>(IAsyncOperation<T> op, int timeoutMs)
    {
        if (op == null) return default(T);
        ManualResetEvent done = new ManualResetEvent(false);
        op.Completed = delegate { try { done.Set(); } catch (Exception) { } };
        if (!done.WaitOne(timeoutMs)) throw new TimeoutException("winrt await timeout");
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
    static string bt(bool v) { return v ? "true" : "false"; }
    static string AppOf(GlobalSystemMediaTransportControlsSession s)
    {
        try { return s == null || s.SourceAppUserModelId == null ? "" : s.SourceAppUserModelId; }
        catch (Exception) { return ""; }
    }
    static bool Same(string a, string b)
    {
        if (a == null) a = ""; if (b == null) b = "";
        return string.Equals(a, b, StringComparison.OrdinalIgnoreCase)
            || string.Equals(PathOf(a), PathOf(b), StringComparison.OrdinalIgnoreCase);
    }
    /* Players disagree about whether the id carries the .exe: "MusicBee.exe" versus
       "C:\\...\\MusicBee.exe". Compare the file name too so one pin matches either. */
    static string PathOf(string s)
    {
        string t = s.Trim();
        int i = t.LastIndexOfAny(new char[] { '\\', '/' });
        if (i >= 0) t = t.Substring(i + 1);
        return t;
    }

    public static void Start()
    {
        t0 = System.Diagnostics.Stopwatch.GetTimestamp();
        mgr = Await(GlobalSystemMediaTransportControlsSessionManager.RequestAsync());
        if (mgr == null) throw new Exception("SMTC manager unavailable");
        mgr.CurrentSessionChanged += delegate (GlobalSystemMediaTransportControlsSessionManager m,
            CurrentSessionChangedEventArgs a) { Hook(); Say("rescan", ""); };
        mgr.SessionsChanged += delegate (GlobalSystemMediaTransportControlsSessionManager m,
            SessionsChangedEventArgs a) { Hook(); Say("rescan", ""); };
        Hook();
        Say("ready", "");
    }

    static List<GlobalSystemMediaTransportControlsSession> Sessions()
    {
        List<GlobalSystemMediaTransportControlsSession> list = new List<GlobalSystemMediaTransportControlsSession>();
        if (mgr == null) return list;
        try { foreach (var s in mgr.GetSessions()) if (s != null) list.Add(s); }
        catch (Exception) { }
        return list;
    }

    /* Sessions come and go; the object identity behind GetSessions() is not promised,
       so a rescan simply detaches everything and re-attaches. That event is rare. */
    static void Hook()
    {
        foreach (Sink k in sinks) k.Detach();
        sinks.Clear();
        foreach (var s in Sessions()) { Sink k = new Sink(s); k.Attach(); sinks.Add(k); }
    }

    static int Rank(GlobalSystemMediaTransportControlsSession s)
    {
        try {
            string st = s.GetPlaybackInfo().PlaybackStatus.ToString();
            if (st == "Playing") return 0;
            if (st == "Paused") return 1;
            if (st == "Changing" || st == "Opened") return 2;
            return 3;
        } catch (Exception) { return 3; }
    }

    /* The one session the card and the commands talk to. */
    static GlobalSystemMediaTransportControlsSession Pick(out string how, out bool pinOk)
    {
        how = "none"; pinOk = true;
        List<GlobalSystemMediaTransportControlsSession> all = Sessions();
        if (all.Count == 0) return null;
        if (pin.Length > 0) {
            foreach (var s in all) if (Same(AppOf(s), pin)) { how = "pin"; return s; }
            pinOk = false; how = "pin-missing"; return null;
        }
        GlobalSystemMediaTransportControlsSession cur = null;
        try { cur = mgr.GetCurrentSession(); } catch (Exception) { }
        string curApp = AppOf(cur);
        GlobalSystemMediaTransportControlsSession win = null; int bestRank = 100; bool winIsCur = false;
        foreach (var s in all) {
            string app = AppOf(s);
            if (self.Length > 0 && Same(app, self)) continue;   // our own page, the card already knows its position
            int r = Rank(s);
            bool isCur = cur != null && Same(app, curApp);
            bool better = r < bestRank || (r == bestRank && isCur && !winIsCur);
            if (better) { bestRank = r; win = s; winIsCur = isCur; how = "auto"; }
        }
        return win;
    }

    static void Emit(string reason, string from, string body)
    {
        long ms = (System.Diagnostics.Stopwatch.GetTimestamp() - t0) * 1000 / System.Diagnostics.Stopwatch.Frequency;
        seq++;
        string line = "{\"seq\":" + seq + ",\"ev\":\"" + Esc(reason) + "\",\"ok\":true"
            + ",\"at\":" + DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            + ",\"since\":" + ms
            + (from.Length > 0 ? ",\"from\":\"" + Esc(from) + "\"" : "")
            + body + "}";
        Console.WriteLine(line);
        Console.Out.Flush();
    }

    /* A snapshot is complete when a session was picked and it carries a track name. */
    static bool Live(string body)
    {
        return body.IndexOf("\"session\":null") < 0 && body.IndexOf("\"title\":\"\"") < 0;
    }

    static void Say(string reason, string from)
    {
        string body;
        bool mustAnswer = reason == "ready" || reason == "ask" || reason == "pick" || reason == "self" || reason == "rescan";
        try { body = Body(); }
        catch (Exception e)
        {
            Console.WriteLine("{\"ev\":\"err\",\"reason\":\"" + Esc(reason) + "\",\"msg\":\"" + Esc(e.Message) + "\"}");
            Console.Out.Flush();
            Warm(reason, from);
            return;
        }
        /* A player we are not driving ticks every second; if nothing the card shows actually
           changed, stay quiet. Answered on demand (ask / pick / self / rescan) regardless. */
        if (!mustAnswer && body == lastBody) return;
        lastBody = body;
        Emit(reason, from, body);
        if (!Live(body)) Warm(reason, from);
    }

    /* A player that has just started, and a single-track playlist that was skipped forward,
       both raise their event BEFORE their state can be read: the session list is still empty,
       or the first TryGetMediaPropertiesAsync times out. No further event follows, so that
       first track would never reach the card. Three follow-up reads, about a second apart,
       ending as soon as a track shows up. Not a timer — only an empty read can start it, and
       an unchanged follow-up is dropped by the same rule Say uses, so a genuinely idle
       machine produces no output at all. Runs on the event thread, never the stdin loop. */
    static void Warm(string reason, string from)
    {
        for (int i = 0; i < 3; i++)
        {
            Thread.Sleep(900);
            string body;
            try { body = Body(); } catch (Exception) { continue; }
            if (body == lastBody) continue;
            lastBody = body;
            Emit("warm", from, body);
            if (Live(body)) return;
        }
    }

    /* Everything the card shows, without the counters: identical text means nothing changed.
       pos is what the player reported at read time; the page interpolates from it with the
       wall clock, so a track that keeps playing does not need any further reads. */
    static string Body()
    {
        string how; bool pinOk;
        GlobalSystemMediaTransportControlsSession s = Pick(out how, out pinOk);
        /* A player that rebuilt its session after a skip can be picked while the rescan that
           should have attached to it came up empty — re-hook before going event-blind. */
        if (sinks.Count == 0 && s != null) Hook();
        StringBuilder b = new StringBuilder();
        b.Append(",\"how\":\"").Append(Esc(how)).Append("\"");
        b.Append(",\"pin\":\"").Append(Esc(pin)).Append("\",\"pinOk\":").Append(bt(pinOk));
        b.Append(",\"n\":").Append(sinks.Count);
        b.Append(",\"list\":").Append(ListJson());
        if (s == null) { b.Append(",\"session\":null"); return b.ToString(); }
        var mp = Await(s.TryGetMediaPropertiesAsync(), 6000);
        var tl = s.GetTimelineProperties();
        var pi = s.GetPlaybackInfo();
        var ct = pi == null ? null : pi.Controls;
        b.Append(",\"app\":\"").Append(Esc(AppOf(s))).Append('"');
        b.Append(",\"title\":\"").Append(Esc(mp == null ? "" : mp.Title)).Append('"');
        b.Append(",\"artist\":\"").Append(Esc(mp == null ? "" : mp.Artist)).Append('"');
        b.Append(",\"album\":\"").Append(Esc(mp == null ? "" : mp.AlbumTitle)).Append('"');
        b.Append(",\"status\":\"").Append(Esc(pi == null ? "" : pi.PlaybackStatus.ToString())).Append('"');
        b.Append(",\"rate\":").Append(RateJson(pi));
        b.Append(",\"pos\":").Append(tl == null ? 0 : (long)tl.Position.TotalMilliseconds);
        b.Append(",\"dur\":").Append(tl == null ? 0 : (long)tl.EndTime.TotalMilliseconds);
        b.Append(",\"min\":").Append(tl == null ? 0 : (long)tl.MinSeekTime.TotalMilliseconds);
        b.Append(",\"max\":").Append(tl == null ? 0 : (long)tl.MaxSeekTime.TotalMilliseconds);
        b.Append(",\"can\":{\"p\":").Append(bt(ct != null && ct.IsPlayEnabled));
        b.Append(",\"x\":").Append(bt(ct != null && ct.IsPauseEnabled));
        b.Append(",\"t\":").Append(bt(ct != null && ct.IsPlayPauseToggleEnabled));
        b.Append(",\"n\":").Append(bt(ct != null && ct.IsNextEnabled));
        b.Append(",\"v\":").Append(bt(ct != null && ct.IsPreviousEnabled));
        b.Append(",\"s\":").Append(bt(ct != null && ct.IsStopEnabled));
        b.Append(",\"k\":").Append(bt(ct != null && ct.IsPlaybackPositionEnabled));
        b.Append('}');
        return b.ToString();
    }

    /* PlaybackInfo.PlaybackRate is a MediaPlaybackRate object on this PC, a plain number on
       others, so it is read reflectively and emitted as a JSON number.
       从前只认 Multiplier / Rate / Value 三个名字，而 Windows 那个对象上叫 Custom / Default / Min / Max，
       一个都对不上，落底恒回 "1" —— 播放器真用倍速时这边完全察觉不到（审查第 18 条）。
       Custom 是人手动定那一档（没定时为 0），所以先看 Custom，为 0 再看 Default，
       剩下三个名字留着给"直接就是个数字"或别家投影的那种。 */
    static string RateJson(GlobalSystemMediaTransportControlsSessionPlaybackInfo pi)
    {
        if (pi == null) return "1";
        object rate = null;
        try { rate = pi.PlaybackRate; } catch (Exception) { }
        if (rate == null) return "1";
        if (rate is IConvertible && !(rate is string)) {
            try {
                double d = Convert.ToDouble(rate, System.Globalization.CultureInfo.InvariantCulture);
                if (d > 0 && d < 1000) return d.ToString(System.Globalization.CultureInfo.InvariantCulture);
            } catch (Exception) { }
        }
        try {
            Type t = rate.GetType();
            string[] names = { "Custom", "Default", "Multiplier", "Rate", "Value" };
            foreach (string n in names) {
                var p = t.GetProperty(n);
                if (p == null) continue;
                object v = null;
                try { v = p.GetValue(rate, null); } catch (Exception) { continue; }
                if (v == null) continue;
                double d;
                try { d = Convert.ToDouble(v, System.Globalization.CultureInfo.InvariantCulture); } catch (Exception) { continue; }
                if (d > 0 && d < 1000) return d.ToString(System.Globalization.CultureInfo.InvariantCulture);
            }
        } catch (Exception) { }
        return "1";
    }

    /* Every session the machine publishes, so the settings panel can offer the real names
       instead of a hand-typed player. Kept short: app + status + title + duration. */
    static string ListJson()
    {
        StringBuilder b = new StringBuilder();
        b.Append('[');
        bool first = true;
        foreach (var s in Sessions()) {
            if (!first) b.Append(','); first = false;
            string title = "";
            try { var mp = Await(s.TryGetMediaPropertiesAsync()); title = mp == null ? "" : mp.Title; } catch (Exception) { }
            long dur = 0; string st = "";
            try { var tl = s.GetTimelineProperties(); dur = (long)tl.EndTime.TotalMilliseconds; } catch (Exception) { }
            try { st = s.GetPlaybackInfo().PlaybackStatus.ToString(); } catch (Exception) { }
            b.Append("{\"app\":\"").Append(Esc(AppOf(s)))
             .Append("\",\"st\":\"").Append(Esc(st))
             .Append("\",\"ti\":\"").Append(Esc(title))
             .Append("\",\"du\":").Append(dur).Append('}');
        }
        b.Append(']');
        return b.ToString();
    }

    public static string Command(string cmd, long pos, string app)
    {
        if (cmd == "pick") { pin = (app ?? "").Trim(); Say("pick", ""); return "{\"ev\":\"cmd\",\"cmd\":\"pick\",\"ok\":true,\"pin\":\"" + Esc(pin) + "\"}"; }
        if (cmd == "self") { self = (app ?? "").Trim(); Say("self", ""); return "{\"ev\":\"cmd\",\"cmd\":\"self\",\"ok\":true}"; }
        GlobalSystemMediaTransportControlsSession s; string how; bool pinOk;
        s = Pick(out how, out pinOk);
        if (s == null) {
            string why = pinOk ? "no player is publishing media right now" : "pinned player has no session: " + pin;
            return "{\"ev\":\"cmd\",\"cmd\":\"" + Esc(cmd) + "\",\"ok\":false,\"msg\":\"" + Esc(why) + "\"}";
        }
        /* MusicBee 这一家改走插件那一行明文，不走系统 Try* 那一套：那一套要会话先向系统声明
           IsPlayEnabled，一声明，键盘/耳机上那颗硬件媒体键就归了这个会话（主人 2026-10-05：
           「音乐遥控器以前不会抢系统媒体键，现在会抢，我不需要他抢」）。插件那边五枚按钮已全关，
           命令从 %LOCALAPPDATA%\Flow-Desk\players\musicbee-cmd.txt 进。
           能走到这一行就说明 MusicBee 的会话在 —— 那个会话本来就是插件替它发出来的，插件不在发不出会话。
           写不过去（目录被占、插件正删）照旧回落到系统那一路，不把命令吞掉。 */
        if (AppOf(s).IndexOf("MusicBee", StringComparison.OrdinalIgnoreCase) >= 0)
        {
            try
            {
                string dir = System.IO.Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "Flow-Desk", "players");
                if (System.IO.Directory.Exists(dir))
                {
                    string txt = cmd == "seek" ? "seek:" + pos.ToString() : cmd;
                    string tmp = System.IO.Path.Combine(dir, "musicbee-cmd.txt.tmp");
                    System.IO.File.WriteAllText(tmp, txt, new UTF8Encoding(false));
                    string dst = System.IO.Path.Combine(dir, "musicbee-cmd.txt");
                    if (System.IO.File.Exists(dst)) System.IO.File.Replace(tmp, dst, null);
                    else System.IO.File.Move(tmp, dst);
                    return "{\"ev\":\"cmd\",\"cmd\":\"" + Esc(cmd) + "\",\"ok\":true,\"via\":\"plugin\"}";
                }
            }
            catch (Exception) { }
        }
        try {
            bool ok;
            if (cmd == "play") ok = Await(s.TryPlayAsync());
            else if (cmd == "pause") ok = Await(s.TryPauseAsync());
            else if (cmd == "toggle") ok = Await(s.TryTogglePlayPauseAsync());
            else if (cmd == "next") ok = Await(s.TrySkipNextAsync());
            else if (cmd == "prev") ok = Await(s.TrySkipPreviousAsync());
            else if (cmd == "stop") ok = Await(s.TryStopAsync());
            else if (cmd == "seek") ok = Await(s.TryChangePlaybackPositionAsync(pos * 10000L));
            else if (cmd == "snapshot") { Say("ask", ""); return "{\"ev\":\"cmd\",\"cmd\":\"snapshot\",\"ok\":true}"; }
            else return "{\"ev\":\"cmd\",\"cmd\":\"" + Esc(cmd) + "\",\"ok\":false,\"msg\":\"unknown command\"}";
            return "{\"ev\":\"cmd\",\"cmd\":\"" + Esc(cmd) + "\",\"ok\":" + bt(ok) + ",\"app\":\"" + Esc(AppOf(s)) + "\"}";
        } catch (Exception e) {
            return "{\"ev\":\"cmd\",\"cmd\":\"" + Esc(cmd) + "\",\"ok\":false,\"msg\":\"" + Esc(e.Message) + "\"}";
        }
    }
}
'@
  $more = @('System.Runtime','System.Runtime.WindowsRuntime','System.Runtime.InteropServices.WindowsRuntime',
            'netstandard','System','System.Core','mscorlib')
  Add-Type -TypeDefinition $code -Language CSharp -ReferencedAssemblies (@($refs) + $more) -ErrorAction Stop
} catch {
  Fail ($_.Exception.Message -replace '\s+', ' ')
  exit 1
}

# --- command loop -------------------------------------------------------------
# Console.ReadLine blocks: the process costs nothing while the player is idle.
try {
  [Smtc]::Start()
  while($true){
    $line = [Console]::In.ReadLine()
    if($null -eq $line){ break }
    $line = $line.Trim()
    if($line -eq ''){ continue }
    $cmd = 'snapshot'; $pos = 0; $app = ''
    try {
      $j = $line | ConvertFrom-Json
      if($j.cmd){ $cmd = [string]$j.cmd }
      $pos = [double]$j.pos
      if($j.app){ $app = [string]$j.app }
    } catch { $cmd = [string]$line }
    $out = [Smtc]::Command($cmd, [long]$pos, $app)
    [Console]::Out.WriteLine($out); [Console]::Out.Flush()
  }
} catch {
  Fail ($_.Exception.Message -replace '\s+', ' ')
}
Out-Json @{ ev='bye'; ok=$true; msg='watcher closed' }
