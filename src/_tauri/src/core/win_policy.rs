/* 四层里的第一层 · 窗口那一点的纯判断
   这里只有算法：给一个当前缩放和一个动作，回该设成多少。不动窗口、不认识壳。
   档位照主进程那套：一格 0.1，最大 2 倍，最小 0.5 倍，重置回 1；
   主进程那边用 +(x).toFixed(2) 收两位小数，这边同一收法，免得两头对不齐。 */

/// 缩放档位：动作只有 zoomIn / zoomOut / zoomReset 三种，别的动作不当回事（原样回）
pub fn zoom_step(当前: f64, 动作: &str) -> f64 {
    let 起点 = if 当前.is_finite() { 当前 } else { 1.0 };
    let 下一格 = match 动作 {
        "zoomIn" => 起点 + 0.1,
        "zoomOut" => 起点 - 0.1,
        "zoomReset" => 1.0,
        _ => return 收两位(起点.clamp(0.5, 2.0)),
    };
    收两位(下一格.clamp(0.5, 2.0))
}

fn 收两位(x: f64) -> f64 {
    (x * 100.0).round() / 100.0
}

#[cfg(test)]
mod 验判断 {
    use super::*;

    #[test]
    fn 缩放一格一成与两头夹住() {
        assert_eq!(zoom_step(1.0, "zoomIn"), 1.1);
        assert_eq!(zoom_step(1.1, "zoomOut"), 1.0);
        assert_eq!(zoom_step(1.4, "zoomReset"), 1.0);
        assert_eq!(zoom_step(2.0, "zoomIn"), 2.0);
        assert_eq!(zoom_step(0.5, "zoomOut"), 0.5);
    }

    #[test]
    fn 缩放不吃小数噪音() {
        /* 0.7 - 0.1 在浮点里是 0.5999999999999999，收两位才跟主进程那边一致 */
        assert_eq!(zoom_step(0.7, "zoomOut"), 0.6);
        assert_eq!(zoom_step(1.2000000000000002, "zoomIn"), 1.3);
        /* 下沿就是 0.5：再往下一格也只到 0.5，这一条主进程那边是 Math.max(.5, z-.1) */
        assert_eq!(zoom_step(0.30000000000000004, "zoomOut"), 0.5);
    }

    #[test]
    fn 缩放遇到不是数的东西退回一倍() {
        assert_eq!(zoom_step(f64::NAN, "zoomIn"), 1.1);
        assert_eq!(zoom_step(f64::INFINITY, "zoomReset"), 1.0);
        assert_eq!(zoom_step(1.0, "state"), 1.0);
    }
}
