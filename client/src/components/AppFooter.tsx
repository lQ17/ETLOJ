import { IconCode } from '@arco-design/web-react/icon';
import { useNavigate } from 'react-router-dom';

export default function AppFooter() {
  const navigate = useNavigate();
  return (
    <footer className="footer">
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }}>
            <div className="footer-grid">
                <div className="footer-col">
                    <div
                      style={{ color: "var(--color-on-dark)", marginBottom: 24, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                      onClick={() => navigate("/")}
                    >
                        <div style={{ width: 24, height: 24, background: "var(--color-on-dark)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <IconCode style={{ fontSize: 16, color: "var(--color-surface-dark)" }} />
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 18, letterSpacing: "-0.02em" }}>ETLOJ</span>
                    </div>
                    <p  style={{ fontSize: 14, color: "var(--color-on-dark-soft)", lineHeight: 1 }}>
                        ETLOJ 专注于 <strong>Easy To Learn（易于学习）</strong> 体验。
                    </p>
                    <p style={{ fontSize: 14, color: "var(--color-on-dark-soft)", lineHeight: 3 }}>
                        与其硬啃代码，不如让AI陪你一步步想通算法。
                    </p>
                </div>
                <div className="footer-col">
                    <h4>产品</h4>
                    <ul className="footer-links">
                        <li><a href="#" onClick={(e) => { e.preventDefault(); navigate("/problems"); }}>题库中心</a></li>
                        <li><a href="#" onClick={(e) => { e.preventDefault(); navigate("/lists"); }}>题单系统</a></li>
                        <li><a href="#" onClick={(e) => { e.preventDefault(); navigate("/records"); }}>评测记录</a></li>
                        <li><a href="#" onClick={(e) => { e.preventDefault(); navigate("/ranking"); }}>竞赛排名</a></li>
                    </ul>
                </div>
                <div className="footer-col">
                    <h4>资源</h4>
                    <ul className="footer-links">
                        <li><a href="#" onClick={(e) => { e.preventDefault(); navigate("/visualization"); }}>算法可视化</a></li>
                        <li><a href="#" onClick={(e) => { e.preventDefault(); navigate("/announcements"); }}>平台公告</a></li>
                    </ul>
                </div>
                <div className="footer-col">
                    <h4>关于</h4>
                    <ul className="footer-links">
                        <li><a href="mailto:qingx.yang@outlook.com">联系我们</a></li>
                    </ul>
                </div>
                <div className="footer-col">
                    <h4>友情链接</h4>
                    <ul className="footer-links">
                        <li><a href="https://codeforces.com/" target="_blank" rel="noopener noreferrer">Codeforces</a></li>
                        <li><a href="https://www.luogu.com.cn/" target="_blank" rel="noopener noreferrer">洛谷</a></li>
                        <li><a href="https://oi-wiki.org/" target="_blank" rel="noopener noreferrer">OI Wiki</a></li>
                        <li><a href="https://zh.cppreference.com/" target="_blank" rel="noopener noreferrer">cppreference</a></li>
                    </ul>
                </div>
            </div>
            <div className="footer-bottom">
                <div>© 2026 ETLOJ. All rights reserved.</div>
                <div>
                    <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-on-dark-soft)", textDecoration: "none" }}>
                        豫ICP备2026023742号-1
                    </a>
                </div>
            </div>
        </div>
    </footer>
  );
}
