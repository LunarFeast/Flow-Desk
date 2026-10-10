// FlowDeskBridge.cs - MusicBee plugin that publishes a complete SMTC session.
//
// WHY THIS FILE WAS REBUILT FROM SCRATCH (2026-10-01)
// The previous revision pumped itself with a System.Windows.Forms.Timer plus a work
// queue drained by that timer. MusicBee calls Initialise() on a thread that owns no
// message loop, so the timer never fired once: Refresh(true) ran exactly one time from
// Open(), and nothing after that ever reached SMTC. The evidence on this PC matched
// exactly one publish: players\musicbee.txt was last written in the same minute
// MusicBee's process started, and the session still showed the startup snapshot
// (PlaybackStatus Stopped, Position 0, EndTime of the then-current track).
// So this revision owns its thread and its loop, and asks nothing of a message pump:
//   * one background thread, sample -> compare -> publish -> wait
//   * the wait is interruptible: a MusicBee notification wakes it for an instant sample
//   * no queue, no timer class, no Control, no Invoke
//   * it logs what it is doing, so "not monitoring" is answerable from the file
//
// What this file guarantees to Flow-Desk:
//   * Title / Artist / AlbumTitle / TrackNumber / Thumbnail on every track change
//   * PlaybackStatus (Playing | Paused | Changing | Stopped) as soon as it changes - except
//     that a flip away from Playing is held for DropConfirm samples first, because Flow-Desk
//     freezes its clock on any non-Playing status and one bad sample would show up on the
//     card as the progress bar stopping, then jumping forward (see Sample())
//   * Timeline pushed on state change, on track change, and at most every 2 s while
//     playing - Flow-Desk interpolates locally between pushes, so this is calibration
//     traffic, not polling
//   * PlaybackPositionChangeRequested (the system's own seek bar) routed back into MusicBee.
//     Transport commands do NOT come that way: this session is a synthetic handle with no audio
//     of its own, so the system's Try* calls reach nothing - measured from Flow-Desk with the
//     buttons enabled (v1.2): every one of them dead, MusicBee still reporting into the card.
//     Commands arrive on the plaintext sidecar instead (CmdFile below).
//   * One plaintext sidecar line holding the current file path, because SMTC does not
//     carry a path on the read side and Flow-Desk needs it to find the sibling .lrc/.ttml
//
// Keep this file ASCII only: csc.exe reads a BOM-less file in the local ANSI codepage,
// so Chinese in the source can break the build. Comments stay English for that reason.
// C# 5 only: the compiler used is the one shipped in Framework64\v4.0.30319.
using System;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;                     // Marshal.PtrToStructure
using System.Runtime.InteropServices.WindowsRuntime;      // byte[].AsBuffer()
using System.Windows.Forms;                               // Application.MessageLoop, for the start-up stamp
using Windows.Foundation;
using Windows.Media;
using Windows.Media.Playback;
using Windows.Storage.Streams;

namespace MusicBeePlugin
{
    public partial class Plugin
    {
        // ---- contract stamps, mirrored from the reference plugin ----
        short PluginInfoVersion = 0;
        short MinInterfaceVersion = (short)MusicBeeVersion.v2_0;   // accept anything v2.0+
        short MinApiRevision = 0;                                  // the slots we use are all original

        MusicBeeApiInterface mbApiInterface = new MusicBeeApiInterface();
        PluginInfo about = new PluginInfo();

        // ---- how long the loop waits between samples ----
        const int LiveMs = 250;        // playing: cheap, and a pause gets seen at once
        const int IdleMs = 1000;       // paused or stopped: nothing moves, sample slowly
        const int CalibMs = 2000;      // how often a steady track gets a position push
        const int BeatSec = 300;       // the "still alive" stamp in the log
        // How many samples in a row have to read non-Playing before that flip goes out while
        // a track was audibly running. One sample is a glitch, and a glitch costs the viewer
        // more than 750 ms of latency on a real pause - see Sample().
        const int DropConfirm = 3;

        // ---- where Flow-Desk looks for the current file path, and where we explain ourselves ----
        // %LOCALAPPDATA%\Flow-Desk\players\musicbee.txt   one line, plain text, safe to delete
        static readonly string SidecarDir =
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                         "Flow-Desk", "players");
        static readonly string SidecarFile = Path.Combine(SidecarDir, "musicbee.txt");
        /* Flow-Desk 下命令走这一行明文，不再借系统媒体按键那一路。
           为什么另开一条：这座桥造的会话自己不放音，系统那套 Try* 打上去没有对象可操作
           （v1.2 五枚全开时遥控器那几颗全失效，就是这条）。硬件媒体键那一路也一并撤了 ——
           订阅 ButtonPressed 等于替 MusicBee 接住那颗键，主人 2026-10-05 明确说不要它抢。
           命令由 Flow-Desk 写、这里读，读完就删；FileSystemWatcher 负责即时，轮询负责兜底。 */
        static readonly string CmdFile = Path.Combine(SidecarDir, "musicbee-cmd.txt");
        static readonly string LogFile = Path.Combine(SidecarDir, "bridge.log");

        SystemMediaTransportControls smtc;
        Thread loop;
        AutoResetEvent pulse = new AutoResetEvent(false);
        volatile bool running;

        // ---- what the loop remembers between samples (touched by the loop thread only) ----
        string lastPath = null;
        PlayState lastState = (PlayState)(-1);
        MediaPlaybackStatus lastStatus = MediaPlaybackStatus.Closed;
        int dropRun;                   // consecutive samples that read non-Playing while we published Playing
        long pushedPos = -1, pushedDur = -1;
        DateTime lastPush = DateTime.MinValue;
        DateTime lastBeat = DateTime.MinValue;
        long ticks;
        int logged;
        readonly object logGate = new object();
        // ---- 命令那一路：watcher 和循环都去看这一行文件，谁先读到算谁（读完就删，不会执行两遍） ----
        FileSystemWatcher cmdWatch;

        // =====================================================================
        // lifecycle
        // =====================================================================

        public PluginInfo Initialise(IntPtr dataPtr)
        {
            try
            {
                mbApiInterface = (MusicBeeApiInterface)Marshal.PtrToStructure(dataPtr, typeof(MusicBeeApiInterface));
            }
            catch (Exception ex)
            {
                Log("api struct marshal failed: " + ex.Message);
                return about;                       // stay loaded, publish nothing
            }

            about.PluginInfoVersion = PluginInfoVersion;
            about.Name = "Flow-Desk Bridge";
            about.Description = "Broadcasts MusicBee to Windows system media controls, including the progress timeline.";
            about.Author = "Flow-Desk";
            about.TargetApplication = "";
            about.Type = PluginType.General;
            about.VersionMajor = 1;
            about.VersionMinor = 4;
            about.Revision = 0;
            about.MinInterfaceVersion = MinInterfaceVersion;
            about.MinApiRevision = MinApiRevision;
            about.ReceiveNotifications = ReceiveNotificationFlags.PlayerEvents;
            about.ConfigurationPanelHeight = 0;       // no settings UI: everything is automatic

            try { Open(); }
            catch (Exception ex) { Log("Open failed: " + ex.ToString()); }
            return about;
        }

        void Open()
        {
            Thread me = Thread.CurrentThread;
            // The start-up stamp is the whole point of the rewrite: it says out loud whether
            // this thread could ever have driven a WinForms timer, and it proves the plugin loaded.
            Log("start v1.4 thread=" + me.ManagedThreadId + (me.IsThreadPoolThread ? "(pool)" : "") +
                " msgloop=" + Application.MessageLoop + " pid=" + Process.GetCurrentProcess().Id);

#pragma warning disable 618   // BackgroundMediaPlayer is the only handle that works from a
            smtc = BackgroundMediaPlayer.Current.SystemMediaTransportControls;   // non-Store process
#pragma warning restore 618
            if (smtc == null) { Log("no SMTC handle"); return; }

            /* v1.3 turned the five buttons off on top of dropping the ButtonPressed handler, to
               stop this bridge claiming the hardware media key (owner, 2026-10-05: "the remote
               used to not steal the system media keys, now it does - I don't need it to steal").
               The flags were over-reach, and that is what killed monitoring: with no button
               claimed, the session stops showing up in the global list at all. Measured on this
               PC while MusicBee ran and this plugin logged: the watcher reads sessions=0, so
               Flow-Desk gets no track, no status, no timeline, and its transport buttons grey out
               because can.* every one of them reads false. v1.2 (flags on) was seen to surface.
               v1.4 puts the flags back. The "do not steal the key" half is the handler, and the
               handler alone is enough: nothing is subscribed to ButtonPressed, so the key reaches
               this session and stops there - MusicBee no longer answers it. */
            smtc.IsPlayEnabled = true;
            smtc.IsPauseEnabled = true;
            smtc.IsNextEnabled = true;
            smtc.IsPreviousEnabled = true;
            smtc.IsStopEnabled = true;
            // There is no write-side flag for seeking: handling PlaybackPositionChangeRequested
            // (done below) is what makes the read side report IsPlaybackPositionEnabled, which is
            // what lets Flow-Desk drag the progress bar.
            smtc.IsEnabled = true;
            smtc.PlaybackPositionChangeRequested += OnSeekRequested;
            Log("smtc handle ok");

            running = true;
            /* 命令文件的即时通道：建不出 watcher（目录还没建、权限、网络盘）不算错，
               循环每一圈还会自己去看一眼，只是慢到最多一个节拍 */
            try
            {
                if (!Directory.Exists(SidecarDir)) Directory.CreateDirectory(SidecarDir);
                cmdWatch = new FileSystemWatcher(SidecarDir, Path.GetFileName(CmdFile));
                cmdWatch.NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite;
                cmdWatch.Created += delegate { TakeCommand(); };
                cmdWatch.Changed += delegate { TakeCommand(); };
                cmdWatch.EnableRaisingEvents = true;
            }
            catch (Exception ex) { Log("cmd watch: " + ex.Message); }
            loop = new Thread(new ThreadStart(RunLoop));
            loop.IsBackground = true;
            loop.Name = "FlowDeskBridge";
            loop.Start();
        }

        public void Close(PluginCloseReason reason)
        {
            try
            {
                running = false;
                pulse.Set();
                if (loop != null) { loop.Join(1500); loop = null; }
            }
            catch (Exception ex) { Log("join: " + ex.Message); }
            try
            {
                if (cmdWatch != null) { cmdWatch.EnableRaisingEvents = false; cmdWatch.Dispose(); cmdWatch = null; }
                /* 插件都走了，留着那一行命令等于下回 MusicBee 一开就补做一件他没按的事 */
                if (File.Exists(CmdFile)) File.Delete(CmdFile);
            }
            catch (Exception ex) { Log("cmd watch off: " + ex.Message); }
            try
            {
                if (smtc != null)
                {
                    smtc.PlaybackPositionChangeRequested -= OnSeekRequested;
                    smtc.PlaybackStatus = MediaPlaybackStatus.Stopped;
                    smtc.IsEnabled = false;
                    smtc = null;
                }
            }
            catch (Exception ex) { Log("Close failed: " + ex.Message); }
            Log("closed (" + reason + ") ticks=" + ticks);
        }

        public bool Configure(IntPtr parentWindowHandle) { return true; }
        public void SaveSettings() { }
        public void Uninstall()
        {
            try { if (File.Exists(SidecarFile)) File.Delete(SidecarFile); }
            catch (Exception) { }
        }

        // A notification is a wake-up call, not a queued job: whatever thread raises it,
        // all it does is cut the loop's current wait short.
        public void ReceiveNotification(string sourceInstance, NotificationType notification)
        {
            switch (notification)
            {
                case NotificationType.TrackChanging:
                case NotificationType.TrackChanged:
                case NotificationType.PlayStateChanged:
                case NotificationType.NowPlayingArtworkReady:
                case NotificationType.NowPlayingLyricsReady:
                case NotificationType.NowPlayingListChanged:
                    pulse.Set();
                    break;
            }
        }

        // =====================================================================
        // the loop
        // =====================================================================

        void RunLoop()
        {
            while (running)
            {
                /* watcher 建不成也不丢命令：每一圈自己再看一眼 */
                try { TakeCommand(); }
                catch (Exception ex) { Log("cmd: " + ex.Message); }
                try { Sample(); }
                catch (Exception ex) { Log("sample: " + ex.Message); }
                int wait = lastStatus == MediaPlaybackStatus.Playing ? LiveMs : IdleMs;
                try { pulse.WaitOne(wait); }
                catch (Exception) { Thread.Sleep(wait); }
            }
        }

        // Reads MusicBee once and pushes whatever changed onto SMTC.
        void Sample()
        {
            ticks++;
            if (smtc == null) return;

            PlayState state = ReadState();
            MediaPlaybackStatus want = MapState(state);
            long pos = ReadPos();
            long dur = ReadDur();
            string path = CurrentLocalPath();

            bool changed = state != lastState || path != lastPath;
            lastState = state;

            // A track that is audibly running can read back non-Playing for a single sample:
            // Player_GetPlayState is a live query into MusicBee, and it answers Undefined (which
            // maps to Stopped) around seeks, replays and the moment a decoder swaps. Flow-Desk
            // freezes its clock on any status that is not Playing, so publishing that one-sample
            // glitch shows up on the card as the progress bar stopping, then jumping forward by
            // exactly however long the glitch lasted - with the word-by-word lyric gradient
            // restarting on the way back. A real pause outlasts DropConfirm samples, so this only
            // buys it DropConfirm*LiveMs of latency, and the position keeps getting calibrated
            // through the glitch because the published status stays Playing.
            if (want != lastStatus && lastStatus == MediaPlaybackStatus.Playing)
            {
                if (++dropRun < DropConfirm)
                {
                    Log("drop " + dropRun + " state=" + state + " want=" + want + " pos=" + pos);
                    want = MediaPlaybackStatus.Playing;
                }
            }
            else dropRun = 0;

            if (want != lastStatus)
            {
                Log("status " + lastStatus + " -> " + want + " state=" + state + " pos=" + pos);
                lastStatus = want;
                try { smtc.PlaybackStatus = want; }
                catch (Exception ex) { Log("status: " + ex.Message); }
            }
            if (path != lastPath)
            {
                lastPath = path;
                PushDisplay();
                WriteSidecar(path);
            }

            // Position goes out as calibration while playing, and only on a real difference
            // otherwise. This used to also include "pos differs from what I pushed", which is
            // true on every single sample while a track plays - so the loop published four
            // times a second, SMTC fired TimelinePropertiesChanged four times a second, and the
            // watcher emitted four JSON lines a second for a card that interpolates on its own.
            DateTime now = DateTime.Now;
            bool due;
            if (want == MediaPlaybackStatus.Playing)
            {
                // A new track or a flipped status carries a different EndTime, so that one goes
                // out at once; a track that just keeps playing waits for its calibration beat.
                due = changed || (now - lastPush).TotalMilliseconds >= CalibMs;
            }
            else
            {
                // Paused or stopped, the position cannot move by itself: a difference here means
                // somebody dragged MusicBee's own seek bar. Say it once, then stay quiet.
                due = changed || Math.Abs(pos - pushedPos) > 1500;
            }
            if (due)
            {
                lastPush = now; pushedPos = pos; pushedDur = dur;
                PushTimeline(pos, dur);
            }
            Heartbeat(now);
        }

        void Heartbeat(DateTime now)
        {
            if ((now - lastBeat).TotalSeconds < BeatSec) return;
            lastBeat = now;
            Log("alive ticks=" + ticks + " state=" + lastState +
                " pos=" + pushedPos + " dur=" + pushedDur);
        }

        PlayState ReadState()
        {
            try { return mbApiInterface.Player_GetPlayState(); }
            catch (Exception ex) { Log("playstate: " + ex.Message); return PlayState.Stopped; }
        }
        long ReadPos()
        {
            try { return mbApiInterface.Player_GetPosition(); }
            catch (Exception ex) { Log("position: " + ex.Message); return 0; }
        }
        long ReadDur()
        {
            try { return mbApiInterface.NowPlaying_GetDuration(); }
            catch (Exception ex) { Log("duration: " + ex.Message); return 0; }
        }

        static MediaPlaybackStatus MapState(PlayState state)
        {
            switch (state)
            {
                case PlayState.Playing: return MediaPlaybackStatus.Playing;
                case PlayState.Paused: return MediaPlaybackStatus.Paused;
                // MusicBee says Loading while a track is being opened; SMTC has a
                // matching transient member, so the card can show "opening" instead
                // of a false "stopped".
                case PlayState.Loading: return MediaPlaybackStatus.Changing;
                // Undefined and Stopped both read as "nothing is playing" to Flow-Desk.
                default: return MediaPlaybackStatus.Stopped;
            }
        }

        void PushTimeline(long positionMs, long durationMs)
        {
            try
            {
                SystemMediaTransportControlsTimelineProperties tl =
                    new SystemMediaTransportControlsTimelineProperties();
                tl.StartTime = TimeSpan.Zero;
                tl.Position = TimeSpan.FromMilliseconds(positionMs < 0 ? 0 : positionMs);
                tl.EndTime = TimeSpan.FromMilliseconds(durationMs < 0 ? 0 : durationMs);
                smtc.UpdateTimelineProperties(tl);
            }
            catch (Exception ex) { Log("timeline: " + ex.Message); }
        }

        void PushDisplay()
        {
            try
            {
                SystemMediaTransportControlsDisplayUpdater du = smtc.DisplayUpdater;
                du.Type = MediaPlaybackType.Music;
                MusicDisplayProperties mp = du.MusicProperties;
                mp.Title = Tag(MetaDataType.TrackTitle);
                mp.Artist = Tag(MetaDataType.Artist);
                mp.AlbumTitle = Tag(MetaDataType.Album);
                uint trackNo;
                if (uint.TryParse(Tag(MetaDataType.TrackNo), NumberStyles.Integer,
                                  CultureInfo.InvariantCulture, out trackNo))
                    mp.TrackNumber = trackNo;
                PushArtwork(du);
                du.Update();
                Log("track " + mp.Title + " - " + mp.Artist);
            }
            catch (Exception ex) { Log("display: " + ex.Message); }
        }

        void PushArtwork(SystemMediaTransportControlsDisplayUpdater du)
        {
            string art = null;
            try { art = mbApiInterface.NowPlaying_GetArtwork(); }
            catch (Exception) { return; }
            if (string.IsNullOrEmpty(art)) return;
            string local = ToLocalPath(art);
            if (local == null || !File.Exists(local)) return;   // remote or already gone: no cover
            byte[] bytes;
            try { bytes = File.ReadAllBytes(local); }
            catch (Exception) { return; }
            if (bytes.Length == 0) return;
            try
            {
                // Write through the WinRT stream API directly: the .NET AsStreamForWrite helper
                // only resolves against the SDK's aggregate metadata, and this plugin should not
                // depend on a Windows SDK being installed just to rebuild it.
                InMemoryRandomAccessStream stream = new InMemoryRandomAccessStream();
                if (!stream.WriteAsync(bytes.AsBuffer()).AsTask().Wait(1000)) return;
                du.Thumbnail = RandomAccessStreamReference.CreateFromStream(stream);
            }
            catch (Exception ex) { Log("artwork: " + ex.Message); }
        }

        // =====================================================================
        // SMTC -> MusicBee. These arrive on WinRT thread-pool threads and only ever
        // raise the pulse; the loop does the MusicBee calling, on one thread.
        // 硬件按键那一路（OnButtonPressed）2026-10-05 撤了：订阅它等于替 MusicBee 接住键盘/耳机上
        // 那颗媒体键，主人明确说了不要它抢。五枚按键标志照旧开着 —— v1.3 把它们一起关掉，会话就整个
        // 不出现在系统那份会话列表里了，监听反而全断，见 Open() 里那段。
        // =====================================================================

        /* Flow-Desk 下过来的一条命令：play / pause / toggle / stop / next / prev / seek:<毫秒>。
           先删后执行，watcher 那一跳和循环每一圈都调这个，谁先读到算谁，不会执行两遍。
           为什么不走系统那套 TryPlayAsync：这座桥造的会话自己不放音，Try* 打上去没有对象可操作
           —— v1.2 五枚全开的时候，遥控器那几颗就是全失效的（主人 2026-10-05 现场回料），
           而 MusicBee 往遥控器这一侧照旧通。所以命令走这一行明文，直接落到 MusicBee 自己的按键上。 */
        void TakeCommand()
        {
            string cmd;
            try
            {
                if (!File.Exists(CmdFile)) return;
                cmd = File.ReadAllText(CmdFile).Trim();
                File.Delete(CmdFile);
            }
            catch (Exception) { return; }        /* 正被人写、正被人删：下一圈再看一眼就是 */
            if (cmd.Length > 0) RunCmd(cmd);
        }

        void RunCmd(string cmd)
        {
            string head = cmd, arg = "";
            int c = cmd.IndexOf(':');
            if (c >= 0) { head = cmd.Substring(0, c); arg = cmd.Substring(c + 1); }
            try
            {
                if (head == "play" || head == "pause" || head == "toggle") mbApiInterface.Player_PlayPause();
                else if (head == "stop") mbApiInterface.Player_Stop();
                else if (head == "next") mbApiInterface.Player_PlayNextTrack();
                else if (head == "prev") mbApiInterface.Player_PlayPreviousTrack();
                else if (head == "seek")
                {
                    int ms;
                    if (!int.TryParse(arg, out ms)) return;
                    mbApiInterface.Player_SetPosition(ms);
                }
                else return;
                Log("cmd " + cmd);
            }
            catch (Exception ex) { Log("cmd " + cmd + ": " + ex.Message); }
            pulse.Set();
        }

        void OnSeekRequested(SystemMediaTransportControls sender,
                             PlaybackPositionChangeRequestedEventArgs args)
        {
            int ms = (int)args.RequestedPlaybackPosition.TotalMilliseconds;
            try { mbApiInterface.Player_SetPosition(ms); }
            catch (Exception ex) { Log("seek: " + ex.Message); }
            pulse.Set();
        }

        // =====================================================================
        // helpers
        // =====================================================================

        string Tag(MetaDataType field)
        {
            try
            {
                string v = mbApiInterface.NowPlaying_GetFileTag(field);
                return v == null ? "" : v;
            }
            catch (Exception) { return ""; }
        }

        string CurrentLocalPath()
        {
            try { return ToLocalPath(mbApiInterface.NowPlaying_GetFileUrl()); }
            catch (Exception) { return null; }
        }

        static string ToLocalPath(string url)
        {
            if (string.IsNullOrEmpty(url)) return null;
            if (url.StartsWith("file:", StringComparison.OrdinalIgnoreCase))
            {
                try { return new Uri(url).LocalPath; }
                catch (Exception) { return null; }
            }
            return url;
        }

        // One line, plain text, overwritten only when the track actually changed.
        // Flow-Desk watches this file; a rewrite is an event, not a poll.
        void WriteSidecar(string path)
        {
            string line = (path == null ? "" : path) + "\n";
            try
            {
                if (File.Exists(SidecarFile))
                {
                    string current = null;
                    try { current = File.ReadAllText(SidecarFile); }
                    catch (Exception) { }
                    if (current == line) return;                 // unchanged: touch nothing
                }
                else if (path == null)
                {
                    return;                                       // nothing playing, nothing written yet
                }
                if (!Directory.Exists(SidecarDir)) Directory.CreateDirectory(SidecarDir);
                string temp = SidecarFile + ".tmp";
                File.WriteAllText(temp, line, new UTF8Encoding(false));
                if (File.Exists(SidecarFile)) File.Replace(temp, SidecarFile, null);
                else File.Move(temp, SidecarFile);
            }
            catch (Exception ex) { Log("sidecar: " + ex.Message); }
        }

        // Timestamped, bounded, and readable without a debugger: this is how a
        // "not monitoring" report gets answered from a file instead of by guessing.
        void Log(string message)
        {
            // 400 was too tight once the status flips get stamped: a MusicBee session that runs
            // for a day writes a heartbeat every BeatSec, and the cap silenced the very lines
            // that answer "why did the progress bar jump". The file itself stays bounded by the
            // rotation below, so the cap is only a backstop against a per-sample exception storm.
            if (logged >= 4000) return;
            logged++;
            try
            {
                lock (logGate)
                {
                    if (!Directory.Exists(SidecarDir)) Directory.CreateDirectory(SidecarDir);
                    if (File.Exists(LogFile) && new FileInfo(LogFile).Length > 120000)
                    {
                        string tail = File.ReadAllText(LogFile);
                        File.WriteAllText(LogFile, tail.Substring(Math.Max(0, tail.Length - 60000)),
                                          new UTF8Encoding(false));
                    }
                    File.AppendAllText(LogFile,
                        DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + message + "\r\n",
                        new UTF8Encoding(false));
                }
            }
            catch (Exception) { }              // logging must never take the bridge down
        }
    }
}
