/* 四层里的第一层 · 挑选文件与挑选目录那一点的纯判断
   这里只有算法：给定那张"上次挑过哪里"的表和一处调用方的 id，算出该从哪一格开、挑完之后该记成哪一格；
   给定页面上递来的 accept 那张表，算出对话框该给的类型筛选。
   认盘上有没有那一格、真开对话框，都在第三层做。 */
use std::collections::HashMap;

/// 探针预置的那串挑选结果：取下一条，取完就是空手（回路的形状照主进程那边 nextPick）
pub fn 下一挑(队列: &mut Vec<Vec<String>>) -> Vec<String> {
    if 队列.is_empty() { Vec::new() } else { 队列.remove(0) }
}

/// 环境变量里那串能不能当队列用：坏串一律当"没设"，绝不让一道对话框因此开不出来
pub fn 读预置(串: &str) -> Vec<Vec<String>> {
    let 空 = Vec::new();
    let 值: serde_json::Value = match serde_json::from_str(串) { Ok(v) => v, Err(_) => return 空 };
    let 列 = match 值.as_array() { Some(a) => a, None => return 空 };
    列.iter().map(|x| match x {
        serde_json::Value::Array(list) => list.iter().filter_map(|i| i.as_str().map(String::from)).collect(),
        serde_json::Value::String(s) => vec![s.clone()],
        _ => vec![],
    }).collect()
}

/// 上次那一处还在不在：不在了就当没记（给对话框一个不存在的目录，它会开到一个说不清的地方）
pub fn 起点(表: &HashMap<String, String>, id: &str, 是目录: &dyn Fn(&str) -> bool) -> String {
    if id.is_empty() { return String::new(); }
    match 表.get(id) {
        Some(p) if !p.is_empty() && 是目录(p) => p.clone(),
        _ => String::new(),
    }
}

/// 挑完该记成哪一格：挑中的是目录就记它自己，是文件就记它上一格
pub fn 归格(挑中: &str, 挑中是目录: bool) -> String {
    if 挑中.is_empty() { return String::new(); }
    if 挑中是目录 { return 挑中.to_string(); }
    let 尾 = 挑中.replace('\\', "/");
    match 尾.rfind('/') {
        Some(i) if i > 0 => 尾[..i].to_string(),
        _ => String::new(),
    }
}

/// 这一处要不要落盘：没 id、没挑中、或者跟已经记着的一样，都不动
pub fn 该记(表: &HashMap<String, String>, id: &str, 目录: &str) -> bool {
    !id.is_empty() && !目录.is_empty() && 表.get(id).map(String::as_str) != Some(目录)
}

/// 类型筛选：页面上递来的是 accept 那张表（键是 MIME，值是一串带点的后缀），
/// 只认带点的那种，去重后合成一条叫「选定类型」的筛选；一个都没挑出来就不给筛选（照主进程那边 toFilters）
pub fn 筛选(接受: &serde_json::Value) -> Vec<(String, Vec<String>)> {
    let 表 = match 接受.as_object() { Some(m) => m, None => return vec![] };
    let mut 后缀: Vec<String> = vec![];
    for 值 in 表.values() {
        let 列 = match 值.as_array() { Some(a) => a, None => continue };
        for x in 列 {
            if let Some(s) = x.as_str().and_then(|s| s.strip_prefix('.')) {
                let 条 = s.to_string();
                if !后缀.contains(&条) { 后缀.push(条); }
            }
        }
    }
    if 后缀.is_empty() { vec![] } else { vec![("选定类型".to_string(), 后缀)] }
}

#[cfg(test)]
mod 验判断 {
    use super::*;

    fn 表(vs: &[(&str, &str)]) -> HashMap<String, String> {
        vs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
    }

    #[test]
    fn 预置队列取完就空() {
        let mut 队 = vec![vec!["甲.txt".to_string()], vec!["乙".to_string(), "丙".to_string()]];
        assert_eq!(下一挑(&mut 队), vec!["甲.txt".to_string()]);
        assert_eq!(下一挑(&mut 队), vec!["乙".to_string(), "丙".to_string()]);
        assert!(下一挑(&mut 队).is_empty());
    }

    #[test]
    fn 预置那串坏的一律当没设() {
        assert!(读预置("").is_empty());
        assert!(读预置("不是JSON").is_empty());
        assert!(读预置("{\"甲\":1}").is_empty());
        assert_eq!(读预置("[\"甲.txt\",[\"乙\",\"丙\"]]"),
            vec![vec!["甲.txt".to_string()], vec!["乙".to_string(), "丙".to_string()]]);
    }

    #[test]
    fn 上次那一处没了就当没记() {
        let m = 表(&[("壁纸", "某处/子层"), ("音乐", "")]);
        let 在 = |p: &str| p == "某处/子层";
        assert_eq!(起点(&m, "壁纸", &在), "某处/子层");
        assert_eq!(起点(&m, "没记过的", &在), "");
        assert_eq!(起点(&m, "音乐", &在), "");
        assert_eq!(起点(&m, "", &在), "");
    }

    #[test]
    fn 挑完归到该记的那一格() {
        assert_eq!(归格("某处/子层/一首歌.mp3", false), "某处/子层");
        assert_eq!(归格("某处\\子层\\一首歌.mp3", false), "某处/子层");
        assert_eq!(归格("某处/那一格", true), "某处/那一格");
        assert_eq!(归格("", false), "");
        /* 挑中的是根上那一档，没有上一格 —— 不记，免得记出一个空串 */
        assert_eq!(归格("/一首歌.mp3", false), "");
    }

    #[test]
    fn 跟已经记着的一样就不落盘() {
        let m = 表(&[("壁纸", "某处/子层")]);
        assert!(!该记(&m, "壁纸", "某处/子层"));
        assert!(该记(&m, "壁纸", "某处/另一格"));
        assert!(!该记(&m, "", "某处"));
        assert!(!该记(&m, "壁纸", ""));
    }

    #[test]
    fn 类型筛选只认带点的后缀且合成一条() {
        let 接受 = serde_json::json!({"image/*": [".png", ".jpg", "不带点的"], "text/plain": [".txt", ".png"]});
        let 出 = 筛选(&接受);
        assert_eq!(出.len(), 1);
        assert_eq!(出[0].0, "选定类型");
        assert_eq!(出[0].1, vec!["png".to_string(), "jpg".to_string(), "txt".to_string()]);
        assert!(筛选(&serde_json::json!({"image/*": ["png"]})).is_empty());
        assert!(筛选(&serde_json::Value::Null).is_empty());
    }
}
