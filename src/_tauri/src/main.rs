/* Flow-Desk 的 Tauri 壳 · 第一版骨架（外46 起这条线开工，目标是换掉 Electron 那一层）
   ------------------------------------------------------------
   这一棵现在只干三件事，都是为了让后面那一大摊搬得有地方落：
     ① 认得出这一棵树装在哪（外壳自己所在目录，不写死盘符）；
     ② 把当前版本号报给前端 —— 号由发布脚本当环境变量传进来（FD_VERSION / FD_BUILD），
        壳自己不去 git 取号，也不在这份配置里再钉一遍字面值：他定的口径是「打包 ↔ 提交 ↔ tag ↔ 号」
        一一对应，取号那一头归 src\_build\version.mjs；
     ③ 开一张窗口。
   通道名跟着现有主进程那一套写法用 ASCII（sys:、pack:……），中文只留在函数体和注释里。
   还没搬的：主进程那 74 个通道、运行时那 6 份文件里的 21 处 Node 调用、故障真隔离、网格吸附。
   一条一条搬，每搬一条补一条闸。 */
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;

/* 树在哪：拿壳自己所在那一格，整棵树照相对位置找（跟现有「路径全按这个文件夹的相对位置」同一口径） */
fn tree_root() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."))
}

/* 号：环境变量优先，没传就退回这一档的底色（本地自己跑壳的时候不至于报空号） */
fn version() -> String {
    let 底 = match std::env::var("FD_VERSION") {
        Ok(v) if !v.trim().is_empty() => v.trim().to_string(),
        _ => "2.0.0-alpha".to_string(),
    };
    match std::env::var("FD_BUILD") {
        Ok(v) if !v.trim().is_empty() => format!("{}+build.{}", 底, v.trim().replace("build.", "")),
        _ => 底,
    }
}

#[tauri::command]
fn shell_info() -> serde_json::Value {
    serde_json::json!({
        "version": version(),
        "root": tree_root().to_string_lossy(),
        "runtime": "tauri",
    })
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![shell_info])
        .run(tauri::generate_context!())
        .expect("Flow-Desk 的 Tauri 壳起不来");
}
