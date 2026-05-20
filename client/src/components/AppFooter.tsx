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
                    <p style={{ fontSize: 14, color: "var(--color-on-dark-soft)", maxWidth: 200, lineHeight: 1.6 }}>
                        为下一代竞赛者打造的算法学习与竞技平台。
                    </p>
                </div>
                <div className="footer-col">
                    <h4>产品</h4>
                    <ul className="footer-links">
                        <li><a href="#" onClick={(e) => { e.preventDefault(); navigate("/problems"); }}>题库中心</a></li>
                        <li><a href="#" onClick={(e) => { e.preventDefault(); navigate("/records"); }}>评测系统</a></li>
                        <li><a href="#" onClick={(e) => { e.preventDefault(); navigate("/ranking"); }}>竞赛大厅</a></li>
                        <li><a href="#">企业服务</a></li>
                    </ul>
                </div>
                <div className="footer-col">
                    <h4>资源</h4>
                    <ul className="footer-links">
                        <li><a href="#">算法文档</a></li>
                        <li><a href="#">社区讨论</a></li>
                        <li><a href="#">API 参考</a></li>
                        <li><a href="#">开源贡献</a></li>
                    </ul>
                </div>
                <div className="footer-col">
                    <h4>关于</h4>
                    <ul className="footer-links">
                        <li><a href="#">关于我们</a></li>
                        <li><a href="#">联系支持</a></li>
                        <li><a href="#">隐私政策</a></li>
                        <li><a href="#">服务条款</a></li>
                    </ul>
                </div>
            </div>
            <div className="footer-bottom">
                <div>© 2026 ETLOJ. All rights reserved.</div>
            </div>
        </div>
    </footer>
  );
}
