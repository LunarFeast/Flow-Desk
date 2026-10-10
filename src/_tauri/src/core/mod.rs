
/* 四层里的第一层：纯业务。
   这一层不碰磁盘、不碰壳、不碰 WebView —— 只做“该不该、是多少、叫什么名字”这类判断，
   拿 cargo test 就能验，不用起壳。动磁盘的那些全在 tauri_bind 那一层。 */
pub mod fs_policy;
pub mod pick_policy;
pub mod win_policy;
