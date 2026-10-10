/* 第三层 · 窗口控制、关窗口的那句问话、托盘
   ------------------------------------------------------------
   照主进程那几颗搬：winCtl(那份文件 2559 行) / winState(2534) / askToClose(2371) / doClose(2378) / buildTray。
   页面上请的串一个字不改（min / max / close / quit / reload / reloadForce / fullscreen /
   zoomIn / zoomOut / zoomReset / state），冒号那道换算在还没写的 JS 桥上做。

   三处 Rust 这头没有对等接口，是量过源码定的写法，不是凑的：
     · 缩放只能设不能读回（WebviewWindow 有 set_zoom 没有 get_zoom），所以当前倍数由壳自己记着，
       档位算法（一格 0.1、夹在 0.5 到 2 之间、两位小数收）在 fd_core::win_policy 里，带测试；
     · 重载只有一颗 reload()，主进程那"不用缓存"的第二档在 Rust 这头没有对应接口，两个动作都走 reload；
     · 窗口事件里没有 maximize / fullscreen 两种通知（只有 Resized / Moved / CloseRequested / Destroyed /
       Focused / ScaleFactorChanged / ThemeChanged 这些），所以窗口形状一变就回报 win:state ——
       拖到屏幕顶自动最大化、以及以后那条网格吸附，都在这一下里报出去。
   托盘上那三行字，主进程那边是从「界面文字」那张表取的（trayText），那张表还没搬，
   这一版先给它表里的默认字，等那张表进壳了换成从表里取。 */
use std::sync::Mutex;
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};

use crate::fd_core::win_policy::zoom_step;

/* 壳自己记着的三件事：当前缩放、关窗口那张框问出去没有、是不是已经在收摊 */
#[derive(Default)]
pub struct 窗口手 {
    缩放: Mutex<f64>,
    待回答: Mutex<bool>,
    退出中: Mutex<bool>,
}

/* 回报给页面的形状跟主进程那两颗一样：{ maximized, fullscreen } */
#[derive(serde::Serialize, Clone, Copy)]
pub struct 一个窗口状态 {
    pub maximized: bool,
    pub fullscreen: bool,
}

fn 锁<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    /* 别因为哪一处崩过就把整颗壳带倒：中毒的那把锁照样把值交出来 */
    m.lock().unwrap_or_else(|e| e.into_inner())
}

fn 主窗口(app: &AppHandle) -> Option<tauri::WebviewWindow> {
    app.get_webview_window("main")
}

fn 现况(app: &AppHandle) -> 一个窗口状态 {
    match 主窗口(app) {
        Some(w) => 一个窗口状态 {
            maximized: w.is_maximized().unwrap_or(false),
            fullscreen: w.is_fullscreen().unwrap_or(false),
        },
        None => 一个窗口状态 { maximized: false, fullscreen: false },
    }
}

fn 报状态(app: &AppHandle) {
    let _ = app.emit("win:state", 现况(app));
}

/* 收摊：先立"已经在收了"这块牌，CloseRequested 那头就不再拦，然后整颗退出 */
fn 收摊(app: &AppHandle) {
    let 手 = app.state::<窗口手>();
    *锁(&手.待回答) = false;
    *锁(&手.退出中) = true;
    app.exit(0);
}

/* ---------- 页面上那三颗按钮与快捷键走这一颗 ---------- */
#[tauri::command]
pub fn win_ctl(app: AppHandle, act: String, 手: State<'_, 窗口手>) -> Result<一个窗口状态, String> {
    if act == "quit" {
        收摊(&app);
        return Ok(现况(&app));
    }
    let Some(w) = 主窗口(&app) else { return Ok(现况(&app)) };
    let 错 = |e: tauri::Error| e.to_string();
    match act.as_str() {
        "min" => { let _ = w.minimize(); }
        "max" => {
            if w.is_maximized().unwrap_or(false) { w.unmaximize().map_err(错)?; }
            else { w.maximize().map_err(错)?; }
        }
        /* 这一颗会先绕 CloseRequested，在那里拦下问页面 —— 跟主进程那边 w.close() 被那张框拦住同一形状 */
        "close" => { let _ = w.close(); }
        "reload" | "reloadForce" => { let _ = w.reload(); }
        "fullscreen" => {
            let 新 = !w.is_fullscreen().unwrap_or(false);
            w.set_fullscreen(新).map_err(错)?;
        }
        "zoomIn" | "zoomOut" | "zoomReset" => {
            let 新 = zoom_step(*锁(&手.缩放), &act);
            *锁(&手.缩放) = 新;
            w.set_zoom(新).map_err(错)?;
        }
        /* 这一档只回报不动手，跟主进程那边 "state" 直接 return winState() 同一形状 */
        "state" => {}
        _ => {}
    }
    报状态(&app);
    Ok(现况(&app))
}

/* ---------- 关窗口那张框的回答（主进程那边是 ipcMain.on，不收返回值） ---------- */
#[tauri::command]
pub fn win_close_answer(app: AppHandle, action: String, 手: State<'_, 窗口手>) -> bool {
    if !*锁(&手.待回答) { return false; }
    *锁(&手.待回答) = false;
    match action.as_str() {
        "quit" => 收摊(&app),
        "tray" => { if let Some(w) = 主窗口(&app) { let _ = w.hide(); } }
        _ => {}
    }
    报状态(&app);
    true
}

/* ---------- 窗口的两道事件：关窗口的拦与形状变化的回报 ----------
   回调收到的是 Window 不是 WebviewWindow（壳那一头的 on_window_event 就要这种），
   要动窗口本体再用 get_webview_window 取那一张。 */
pub fn 窗口事件(w: &tauri::Window, e: &WindowEvent) {
    match e {
        WindowEvent::CloseRequested { api, .. } => {
            let app = w.app_handle();
            let 手 = app.state::<窗口手>();
            api.prevent_close();
            if *锁(&手.退出中) || *锁(&手.待回答) { return; }
            *锁(&手.待回答) = true;
            let _ = app.emit("fd:close-ask", ());
            /* 二十秒没回话就按「退出」收 —— 主进程那边踩过这一条：落到托盘又没收干净，
               结果窗口关了、进程还留在后台 */
            let 另一颗 = app.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(20));
                let 手 = 另一颗.state::<窗口手>();
                if *锁(&手.待回答) { 收摊(&另一颗); }
            });
        }
        WindowEvent::Resized(_) => 报状态(w.app_handle()),
        _ => {}
    }
}

/* ---------- 托盘：关窗口那张框上「收进托盘」那条要有地方去 ---------- */
fn 托盘图() -> Image<'static> {
    /* 优先用打进 exe 的那颗程序图标（tauri-build 塞进去的），拿不到再照主进程那边
       落一格 16x16 的纯色兜底，两头同一色值 */
    if let Ok(图) = Image::from_app_icon_resource(32) { return 图; }
    let 边 = 16usize;
    let 子 = vec![90u8, 130, 210, 255];
    let 面 = 子.repeat(边 * 边);
    Image::new_owned(面, 边 as u32, 边 as u32)
}

fn 闪一下(app: &AppHandle) {
    /* 主进程那边点托盘一下：没窗口就造一张，有就"看得见就缩、看不见就露" */
    match 主窗口(app) {
        Some(w) => {
            if w.is_visible().unwrap_or(true) { let _ = w.minimize(); }
            else { let _ = w.show(); let _ = w.set_focus(); }
        }
        None => {}
    }
}

pub fn 建托盘(app: &AppHandle) -> tauri::Result<()> {
    let 名 = app.package_info().name.clone();
    let 头 = MenuItem::with_id(app, "fd-名", 名.as_str(), false, None::<&str>)?;
    let 显示 = MenuItem::with_id(app, "fd-toggle", "显示 / 隐藏", true, None::<&str>)?;
    let 重载 = MenuItem::with_id(app, "fd-reload", "重新载入页面", true, None::<&str>)?;
    let 退出 = MenuItem::with_id(app, "fd-quit", "退出", true, None::<&str>)?;
    let 单 = Menu::with_items(app, &[
        &头, &显示,
        &PredefinedMenuItem::separator(app)?,
        &重载,
        &PredefinedMenuItem::separator(app)?,
        &退出,
    ])?;
    TrayIconBuilder::with_id("fd-tray")
        .icon(托盘图())
        .tooltip(名.as_str())
        .menu(&单)
        /* 主进程那边左键是"露/缩"，右键才开这张单 */
        .show_menu_on_left_click(false)
        .on_menu_event(|app, e| match e.id().as_ref() {
            "fd-toggle" => {
                if let Some(w) = 主窗口(app) {
                    if w.is_visible().unwrap_or(true) { let _ = w.hide(); }
                    else { let _ = w.show(); let _ = w.set_focus(); }
                    报状态(app);
                }
            }
            "fd-reload" => { if let Some(w) = 主窗口(app) { let _ = w.reload(); } }
            "fd-quit" => 收摊(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, e| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = e {
                闪一下(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}
