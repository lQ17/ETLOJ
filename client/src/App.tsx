import { useEffect, lazy, Suspense } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Layout, Spin } from "@arco-design/web-react";
import AppHeader from "./components/AppHeader";
import AppFooter from "./components/AppFooter";
import ScrollToTop from "./components/ScrollToTop";
import HomePage from "./pages/home";
import { useAuthStore } from "./stores/auth";

const ProblemListPage = lazy(() => import("./pages/problems"));
const ProblemDetailPage = lazy(() => import("./pages/problems/detail/index"));
const ProblemListsPage = lazy(() => import("./pages/lists"));
const ProblemListDetailPage = lazy(() => import("./pages/lists/detail"));
const AnnouncementsPage = lazy(() => import("./pages/announcements"));
const RankingPage = lazy(() => import("./pages/ranking"));
const LoginPage = lazy(() => import("./pages/login"));
const RegisterPage = lazy(() => import("./pages/register"));
const AdminPage = lazy(() => import("./pages/admin"));
const RecordsPage = lazy(() => import("./pages/records"));
const ProfilePage = lazy(() => import("./pages/profile"));
const SettingsPage = lazy(() => import("./pages/settings"));
const VisualizationPage = lazy(() => import("./pages/visualization"));
const FeedbackPublicPage = lazy(() => import("./pages/feedback/public"));
const FeedbackTokenEntryPage = lazy(() =>
  import("./pages/feedback/public").then((m) => ({ default: m.FeedbackTokenEntryPage })),
);

const { Content } = Layout;

function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user || (user.role !== "ADMIN" && user.role !== "TEACHER")) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function App() {
  const initFromStorage = useAuthStore((s) => s.initFromStorage);
  const loading = useAuthStore((s) => s.loading);
  const location = useLocation();
  const isDetailPage = /^\/problems\/[^/]+/.test(location.pathname);
  const isVisualizationPage = location.pathname === "/visualization";

  useEffect(() => {
    initFromStorage();

    const applyTheme = (mode: string) => {
      if (mode === "dark") {
        document.body.setAttribute("arco-theme", "dark");
        document.body.setAttribute("data-color-mode", "dark");
      } else {
        document.body.removeAttribute("arco-theme");
        document.body.setAttribute("data-color-mode", "light");
      }
      window.dispatchEvent(new Event("theme-change"));
    };

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemThemeChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const followSystem = localStorage.getItem("theme_follow_system") !== "false";
      if (followSystem) {
        applyTheme(e.matches ? "dark" : "light");
      }
    };

    const followSystem = localStorage.getItem("theme_follow_system") !== "false";
    if (followSystem) {
      applyTheme(mediaQuery.matches ? "dark" : "light");
    } else {
      const savedTheme = localStorage.getItem("theme") || "light";
      applyTheme(savedTheme);
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleSystemThemeChange);
    } else {
      mediaQuery.addListener(handleSystemThemeChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleSystemThemeChange);
      } else {
        mediaQuery.removeListener(handleSystemThemeChange);
      }
    };
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spin />
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <ScrollToTop />
      <AppHeader />
      <Content
        className={`page-main-content ${isDetailPage ? "is-detail-page" : ""}`}
        style={{
          maxWidth: isVisualizationPage ? "90%" : (isDetailPage ? "100%" : 1200),
          padding: isDetailPage ? "24px 32px" : "96px 32px",
        }}
      >
        <Suspense fallback={<div style={{ display: "flex", justifyContent: "center", padding: 80 }}><Spin /></div>}>
          <div key={location.pathname} className="page-transition-wrapper">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/problems" element={<ProblemListPage />} />
              <Route path="/problems/:id" element={<ProblemDetailPage />} />
              <Route path="/lists" element={<ProblemListsPage />} />
              <Route path="/lists/:id" element={<ProblemListDetailPage />} />
              <Route path="/records" element={<RecordsPage />} />
              <Route path="/ranking" element={<RankingPage />} />
              <Route path="/visualization" element={<VisualizationPage />} />
              <Route path="/announcements" element={<AnnouncementsPage />} />
              <Route path="/f" element={<FeedbackTokenEntryPage />} />
              <Route path="/f/:token" element={<FeedbackPublicPage />} />
              <Route path="/admin" element={<AdminGuard><AdminPage /></AdminGuard>} />
              <Route path="/profile/:username" element={<ProfilePage />} />
              <Route path="/settings/*" element={<AuthGuard><SettingsPage /></AuthGuard>} />
            </Routes>
          </div>
        </Suspense>
      </Content>
      {!isDetailPage && <AppFooter />}
    </Layout>
  );
}

export default App;
