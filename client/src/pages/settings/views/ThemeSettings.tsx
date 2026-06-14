import { useState, useEffect } from "react";
import { Typography, Switch, Divider, Space, Card } from "@arco-design/web-react";

const { Title, Paragraph, Text } = Typography;

export default function ThemeSettings() {
  const [followSystem, setFollowSystem] = useState(() => {
    return localStorage.getItem("theme_follow_system") === "true";
  });

  const [currentRealTheme, setCurrentRealTheme] = useState(() => {
    return document.body.getAttribute("arco-theme") === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    const handleThemeChange = () => {
      setCurrentRealTheme(document.body.getAttribute("arco-theme") === "dark" ? "dark" : "light");
    };
    window.addEventListener("theme-change", handleThemeChange);
    return () => window.removeEventListener("theme-change", handleThemeChange);
  }, []);

  const handleFollowSystemChange = (checked: boolean) => {
    setFollowSystem(checked);
    localStorage.setItem("theme_follow_system", String(checked));

    if (checked) {
      // 开启跟随系统：立即获取并应用系统主题
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const nextTheme = mediaQuery.matches ? "dark" : "light";
      applyGlobalTheme(nextTheme);
    } else {
      // 关闭跟随系统：恢复使用手动指定的主题
      const savedTheme = localStorage.getItem("theme") || "light";
      applyGlobalTheme(savedTheme);
    }
  };

  const applyGlobalTheme = (mode: string) => {
    if (mode === "dark") {
      document.body.setAttribute("arco-theme", "dark");
      document.body.setAttribute("data-color-mode", "dark");
    } else {
      document.body.removeAttribute("arco-theme");
      document.body.setAttribute("data-color-mode", "light");
    }
    // 派发自定义主题切换事件
    window.dispatchEvent(new Event("theme-change"));
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <Title heading={4}>个性化设计</Title>
      <Paragraph type="secondary">管理你的网站色彩方案与偏好设置。</Paragraph>
      <Divider />

      <Card style={{ marginTop: 24, borderRadius: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>跟随系统颜色模式</div>
            <Paragraph type="secondary" style={{ fontSize: 13, margin: 0, maxWidth: 520 }}>
              开启后，网站将自动同步您浏览器的深浅色显示偏好（浅色模式或暗黑模式），并支持随着系统时间与设定的变化进行实时无缝切换。
            </Paragraph>
          </div>
          <Switch checked={followSystem} onChange={handleFollowSystemChange} />
        </div>
      </Card>

      <div style={{ marginTop: 16, padding: "0 12px" }}>
        <Space size="large">
          <Text type="secondary" style={{ fontSize: 13 }}>
            当前实际渲染主题：
            <Text bold style={{ color: currentRealTheme === "dark" ? "var(--color-primary)" : "#111" }}>
              {currentRealTheme === "dark" ? "暗黑模式 (Dark Mode)" : "浅色模式 (Light Mode)"}
            </Text>
          </Text>
        </Space>
      </div>
    </div>
  );
}
