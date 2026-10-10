// MBHeader.cs - GENERATED, do not edit by hand.
// Source of truth: the field order / delegate shapes / enum values were extracted by
// reflection out of MusicBee's own reference plugin (mb_MediaControl.dll), because the
// official SDK headers are not downloadable from this machine and a single misplaced
// field would crash MusicBee on load.
// Regenerate with:  node _fd/tmp/gen-mbheader.mjs
//
// Contract rules that matter:
//  * MusicBee hands the plugin a pointer to ITS OWN struct; the plugin reads back the
//    first sizeof(its own struct) bytes. The API is append-only, so this prefix is valid
//    as long as order is preserved. Never reorder, never delete a slot.
//  * Fields whose real delegate signature references System.Drawing / WinForms could not
//    be resolved by the probe. They are declared as IntPtr here: same width, never called.
//    If one is ever needed, resolve its signature first and replace the IntPtr.
using System;
using System.Runtime.InteropServices;

namespace MusicBeePlugin
{
    public partial class Plugin
    {
        // ---- enums (values copied verbatim from the reference plugin) ----
        public enum MusicBeeVersion
        {
            v2_0 = 0,
            v2_1 = 1,
            v2_2 = 2,
            v2_3 = 3,
            v2_4 = 4,
            v2_5 = 5,
            v3_0 = 6,
            v3_1 = 7,
        }
        public enum PluginType
        {
            Unknown = 0,
            General = 1,
            LyricsRetrieval = 2,
            ArtworkRetrieval = 3,
            PanelView = 4,
            DataStream = 5,
            InstantMessenger = 6,
            Storage = 7,
            VideoPlayer = 8,
            DSP = 9,
            TagRetrieval = 10,
            TagOrArtworkRetrieval = 11,
            Upnp = 12,
            WebBrowser = 13,
        }
        public enum ReceiveNotificationFlags
        {
            StartupOnly = 0,
            PlayerEvents = 1,
            DataStreamEvents = 2,
            TagEvents = 4,
            DownloadEvents = 8,
        }
        public enum NotificationType
        {
            PluginStartup = 0,
            TrackChanging = 16,
            TrackChanged = 1,
            PlayStateChanged = 2,
            AutoDjStarted = 3,
            AutoDjStopped = 4,
            VolumeMuteChanged = 5,
            VolumeLevelChanged = 6,
            NowPlayingListChanged = 7,
            NowPlayingListEnded = 18,
            NowPlayingArtworkReady = 8,
            NowPlayingLyricsReady = 9,
            TagsChanging = 10,
            TagsChanged = 11,
            RatingChanging = 15,
            RatingChanged = 12,
            PlayCountersChanged = 13,
            ScreenSaverActivating = 14,
            ShutdownStarted = 17,
            EmbedInPanel = 19,
            PlayerRepeatChanged = 20,
            PlayerShuffleChanged = 21,
            PlayerEqualiserOnOffChanged = 22,
            PlayerScrobbleChanged = 23,
            ReplayGainChanged = 24,
            FileDeleting = 25,
            FileDeleted = 26,
            ApplicationWindowChanged = 27,
            StopAfterCurrentChanged = 28,
            LibrarySwitched = 29,
            FileAddedToLibrary = 30,
            FileAddedToInbox = 31,
            SynchCompleted = 32,
            DownloadCompleted = 33,
            MusicBeeStarted = 34,
            PlayingTracksChanged = 35,
            PlayingTracksQueueChanged = 36,
        }
        public enum PluginCloseReason
        {
            MusicBeeClosing = 1,
            UserDisabled = 2,
            StopNoUnload = 3,
        }
        public enum CallbackType
        {
            SettingsUpdated = 1,
            StorageReady = 2,
            StorageFailed = 3,
            FilesRetrievedChanged = 4,
            FilesRetrievedNoChange = 5,
            FilesRetrievedFail = 6,
            LyricsDownloaded = 7,
            StorageEject = 8,
            SuspendPlayCounters = 9,
            ResumePlayCounters = 10,
            EnablePlugin = 11,
            DisablePlugin = 12,
            RenderingDevicesChanged = 13,
            FullscreenOn = 14,
            FullscreenOff = 15,
        }
        public enum FilePropertyType
        {
            Url = 2,
            Kind = 4,
            Format = 5,
            Size = 7,
            Channels = 8,
            SampleRate = 9,
            Bitrate = 10,
            DateModified = 11,
            DateAdded = 12,
            LastPlayed = 13,
            PlayCount = 14,
            SkipCount = 15,
            Duration = 16,
            Status = 21,
            NowPlayingListIndex = 78,
            ReplayGainTrack = 94,
            ReplayGainAlbum = 95,
        }
        public enum MetaDataType
        {
            TrackTitle = 65,
            Album = 30,
            AlbumArtist = 31,
            AlbumArtistRaw = 34,
            Artist = 32,
            MultiArtist = 33,
            PrimaryArtist = 19,
            Artists = 144,
            ArtistsWithArtistRole = 145,
            ArtistsWithPerformerRole = 146,
            ArtistsWithGuestRole = 147,
            ArtistsWithRemixerRole = 148,
            Artwork = 40,
            BeatsPerMin = 41,
            Composer = 43,
            MultiComposer = 89,
            Comment = 44,
            Conductor = 45,
            Custom1 = 46,
            Custom2 = 47,
            Custom3 = 48,
            Custom4 = 49,
            Custom5 = 50,
            Custom6 = 96,
            Custom7 = 97,
            Custom8 = 98,
            Custom9 = 99,
            Custom10 = 128,
            Custom11 = 129,
            Custom12 = 130,
            Custom13 = 131,
            Custom14 = 132,
            Custom15 = 133,
            Custom16 = 134,
            DiscNo = 52,
            DiscCount = 54,
            Encoder = 55,
            Genre = 59,
            Genres = 143,
            GenreCategory = 60,
            Grouping = 61,
            Keywords = 84,
            HasLyrics = 63,
            Lyricist = 62,
            Lyrics = 114,
            Mood = 64,
            Occasion = 66,
            Origin = 67,
            Publisher = 73,
            Quality = 74,
            Rating = 75,
            RatingLove = 76,
            RatingAlbum = 104,
            Tempo = 85,
            TrackNo = 86,
            TrackCount = 87,
            Virtual1 = 109,
            Virtual2 = 110,
            Virtual3 = 111,
            Virtual4 = 112,
            Virtual5 = 113,
            Virtual6 = 122,
            Virtual7 = 123,
            Virtual8 = 124,
            Virtual9 = 125,
            Virtual10 = 135,
            Virtual11 = 136,
            Virtual12 = 137,
            Virtual13 = 138,
            Virtual14 = 139,
            Virtual15 = 140,
            Virtual16 = 141,
            Virtual17 = 149,
            Virtual18 = 150,
            Virtual19 = 151,
            Virtual20 = 152,
            Virtual21 = 153,
            Virtual22 = 154,
            Virtual23 = 155,
            Virtual24 = 156,
            Virtual25 = 157,
            Year = 88,
            SortTitle = 163,
            SortAlbum = 164,
            SortAlbumArtist = 165,
            SortArtist = 166,
            SortComposer = 167,
            Work = 168,
            MovementName = 169,
            MovementNo = 170,
            MovementCount = 171,
            ShowMovement = 172,
            Language = 173,
            OriginalArtist = 174,
            OriginalYear = 175,
            OriginalTitle = 177,
        }
        public enum FileCodec
        {
            Unknown = -1,
            Mp3 = 1,
            Aac = 2,
            Flac = 3,
            Ogg = 4,
            WavPack = 5,
            Wma = 6,
            Tak = 7,
            Mpc = 8,
            Wave = 9,
            Asx = 10,
            Alac = 11,
            Aiff = 12,
            Pcm = 13,
            Opus = 15,
            Spx = 16,
            Dsd = 17,
            AacNoContainer = 18,
        }
        public enum EncodeQuality
        {
            SmallSize = 1,
            Portable = 2,
            HighQuality = 3,
            Archiving = 4,
        }
        public enum LibraryCategory
        {
            Music = 0,
            Audiobook = 1,
            Video = 2,
            Inbox = 4,
        }
        public enum DeviceIdType
        {
            MusicBeeNativeId = 0,
            GooglePlay = 1,
            AppleDevice = 2,
            GooglePlay2 = 3,
            AppleDevice2 = 4,
        }
        public enum DataType
        {
            String = 0,
            Number = 1,
            DateTime = 2,
            Rating = 3,
        }
        public enum SettingId
        {
            CompactPlayerFlickrEnabled = 1,
            FileTaggingPreserveModificationTime = 2,
            LastDownloadFolder = 3,
            ArtistGenresOnly = 4,
            IgnoreNamePrefixes = 5,
            IgnoreNameChars = 6,
            PlayCountTriggerPercent = 7,
            PlayCountTriggerSeconds = 8,
            SkipCountTriggerPercent = 9,
            SkipCountTriggerSeconds = 10,
            CustomWebLinkName1 = 11,
            CustomWebLinkName2 = 12,
            CustomWebLinkName3 = 13,
            CustomWebLinkName4 = 14,
            CustomWebLinkName5 = 15,
            CustomWebLinkName6 = 16,
            CustomWebLinkName7 = 29,
            CustomWebLinkName8 = 30,
            CustomWebLinkName9 = 31,
            CustomWebLinkName10 = 32,
            CustomWebLink1 = 17,
            CustomWebLink2 = 18,
            CustomWebLink3 = 19,
            CustomWebLink4 = 20,
            CustomWebLink5 = 21,
            CustomWebLink6 = 22,
            CustomWebLink7 = 33,
            CustomWebLink8 = 34,
            CustomWebLink9 = 35,
            CustomWebLink10 = 36,
            CustomWebLinkNowPlaying1 = 23,
            CustomWebLinkNowPlaying2 = 24,
            CustomWebLinkNowPlaying3 = 25,
            CustomWebLinkNowPlaying4 = 26,
            CustomWebLinkNowPlaying5 = 27,
            CustomWebLinkNowPlaying6 = 28,
            CustomWebLinkNowPlaying7 = 37,
            CustomWebLinkNowPlaying8 = 38,
            CustomWebLinkNowPlaying9 = 39,
            CustomWebLinkNowPlaying10 = 40,
        }
        public enum ComparisonType
        {
            Is = 0,
            IsSimilar = 20,
        }
        public enum LyricsType
        {
            NotSpecified = 0,
            Synchronised = 1,
            UnSynchronised = 2,
        }
        public enum PlayState
        {
            Undefined = 0,
            Loading = 1,
            Playing = 3,
            Paused = 6,
            Stopped = 7,
        }
        public enum RepeatMode
        {
            None = 0,
            All = 1,
            One = 2,
        }
        public enum PlayButtonType
        {
            PreviousTrack = 0,
            PlayPause = 1,
            NextTrack = 2,
            Stop = 3,
        }
        public enum PlaylistFormat
        {
            Unknown = 0,
            M3u = 1,
            Xspf = 2,
            Asx = 3,
            Wpl = 4,
            Pls = 5,
            Auto = 7,
            M3uAscii = 8,
            AsxFile = 9,
            Radio = 10,
            M3uExtended = 11,
            Mbp = 12,
        }
        public enum SkinElement
        {
            SkinSubPanel = 0,
            SkinInputControl = 7,
            SkinInputPanel = 10,
            SkinInputPanelLabel = 14,
            SkinTrackAndArtistPanel = -1,
        }
        public enum ElementState
        {
            ElementStateDefault = 0,
            ElementStateModified = 6,
        }
        public enum ElementComponent
        {
            ComponentBorder = 0,
            ComponentBackground = 1,
            ComponentForeground = 3,
        }
        public enum PluginPanelDock
        {
            ApplicationWindow = 0,
            TrackAndArtistPanel = 1,
            TextBox = 3,
            ComboBox = 4,
            MainPanel = 5,
        }
        public enum ReplayGainMode
        {
            Off = 0,
            Track = 1,
            Album = 2,
            Smart = 3,
        }
        public enum PlayStatisticType
        {
            NoChange = 0,
            IncreasePlayCount = 1,
            IncreaseSkipCount = 2,
        }
        public enum Command
        {
            NavigateTo = 1,
        }
        public enum DownloadTarget
        {
            Inbox = 0,
            MusicLibrary = 1,
            SpecificFolder = 3,
        }
        public enum PictureLocations
        {
            None = 0,
            EmbedInFile = 1,
            LinkToOrganisedCopy = 2,
            LinkToSource = 4,
            FolderThumb = 8,
        }
        public enum WindowState
        {
            Off = -1,
            Normal = 0,
            Fullscreen = 1,
            Desktop = 2,
        }
        // ---- one delegate type per API slot ----
        public delegate string Library_AddFileToLibraryDelegate(string arg0, LibraryCategory arg1);
        public delegate bool Library_CommitTagsToFileDelegate(string arg0);
        public delegate bool Library_FindDevicePersistentIdDelegate(DeviceIdType arg0, string[] arg1, out string[] arg2);
        public delegate string Library_GetArtistPictureDelegate(string arg0, int arg1, int arg2);
        public delegate string Library_GetArtistPictureThumbDelegate(string arg0);
        public delegate bool Library_GetArtistPictureUrlsDelegate(string arg0, bool arg1, out string[] arg2);
        public delegate string Library_GetArtworkDelegate(string arg0, int arg1);
        public delegate bool Library_GetArtworkExDelegate(string arg0, int arg1, bool arg2, out PictureLocations arg3, out string arg4, out byte[] arg5);
        public delegate string Library_GetDevicePersistentIdDelegate(string arg0, DeviceIdType arg1);
        public delegate string Library_GetFilePropertyDelegate(string arg0, FilePropertyType arg1);
        public delegate string Library_GetFileTagDelegate(string arg0, MetaDataType arg1);
        public delegate bool Library_GetFileTagsDelegate(string arg0, MetaDataType[] arg1, out string[] arg2);
        public delegate string Library_GetLyricsDelegate(string arg0, LyricsType arg1);
        public delegate bool Library_GetSyncDeltaDelegate(string[] arg0, DateTime arg1, LibraryCategory arg2, out string[] arg3, out string[] arg4, out string[] arg5);
        public delegate bool Library_QueryFilesDelegate(string arg0);
        public delegate bool Library_QueryFilesExDelegate(string arg0, out string[] arg1);
        public delegate string Library_QueryGetAllFilesDelegate();
        public delegate string Library_QueryGetLookupTableValueDelegate(string arg0);
        public delegate string Library_QueryGetNextFileDelegate();
        public delegate bool Library_QueryLookupTableDelegate(string arg0, string arg1, string arg2);
        public delegate string Library_QuerySimilarArtistsDelegate(string arg0, double arg1);
        public delegate bool Library_SetArtworkExDelegate(string arg0, int arg1, byte[] arg2);
        public delegate bool Library_SetDevicePersistentIdDelegate(string arg0, DeviceIdType arg1, string arg2);
        public delegate bool Library_SetFileTagDelegate(string arg0, MetaDataType arg1, string arg2);
        // MB_AddMenuItemDelegate: signature unresolved by probe (declared at use site as IntPtr)
        // MB_AddPanelDelegate: signature unresolved by probe (declared at use site as IntPtr)
        // MB_AddTreeNodeDelegate: signature unresolved by probe (declared at use site as IntPtr)
        // MB_CreateBackgroundTaskDelegate: signature unresolved by probe (declared at use site as IntPtr)
        // MB_CreateParameterisedBackgroundTaskDelegate: signature unresolved by probe (declared at use site as IntPtr)
        public delegate bool MB_DownloadFileDelegate(string arg0, DownloadTarget arg1, string arg2, bool arg3);
        public delegate string MB_GetLocalisationDelegate(string arg0, string arg1);
        public delegate bool MB_GetPluginViewInformationDelegate(string arg0, out string[] arg1, out string arg2, out WindowState arg3, out WindowState arg4);
        public delegate bool MB_GetVisualiserInformationDelegate(out string[] arg0, out string arg1, out WindowState arg2, out WindowState arg3);
        public delegate bool MB_InvokeCommandDelegate(Command arg0, object arg1);
        public delegate bool MB_OpenFilterInTabDelegate(MetaDataType arg0, ComparisonType arg1, string arg2, MetaDataType arg3, ComparisonType arg4, string arg5);
        public delegate void MB_RefreshPanelsDelegate();
        public delegate void MB_RegisterCommandDelegate(string arg0, EventHandler arg1);
        public delegate void MB_ReleaseStringDelegate(string arg0);
        // MB_RemovePanelDelegate: signature unresolved by probe (declared at use site as IntPtr)
        public delegate void MB_SendNotificationDelegate(CallbackType arg0);
        public delegate void MB_SetBackgroundTaskMessageDelegate(string arg0);
        public delegate bool MB_SetWindowSizeDelegate(int arg0, int arg1);
        public delegate bool MB_ShowNowPlayingAssistantDelegate();
        public delegate bool MB_ShowPluginViewDelegate(string arg0, string arg1, WindowState arg2);
        public delegate bool MB_ShowVisualiserDelegate(string arg0, WindowState arg1);
        public delegate void MB_TraceDelegate(string arg0);
        public delegate bool MB_UninistallPluginDelegate(string arg0, string arg1);
        public delegate IntPtr MB_WindowHandleDelegate();
        public delegate bool NowPlayingList_ActionDelegate();
        public delegate bool NowPlayingList_FileActionDelegate(string arg0);
        public delegate bool NowPlayingList_FilesActionDelegate(string[] arg0);
        public delegate int NowPlayingList_GetCurrentIndexDelegate();
        public delegate string NowPlayingList_GetFilePropertyDelegate(int arg0, FilePropertyType arg1);
        public delegate string NowPlayingList_GetFileTagDelegate(int arg0, MetaDataType arg1);
        public delegate bool NowPlayingList_GetFileTagsDelegate(int arg0, MetaDataType[] arg1, out string[] arg2);
        public delegate string NowPlayingList_GetFileUrlDelegate(int arg0);
        public delegate int NowPlayingList_GetNextIndexDelegate(int arg0);
        public delegate bool NowPlayingList_IsAnyFollowingTracksDelegate();
        public delegate bool NowPlayingList_IsAnyPriorTracksDelegate();
        public delegate bool NowPlayingList_MoveFilesDelegate(int[] arg0, int arg1);
        public delegate bool NowPlayingList_RemoveAtDelegate(int arg0);
        public delegate string NowPlaying_GetArtistPictureDelegate(int arg0);
        public delegate string NowPlaying_GetArtistPictureThumbDelegate();
        public delegate bool NowPlaying_GetArtistPictureUrlsDelegate(bool arg0, out string[] arg1);
        public delegate string NowPlaying_GetArtworkDelegate();
        public delegate int NowPlaying_GetDurationDelegate();
        public delegate string NowPlaying_GetFilePropertyDelegate(FilePropertyType arg0);
        public delegate string NowPlaying_GetFileTagDelegate(MetaDataType arg0);
        public delegate bool NowPlaying_GetFileTagsDelegate(MetaDataType[] arg0, out string[] arg1);
        public delegate string NowPlaying_GetFileUrlDelegate();
        public delegate string NowPlaying_GetLyricsDelegate();
        public delegate bool NowPlaying_GetSoundGraphDelegate(float[] arg0);
        public delegate int NowPlaying_GetSpectrumDataDelegate(float[] arg0);
        public delegate bool NowPlaying_IsSoundtrackDelegate();
        public delegate string Pending_GetFilePropertyDelegate(FilePropertyType arg0);
        public delegate string Pending_GetFileTagDelegate(MetaDataType arg0);
        public delegate string Pending_GetFileUrlDelegate();
        public delegate bool Player_ActionDelegate();
        public delegate bool Player_GetAutoDjEnabledDelegate();
        public delegate bool Player_GetButtonEnabledDelegate(PlayButtonType arg0);
        public delegate bool Player_GetCrossfadeDelegate();
        public delegate bool Player_GetDspEnabledDelegate();
        public delegate bool Player_GetEqualiserEnabledDelegate();
        public delegate bool Player_GetMuteDelegate();
        public delegate bool Player_GetOutputDevicesDelegate(out string[] arg0, out string arg1);
        public delegate PlayState Player_GetPlayStateDelegate();
        public delegate int Player_GetPositionDelegate();
        public delegate RepeatMode Player_GetRepeatDelegate();
        public delegate ReplayGainMode Player_GetReplayGainModeDelegate();
        public delegate bool Player_GetScrobbleEnabledDelegate();
        public delegate bool Player_GetShowRatingLoveDelegate();
        public delegate bool Player_GetShowRatingTrackDelegate();
        public delegate bool Player_GetShowTimeRemainingDelegate();
        public delegate bool Player_GetShuffleDelegate();
        public delegate bool Player_GetStopAfterCurrentEnabledDelegate();
        public delegate float Player_GetVolumeDelegate();
        public delegate int Player_OpenStreamHandleDelegate(string arg0, bool arg1, bool arg2, ReplayGainMode arg3);
        public delegate int Player_QueueRandomTracksDelegate(int arg0);
        public delegate bool Player_SetCrossfadeDelegate(bool arg0);
        public delegate bool Player_SetDspEnabledDelegate(bool arg0);
        public delegate bool Player_SetEqualiserEnabledDelegate(bool arg0);
        public delegate bool Player_SetMuteDelegate(bool arg0);
        public delegate bool Player_SetOutputDeviceDelegate(string arg0);
        public delegate bool Player_SetPositionDelegate(int arg0);
        public delegate bool Player_SetRepeatDelegate(RepeatMode arg0);
        public delegate bool Player_SetReplayGainModeDelegate(ReplayGainMode arg0);
        public delegate bool Player_SetScrobbleEnabledDelegate(bool arg0);
        public delegate bool Player_SetShuffleDelegate(bool arg0);
        public delegate bool Player_SetVolumeDelegate(float arg0);
        public delegate bool Player_ShowEqualiserDelegate();
        public delegate bool Player_UpdatePlayStatisticsDelegate(string arg0, PlayStatisticType arg1, bool arg2);
        public delegate bool Playlist_AddFilesDelegate(string arg0, string[] arg1);
        public delegate string Playlist_CreatePlaylistDelegate(string arg0, string arg1, string[] arg2);
        public delegate bool Playlist_DeletePlaylistDelegate(string arg0);
        public delegate string Playlist_GetNameDelegate(string arg0);
        public delegate PlaylistFormat Playlist_GetTypeDelegate(string arg0);
        public delegate bool Playlist_IsInListDelegate(string arg0, string arg1);
        public delegate bool Playlist_MoveFilesDelegate(string arg0, int[] arg1, int arg2);
        public delegate bool Playlist_PlayNowDelegate(string arg0);
        public delegate bool Playlist_QueryFilesDelegate(string arg0);
        public delegate bool Playlist_QueryFilesExDelegate(string arg0, out string[] arg1);
        public delegate string Playlist_QueryGetNextPlaylistDelegate();
        public delegate bool Playlist_QueryPlaylistsDelegate();
        public delegate bool Playlist_RemoveAtDelegate(string arg0, int arg1);
        public delegate bool Playlist_SetFilesDelegate(string arg0, string[] arg1);
        public delegate DataType Setting_GetDataTypeDelegate(MetaDataType arg0);
        // Setting_GetDefaultFontDelegate: signature unresolved by probe (declared at use site as IntPtr)
        public delegate string Setting_GetFieldNameDelegate(MetaDataType arg0);
        public delegate string Setting_GetFileConvertCommandLineDelegate(FileCodec arg0, EncodeQuality arg1);
        public delegate string Setting_GetLastFmUserIdDelegate();
        public delegate string Setting_GetPersistentStoragePathDelegate();
        public delegate string Setting_GetSkinDelegate();
        public delegate int Setting_GetSkinElementColourDelegate(SkinElement arg0, ElementState arg1, ElementComponent arg2);
        public delegate bool Setting_GetValueDelegate(SettingId arg0, out object arg1);
        public delegate string Setting_GetWebProxyDelegate();
        public delegate bool Setting_IsWindowBordersSkinnedDelegate();
        public delegate void Sync_FileEndDelegate(string arg0, bool arg1, string arg2);
        public delegate string Sync_FileStartDelegate(string arg0);
        // ---- the API struct: 166 slots, metadata order ----
        [StructLayout(LayoutKind.Sequential)]
        public struct MusicBeeApiInterface
        {
            public short InterfaceVersion;
            public short ApiRevision;
            public MB_ReleaseStringDelegate MB_ReleaseString;
            public MB_TraceDelegate MB_Trace;
            public Setting_GetPersistentStoragePathDelegate Setting_GetPersistentStoragePath;
            public Setting_GetSkinDelegate Setting_GetSkin;
            public Setting_GetSkinElementColourDelegate Setting_GetSkinElementColour;
            public Setting_IsWindowBordersSkinnedDelegate Setting_IsWindowBordersSkinned;
            public Library_GetFilePropertyDelegate Library_GetFileProperty;
            public Library_GetFileTagDelegate Library_GetFileTag;
            public Library_SetFileTagDelegate Library_SetFileTag;
            public Library_CommitTagsToFileDelegate Library_CommitTagsToFile;
            public Library_GetLyricsDelegate Library_GetLyrics;
            public Library_GetArtworkDelegate Library_GetArtwork;
            public Library_QueryFilesDelegate Library_QueryFiles;
            public Library_QueryGetNextFileDelegate Library_QueryGetNextFile;
            public Player_GetPositionDelegate Player_GetPosition;
            public Player_SetPositionDelegate Player_SetPosition;
            public Player_GetPlayStateDelegate Player_GetPlayState;
            public Player_ActionDelegate Player_PlayPause;
            public Player_ActionDelegate Player_Stop;
            public Player_ActionDelegate Player_StopAfterCurrent;
            public Player_ActionDelegate Player_PlayPreviousTrack;
            public Player_ActionDelegate Player_PlayNextTrack;
            public Player_ActionDelegate Player_StartAutoDj;
            public Player_ActionDelegate Player_EndAutoDj;
            public Player_GetVolumeDelegate Player_GetVolume;
            public Player_SetVolumeDelegate Player_SetVolume;
            public Player_GetMuteDelegate Player_GetMute;
            public Player_SetMuteDelegate Player_SetMute;
            public Player_GetShuffleDelegate Player_GetShuffle;
            public Player_SetShuffleDelegate Player_SetShuffle;
            public Player_GetRepeatDelegate Player_GetRepeat;
            public Player_SetRepeatDelegate Player_SetRepeat;
            public Player_GetEqualiserEnabledDelegate Player_GetEqualiserEnabled;
            public Player_SetEqualiserEnabledDelegate Player_SetEqualiserEnabled;
            public Player_GetDspEnabledDelegate Player_GetDspEnabled;
            public Player_SetDspEnabledDelegate Player_SetDspEnabled;
            public Player_GetScrobbleEnabledDelegate Player_GetScrobbleEnabled;
            public Player_SetScrobbleEnabledDelegate Player_SetScrobbleEnabled;
            public NowPlaying_GetFileUrlDelegate NowPlaying_GetFileUrl;
            public NowPlaying_GetDurationDelegate NowPlaying_GetDuration;
            public NowPlaying_GetFilePropertyDelegate NowPlaying_GetFileProperty;
            public NowPlaying_GetFileTagDelegate NowPlaying_GetFileTag;
            public NowPlaying_GetLyricsDelegate NowPlaying_GetLyrics;
            public NowPlaying_GetArtworkDelegate NowPlaying_GetArtwork;
            public NowPlayingList_ActionDelegate NowPlayingList_Clear;
            public Library_QueryFilesDelegate NowPlayingList_QueryFiles;
            public Library_QueryGetNextFileDelegate NowPlayingList_QueryGetNextFile;
            public NowPlayingList_FileActionDelegate NowPlayingList_PlayNow;
            public NowPlayingList_FileActionDelegate NowPlayingList_QueueNext;
            public NowPlayingList_FileActionDelegate NowPlayingList_QueueLast;
            public NowPlayingList_ActionDelegate NowPlayingList_PlayLibraryShuffled;
            public Playlist_QueryPlaylistsDelegate Playlist_QueryPlaylists;
            public Playlist_QueryGetNextPlaylistDelegate Playlist_QueryGetNextPlaylist;
            public Playlist_GetTypeDelegate Playlist_GetType;
            public Playlist_QueryFilesDelegate Playlist_QueryFiles;
            public Library_QueryGetNextFileDelegate Playlist_QueryGetNextFile;
            public MB_WindowHandleDelegate MB_GetWindowHandle;
            public MB_RefreshPanelsDelegate MB_RefreshPanels;
            public MB_SendNotificationDelegate MB_SendNotification;
            public IntPtr MB_AddMenuItem;   // slot kept for layout; type was MB_AddMenuItemDelegate
            public Setting_GetFieldNameDelegate Setting_GetFieldName;
            public Library_QueryGetAllFilesDelegate Library_QueryGetAllFiles;
            public Library_QueryGetAllFilesDelegate NowPlayingList_QueryGetAllFiles;
            public Library_QueryGetAllFilesDelegate Playlist_QueryGetAllFiles;
            public IntPtr MB_CreateBackgroundTask;   // slot kept for layout; type was MB_CreateBackgroundTaskDelegate
            public MB_SetBackgroundTaskMessageDelegate MB_SetBackgroundTaskMessage;
            public MB_RegisterCommandDelegate MB_RegisterCommand;
            public IntPtr Setting_GetDefaultFont;   // slot kept for layout; type was Setting_GetDefaultFontDelegate
            public Player_GetShowTimeRemainingDelegate Player_GetShowTimeRemaining;
            public NowPlayingList_GetCurrentIndexDelegate NowPlayingList_GetCurrentIndex;
            public NowPlayingList_GetFileUrlDelegate NowPlayingList_GetListFileUrl;
            public NowPlayingList_GetFilePropertyDelegate NowPlayingList_GetFileProperty;
            public NowPlayingList_GetFileTagDelegate NowPlayingList_GetFileTag;
            public NowPlaying_GetSpectrumDataDelegate NowPlaying_GetSpectrumData;
            public NowPlaying_GetSoundGraphDelegate NowPlaying_GetSoundGraph;
            public IntPtr MB_GetPanelBounds;   // slot kept for layout; type was (unresolved by probe)
            public IntPtr MB_AddPanel;   // slot kept for layout; type was MB_AddPanelDelegate
            public IntPtr MB_RemovePanel;   // slot kept for layout; type was MB_RemovePanelDelegate
            public MB_GetLocalisationDelegate MB_GetLocalisation;
            public NowPlayingList_IsAnyPriorTracksDelegate NowPlayingList_IsAnyPriorTracks;
            public NowPlayingList_IsAnyFollowingTracksDelegate NowPlayingList_IsAnyFollowingTracks;
            public Player_ShowEqualiserDelegate Player_ShowEqualiser;
            public Player_GetAutoDjEnabledDelegate Player_GetAutoDjEnabled;
            public Player_GetStopAfterCurrentEnabledDelegate Player_GetStopAfterCurrentEnabled;
            public Player_GetCrossfadeDelegate Player_GetCrossfade;
            public Player_SetCrossfadeDelegate Player_SetCrossfade;
            public Player_GetReplayGainModeDelegate Player_GetReplayGainMode;
            public Player_SetReplayGainModeDelegate Player_SetReplayGainMode;
            public Player_QueueRandomTracksDelegate Player_QueueRandomTracks;
            public Setting_GetDataTypeDelegate Setting_GetDataType;
            public NowPlayingList_GetNextIndexDelegate NowPlayingList_GetNextIndex;
            public NowPlaying_GetArtistPictureDelegate NowPlaying_GetArtistPicture;
            public NowPlaying_GetArtworkDelegate NowPlaying_GetDownloadedArtwork;
            public MB_ShowNowPlayingAssistantDelegate MB_ShowNowPlayingAssistant;
            public NowPlaying_GetLyricsDelegate NowPlaying_GetDownloadedLyrics;
            public Player_GetShowRatingTrackDelegate Player_GetShowRatingTrack;
            public Player_GetShowRatingLoveDelegate Player_GetShowRatingLove;
            public IntPtr MB_CreateParameterisedBackgroundTask;   // slot kept for layout; type was MB_CreateParameterisedBackgroundTaskDelegate
            public Setting_GetLastFmUserIdDelegate Setting_GetLastFmUserId;
            public Playlist_GetNameDelegate Playlist_GetName;
            public Playlist_CreatePlaylistDelegate Playlist_CreatePlaylist;
            public Playlist_SetFilesDelegate Playlist_SetFiles;
            public Library_QuerySimilarArtistsDelegate Library_QuerySimilarArtists;
            public Library_QueryLookupTableDelegate Library_QueryLookupTable;
            public Library_QueryGetLookupTableValueDelegate Library_QueryGetLookupTableValue;
            public NowPlayingList_FilesActionDelegate NowPlayingList_QueueFilesNext;
            public NowPlayingList_FilesActionDelegate NowPlayingList_QueueFilesLast;
            public Setting_GetWebProxyDelegate Setting_GetWebProxy;
            public NowPlayingList_RemoveAtDelegate NowPlayingList_RemoveAt;
            public Playlist_RemoveAtDelegate Playlist_RemoveAt;
            public IntPtr MB_SetPanelScrollableArea;   // slot kept for layout; type was (unresolved by probe)
            public MB_InvokeCommandDelegate MB_InvokeCommand;
            public MB_OpenFilterInTabDelegate MB_OpenFilterInTab;
            public MB_SetWindowSizeDelegate MB_SetWindowSize;
            public Library_GetArtistPictureDelegate Library_GetArtistPicture;
            public Pending_GetFileUrlDelegate Pending_GetFileUrl;
            public Pending_GetFilePropertyDelegate Pending_GetFileProperty;
            public Pending_GetFileTagDelegate Pending_GetFileTag;
            public Player_GetButtonEnabledDelegate Player_GetButtonEnabled;
            public NowPlayingList_MoveFilesDelegate NowPlayingList_MoveFiles;
            public Library_GetArtworkDelegate Library_GetArtworkUrl;
            public Library_GetArtistPictureThumbDelegate Library_GetArtistPictureThumb;
            public NowPlaying_GetArtworkDelegate NowPlaying_GetArtworkUrl;
            public NowPlaying_GetArtworkDelegate NowPlaying_GetDownloadedArtworkUrl;
            public NowPlaying_GetArtistPictureThumbDelegate NowPlaying_GetArtistPictureThumb;
            public Playlist_IsInListDelegate Playlist_IsInList;
            public Library_GetArtistPictureUrlsDelegate Library_GetArtistPictureUrls;
            public NowPlaying_GetArtistPictureUrlsDelegate NowPlaying_GetArtistPictureUrls;
            public Playlist_AddFilesDelegate Playlist_AppendFiles;
            public Sync_FileStartDelegate Sync_FileStart;
            public Sync_FileEndDelegate Sync_FileEnd;
            public Library_QueryFilesExDelegate Library_QueryFilesEx;
            public Library_QueryFilesExDelegate NowPlayingList_QueryFilesEx;
            public Playlist_QueryFilesExDelegate Playlist_QueryFilesEx;
            public Playlist_MoveFilesDelegate Playlist_MoveFiles;
            public Playlist_PlayNowDelegate Playlist_PlayNow;
            public NowPlaying_IsSoundtrackDelegate NowPlaying_IsSoundtrack;
            public NowPlaying_GetArtistPictureUrlsDelegate NowPlaying_GetSoundtrackPictureUrls;
            public Library_GetDevicePersistentIdDelegate Library_GetDevicePersistentId;
            public Library_SetDevicePersistentIdDelegate Library_SetDevicePersistentId;
            public Library_FindDevicePersistentIdDelegate Library_FindDevicePersistentId;
            public Setting_GetValueDelegate Setting_GetValue;
            public Library_AddFileToLibraryDelegate Library_AddFileToLibrary;
            public Playlist_DeletePlaylistDelegate Playlist_DeletePlaylist;
            public Library_GetSyncDeltaDelegate Library_GetSyncDelta;
            public Library_GetFileTagsDelegate Library_GetFileTags;
            public NowPlaying_GetFileTagsDelegate NowPlaying_GetFileTags;
            public NowPlayingList_GetFileTagsDelegate NowPlayingList_GetFileTags;
            public IntPtr MB_AddTreeNode;   // slot kept for layout; type was MB_AddTreeNodeDelegate
            public MB_DownloadFileDelegate MB_DownloadFile;
            public Setting_GetFileConvertCommandLineDelegate Setting_GetFileConvertCommandLine;
            public Player_OpenStreamHandleDelegate Player_OpenStreamHandle;
            public Player_UpdatePlayStatisticsDelegate Player_UpdatePlayStatistics;
            public Library_GetArtworkExDelegate Library_GetArtworkEx;
            public Library_SetArtworkExDelegate Library_SetArtworkEx;
            public MB_GetVisualiserInformationDelegate MB_GetVisualiserInformation;
            public MB_ShowVisualiserDelegate MB_ShowVisualiser;
            public MB_GetPluginViewInformationDelegate MB_GetPluginViewInformation;
            public MB_ShowPluginViewDelegate MB_ShowPluginView;
            public Player_GetOutputDevicesDelegate Player_GetOutputDevices;
            public Player_SetOutputDeviceDelegate Player_SetOutputDevice;
            public MB_UninistallPluginDelegate MB_UninstallPlugin;
            public Player_ActionDelegate Player_PlayPreviousAlbum;
            public Player_ActionDelegate Player_PlayNextAlbum;
        }
        // ---- the info block the plugin hands back to MusicBee ----
        public class PluginInfo
        {
            public Int16 PluginInfoVersion;
            public PluginType Type;
            public string Name;
            public string Description;
            public string Author;
            public string TargetApplication;
            public Int16 VersionMajor;
            public Int16 VersionMinor;
            public Int16 Revision;
            public Int16 MinInterfaceVersion;
            public Int16 MinApiRevision;
            public ReceiveNotificationFlags ReceiveNotifications;
            public int ConfigurationPanelHeight;
        }
    }
}
