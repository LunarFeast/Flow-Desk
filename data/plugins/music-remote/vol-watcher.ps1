# ============================================================
#  Flow-Desk · system volume watcher (resident child process)
#  Reads and drives the WINDOWS system volume (the master endpoint
#  volume, IAudioEndpointVolume over Core Audio) - not the volume of
#  one <audio> element. Hardware keys, the tray mixer and any other
#  app that moves the master level all fire the endpoint callback,
#  so the card follows the real system state instead of a local copy.
#  No timers, no polling: while nothing changes we sit in ReadLine.
#  One JSON line per state:
#     {"ev":"vol","vol":<0-100 int>,"muted":<true|false>}
#  Commands arrive on stdin, one JSON object per line:
#     {"cmd":"get"} {"cmd":"set","vol":<0-100>} {"cmd":"mute","on":<0|1|2>}
#  ('set' > 0 also clears mute; mute 0=off 1=on 2=toggle)
#  Two honest limits of this API (Microsoft's, not ours):
#   - mute changes do NOT fire the callback, so every command that can
#     change state answers with a fresh vol line of its own; a mute
#     done in ANOTHER app is picked up on the next read;
#   - the callback is bound to the default endpoint: switching the
#     default output device needs this watcher to restart (FD restarts
#     it whenever the music card is remounted).
#  Keep this file ASCII only: PowerShell 5.1 decodes BOM-less files as
#  the local ANSI codepage, so Chinese comments here break parsing.
# ============================================================
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Fail($msg){
  [Console]::Out.WriteLine('{"ev":"bye","ok":false,"msg":"' + ($msg -replace '[\r\n"]',' ') + '"}')
  [Console]::Out.Flush()
}

try {
  $code = @'
using System;
using System.Runtime.InteropServices;

namespace FdVol
{
    [Guid("5CDD576F-8BE0-4A2D-980E-6A3B342D65FE")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioEndpointVolume
    {
        // slots 1-4: not used here, declared so the vtable lines up
        [PreserveSig] int RegisterClientNotification(IntPtr callback);
        [PreserveSig] int UnregisterClientNotification();
        [PreserveSig] int DoProcess();
        [PreserveSig] int QueryHardwareSupport(out uint support);
        [PreserveSig] int GetMasterVolumeLevel(out float levelDb);
        [PreserveSig] int SetMasterVolumeLevel(float levelDb, ref Guid eventContext);
        [PreserveSig] int GetChannelVolumeLevel(uint channel, out float levelDb);
        [PreserveSig] int SetChannelVolumeLevel(uint channel, float levelDb, ref Guid eventContext);
        [PreserveSig] int GetChannelVolumeLevelScalar(uint channel, out float level);
        [PreserveSig] int SetChannelVolumeLevelScalar(uint channel, float level, ref Guid eventContext);
        [PreserveSig] int GetMasterVolumeLevelScalar(out float level);
        [PreserveSig] int SetMasterVolumeLevelScalar(float level, ref Guid eventContext);
        [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
        [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid eventContext);
    }

    [Guid("A95664D2-9614-4F37-A746-E8113BCDC71E")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceEnumerator
    {
        [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr devices);
        [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
    }

    [Guid("D666063F-15AC-44E7-B92F-AC57BE5F24A5")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice
    {
        [PreserveSig] int Activate(ref Guid iid, int clsCtx, IntPtr params_,
            [MarshalAs(UnmanagedType.IUnknown)] out object epv);
    }

    [StructLayout(LayoutKind.Sequential)]
    struct NotifyData
    {
        public Guid eventContext;
        [MarshalAs(UnmanagedType.Bool)] public bool muted;
        public float masterVolume;
        public uint channels;
    }

    [Guid("66611111-2574-4189-87AB-8F54953E9491")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioEndpointVolumeCallback
    {
        [PreserveSig] int OnNotify(IntPtr data);
    }

    public static class Vol
    {
        static IAudioEndpointVolume epv;
        static IAudioEndpointVolumeCallback cb;      // keep a strong reference alive
        static long lastMs = -1;
        static string lastLine = "";

        static long Now()
        {
            return System.Diagnostics.Stopwatch.GetTimestamp() * 1000 / System.Diagnostics.Stopwatch.Frequency;
        }

        public static void Start()
        {
            Type cls = Type.GetTypeFromCLSID(new Guid("BCDE0395-E52F-467C-8E3D-C45794911356"));
            if (cls == null) throw new Exception("MMDeviceEnumerator clsid unavailable");
            IMMDeviceEnumerator en = (IMMDeviceEnumerator)Activator.CreateInstance(cls);
            IMMDevice dev;
            if (en.GetDefaultAudioEndpoint(0 /*eRender*/, 0 /*eConsole*/, out dev) != 0)
                throw new Exception("no default render endpoint");
            Guid iid = typeof(IAudioEndpointVolume).GUID;
            object o;
            int hr = dev.Activate(ref iid, 1 /*CLSCTX_INPROC_SERVER*/, IntPtr.Zero, out o);
            epv = (IAudioEndpointVolume)o;
            if (hr != 0 || epv == null) throw new Exception("IAudioEndpointVolume activate failed: " + hr);
            cb = new Handler();
            epv.RegisterClientNotification(Marshal.GetComInterfaceForObject(cb, typeof(IAudioEndpointVolumeCallback)));
        }

        class Handler : IAudioEndpointVolumeCallback
        {
            public int OnNotify(IntPtr data)
            {
                try
                {
                    if (data == IntPtr.Zero) return 0;
                    NotifyData d = (NotifyData)Marshal.PtrToStructure(data, typeof(NotifyData));
                    Say(d.masterVolume, d.muted);
                }
                catch (Exception) { }
                return 0;   // never let a managed throw cross into COM
            }
        }

        static int Pct(float scalar)
        {
            double v = Math.Round((double)scalar * 100.0);
            if (v < 0) v = 0; if (v > 100) v = 100;
            return (int)v;
        }

        /* Same state twice inside 300ms = our own Set bouncing back through the
           callback right after the command echo; drop it, one line per change. */
        static void Say(float scalar, bool muted)
        {
            string line = "{\"ev\":\"vol\",\"vol\":" + Pct(scalar) + ",\"muted\":" + (muted ? "true" : "false") + "}";
            long ms = Now();
            lock (typeof(Vol))
            {
                if (line == lastLine && ms - lastMs < 300) return;
                lastLine = line; lastMs = ms;
                Console.WriteLine(line);
                Console.Out.Flush();
            }
        }

        static void Read(out float scalar, out bool muted)
        {
            epv.GetMasterVolumeLevelScalar(out scalar);
            epv.GetMute(out muted);
        }

        public static string Get()
        {
            float s; bool m; Read(out s, out m);
            lock (typeof(Vol)) { lastLine = ""; }   // a get must always speak
            Say(s, m);
            return "ok";
        }

        public static string Set(int v)
        {
            if (v < 0) v = 0; if (v > 100) v = 100;
            Guid g = Guid.Empty;
            epv.SetMasterVolumeLevelScalar(v / 100.0f, ref g);
            if (v > 0) epv.SetMute(false, ref g);
            return Get();
        }

        public static string Mute(int on)   // 0 off, 1 on, 2 toggle
        {
            float s; bool m; Read(out s, out m);
            bool want = on == 2 ? !m : on == 1;
            Guid g = Guid.Empty;
            epv.SetMute(want, ref g);
            return Get();
        }
    }
}
'@
  Add-Type -TypeDefinition $code -Language CSharp -ErrorAction Stop
} catch {
  Fail ($_.Exception.Message -replace '\s+', ' ')
  exit 1
}

# --- command loop -------------------------------------------------------------
# Console.ReadLine blocks: the process costs nothing while nobody touches volume.
try {
  [FdVol.Vol]::Start()
  [FdVol.Vol]::Get()      # first read doubles as the "ready" line
  while($true){
    $line = [Console]::In.ReadLine()
    if($null -eq $line){ break }
    $line = $line.Trim()
    if($line -eq ''){ continue }
    $cmd = 'get'; $vol = 0; $on = 2
    try {
      $j = $line | ConvertFrom-Json
      if($j.cmd){ $cmd = [string]$j.cmd }
      if($null -ne $j.vol){ $vol = [int]$j.vol }
      if($null -ne $j.on){ $on = [int]$j.on }
    } catch { $cmd = [string]$line }
    try {
      if($cmd -eq 'set'){ [void][FdVol.Vol]::Set($vol) }
      elseif($cmd -eq 'mute'){ [void][FdVol.Vol]::Mute($on) }
      else { [void][FdVol.Vol]::Get() }
    } catch { Fail ('command failed: ' + ($_.Exception.Message -replace '\s+', ' ')) }
  }
} catch {
  Fail ($_.Exception.Message -replace '\s+', ' ')
}
[Console]::Out.WriteLine('{"ev":"bye","ok":true,"msg":"volume watcher closed"}')
[Console]::Out.Flush()
