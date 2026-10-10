/* Flow-Desk 的 Tauri 壳 · 第一版骨架（外46 起这条线开工，目标是换掉 Electron 那一层）
   ------------------------------------------------------------
   这一棵现在干四件事，都是为了让后面那一大摊搬得有地方落：
     ① 认得出这一棵树装在哪（外壳自己所在目录，不写死盘符）；
     ② 把当前版本号报给前端 —— 号由发布脚本当环境变量传进来（FD_VERSION / FD_BUILD），
        壳自己不去 git 取号，也不在这份配置里再钉一遍字面值：他定的口径是「打包 ↔ 提交 ↔ tag ↔ 号」
        一一对应，取号那一头归 src\_build\version.mjs；
     ③ 开一张窗口；
     ④ 文件读写那一组十颗通道（外46 三搬的第一组，纯判断在 fd_core、动手在 tauri_bind::fs_cmds）。
   命令名这一头有个硬限制：Rust 函数名就是页面上 invoke 的那个串，里面不能有冒号，
   所以现有主进程的「fs:read」这一类写法在壳里落成「fs_read」，冒号那道换算放在还没写的 JS 桥上做 ——
   页面上请壳的那串字一个字都不改（他定的「前端原样保留」）。
   还没搬的：主进程那 74 个通道里剩下的六十四颗、运行时那 6 份文件里的 21 处 Node 调用、故障真隔离、网格吸附。
   一条一条搬，每搬一条补一条闸。 */
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[path = "core/mod.rs"]
mod fd_core;            // 四层里的第一层：纯判断（目录仍叫 core，模块名避开 Rust 自己那个 core）
mod tauri_bind;          // 四层里的第三层：命令胶水与动磁盘的那一手

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
        /* 窗口这一组要记着的三件事：当前缩放、关窗口那张框问出去没有、是不是已经在收摊 */
        .manage(tauri_bind::win_cmds::窗口手::default())
        /* 关窗口先拦下来问页面；窗口形状一变就回报 win:state */
        .on_window_event(tauri_bind::win_cmds::窗口事件)
        /* 托盘：那张框上「收进托盘」那条要有地方去，左键露/缩、右键开单 */
        .setup(|app| {
            tauri_bind::win_cmds::建托盘(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            shell_info,
            tauri_bind::fs_cmds::fs_read,
            tauri_bind::fs_cmds::fs_read_range,
            tauri_bind::fs_cmds::fs_stat,
            tauri_bind::fs_cmds::fs_write,
            tauri_bind::fs_cmds::fs_append,
            tauri_bind::fs_cmds::fs_mkdir,
            tauri_bind::fs_cmds::fs_unlink,
            tauri_bind::fs_cmds::fs_list,
            tauri_bind::fs_cmds::fs_tree,
            tauri_bind::fs_cmds::fs_read_text,
            tauri_bind::win_cmds::win_ctl,
            tauri_bind::win_cmds::win_close_answer,
        ])
        .run(tauri::generate_context!())
        .expect("Flow-Desk 的 Tauri 壳起不来");
}
