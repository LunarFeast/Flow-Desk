/* 第三层 · 挑文件与挑目录那两道对话框
   ------------------------------------------------------------
   照主进程那份 463~484 行两颗处理函数搬：fsa:pickFiles 与 fsa:pickDir，回的都是 { paths: [...] }，
   取消了或没挑就回空的一串 —— 页面那边一个字不改（页面上请的是 window.showOpenFilePicker /
   window.showDirectoryPicker，那两颗是主进程在 preload 里自己造出来的，壳这边由还没写的 JS 桥顶上去）。

   三处跟着一起搬过来的东西：
     · 探针预置（环境变量 FD_AUTOTEST_PICK 里那串）：有货就不开真对话框，照 nextPick 一条一条给；
     · 记住上次挑过哪里（外21 乙-1 那条）：各记各的，键是调用方本来就传的 id，
       落在那一份 ui-paths.json 里（记事本可看可删），位置跟主进程那边同一格；
     · 类型筛选：accept 那张表里只认带点的后缀，去重合成一条「选定类型」。
   一处没有对等接口：主进程那边挑目录的框上还多一个"新建文件夹"的按钮（properties 里那条
   createDirectory），官方那颗对话框 crate 没有这一档。 */
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::{DialogExt, FilePath};

use crate::fd_core::pick_policy::{下一挑, 该记, 起点, 归格, 筛选, 读预置};

/* 探针预置那串挑好的，起壳时从环境变量取一次 */
#[derive(Default)]
pub struct 对话框手 {
    预置: Mutex<Vec<Vec<String>>>,
}

impl 对话框手 {
    pub fn 起() -> Self {
        let 串 = std::env::var("FD_AUTOTEST_PICK").unwrap_or_default();
        对话框手 { 预置: Mutex::new(读预置(&串)) }
    }
}

/* 用户数据那一格：跟主进程那边同一套认法 —— 环境变量指到哪儿算哪儿，
   否则在三处候选里挑真实存在的那一格，都没有就落在 data\userdata-fd（还没建出来时也认这一格） */
pub fn 数据格() -> PathBuf {
    if let Ok(v) = std::env::var("FD_USERDATA") {
        if !v.trim().is_empty() { return PathBuf::from(v); }
    }
    let 树 = crate::tree_root();
    let 候选 = [树.join("data").join("userdata-fd"), 树.join("userdata-fd"),
        std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.join("userdata-fd")))
            .unwrap_or_else(|| 树.join("data").join("userdata-fd"))];
    for c in 候选.iter() { if c.exists() { return c.clone(); } }
    候选[0].clone()
}

const 路径档: &str = "ui-paths.json";

fn 路径表() -> HashMap<String, String> {
    let 路 = 数据格().join(路径档);
    match std::fs::read_to_string(路) {
        Ok(文) => serde_json::from_str::<HashMap<String, String>>(&文).unwrap_or_default(),
        Err(_) => HashMap::new(),
    }
}

fn 落表(表: &HashMap<String, String>) {
    /* 这一格写不进去就当没记着，绝不能因为记路径这件事把挑选那一步带倒 */
    let 路 = 数据格().join(路径档);
    if let Ok(文) = serde_json::to_string_pretty(表) {
        if let Some(格) = 路.parent() { let _ = std::fs::create_dir_all(格); }
        let _ = std::fs::write(路, 文);
    }
}

#[derive(serde::Serialize)]
pub struct 一批路径 { paths: Vec<String> }

fn 化成串(列: Vec<FilePath>) -> Vec<String> {
    列.into_iter().filter_map(|x| x.into_path().ok())
        .map(|p| p.to_string_lossy().to_string()).collect()
}

/* 挑完把"上次那一格"记下来：照主进程那边 —— 挑中的那一样自己是不是目录说了算，
   是文件就记它上一格；那一样在盘上查不到就当没挑，什么都不记 */
fn 记一处(id: &str, 挑中: &str) {
    if id.is_empty() || 挑中.is_empty() { return; }
    let 是目录 = match std::fs::metadata(挑中) { Ok(m) => m.is_dir(), Err(_) => return };
    let 格 = 归格(挑中, 是目录);
    let mut 表 = 路径表();
    if 该记(&表, id, &格) { 表.insert(id.to_string(), 格); 落表(&表); }
}

fn 开框(app: &AppHandle, opts: &serde_json::Value, 挑目录: bool) -> 一批路径 {
    let 题 = match opts.get("title").and_then(|v| v.as_str()) {
        Some(t) if !t.is_empty() => t.to_string(),
        _ => if 挑目录 { "选目录".to_string() } else { "选文件".to_string() },
    };
    let 调用id = opts.get("id").and_then(|v| v.as_str()).unwrap_or("");
    let 表 = 路径表();
    let 是目录 = |p: &str| std::fs::metadata(p).map(|m| m.is_dir()).unwrap_or(false);
    let 起处 = 起点(&表, 调用id, &是目录);

    let 建 = app.dialog().file();
    let 建 = 建.set_title(&题);
    let 建 = match app.get_webview_window("main") { Some(w) => 建.set_parent(&w), None => 建 };
    let 建 = if 起处.is_empty() { 建 } else { 建.set_directory(起处) };
    let 接受 = opts.get("accept").cloned().unwrap_or(serde_json::Value::Null);
    let 筛选列 = 筛选(&接受);
    let 建 = 筛选列.iter().fold(建, |累, (名, 后)| {
        let 串: Vec<&str> = 后.iter().map(String::as_str).collect();
        累.add_filter(名.clone(), &串)
    });

    let 挑中: Vec<String> = if 挑目录 {
        建.blocking_pick_folder().into_iter().filter_map(|x| x.into_path().ok())
            .map(|p| p.to_string_lossy().to_string()).collect()
    } else {
        化成串(建.blocking_pick_files().unwrap_or_default())
    };
    if !挑中.is_empty() { 记一处(调用id, &挑中[0]); }
    一批路径 { paths: 挑中 }
}

/* 探针有预置就一条一条给，给完才开真框 —— 照主进程那边 if(autotest.length) 那道判断 */
fn 先取预置(手: &State<'_, 对话框手>) -> Option<一批路径> {
    let mut 队 = 手.预置.lock().unwrap_or_else(|e| e.into_inner());
    if 队.is_empty() { return None; }
    Some(一批路径 { paths: 下一挑(&mut 队) })
}

/* 两道框共用这一条：先看探针有没有预置，没有才开真框 */
fn 挑一把(app: &AppHandle, opts: Option<serde_json::Value>, 挑目录: bool) -> 一批路径 {
    let 手 = app.state::<对话框手>();
    if let Some(预置) = 先取预置(&手) { return 预置; }
    drop(手);
    开框(app, &opts.unwrap_or(serde_json::Value::Null), 挑目录)
}

#[tauri::command]
pub async fn fsa_pick_files(app: AppHandle, opts: Option<serde_json::Value>) -> Result<一批路径, String> {
    Ok(挑一把(&app, opts, false))
}

#[tauri::command]
pub async fn fsa_pick_dir(app: AppHandle, opts: Option<serde_json::Value>) -> Result<一批路径, String> {
    Ok(挑一把(&app, opts, true))
}
