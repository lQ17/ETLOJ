import { useEffect } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Layout, Spin } from "@arco-design/web-react";
import AppHeader from "./components/AppHeader";
import AppFooter from "./components/AppFooter";
import ScrollToTop from "./components/ScrollToTop";
import HomePage from "./pages/home";
import ProblemListPage from "./pages/problems";
import ProblemDetailPage from "./pages/problems/detail/index";
import ProblemListsPage from "./pages/lists";
import ProblemListDetailPage from "./pages/lists/detail";
import AnnouncementsPage from "./pages/announcements";
import RankingPage from "./pages/ranking";
import LoginPage from "./pages/login";
import AdminPage from "./pages/admin";
import RecordsPage from "./pages/records";
import ProfilePage from "./pages/profile";
import SettingsPage from "./pages/settings";
import VisualizationPage from "./pages/visualization";
import { useAuthStore } from "./stores/auth";

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

  useEffect(() => {
    initFromStorage();
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
        style={{
          maxWidth: isDetailPage ? "100%" : 1200,
          margin: "0 auto",
          padding: isDetailPage ? "24px 32px" : "96px 32px",
          width: "100%",
        }}
      >
        <div key={location.pathname} className="page-transition-wrapper">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/problems" element={<ProblemListPage />} />
            <Route path="/problems/:id" element={<ProblemDetailPage />} />
            <Route path="/lists" element={<ProblemListsPage />} />
            <Route path="/lists/:id" element={<ProblemListDetailPage />} />
            <Route path="/records" element={<RecordsPage />} />
            <Route path="/ranking" element={<RankingPage />} />
            <Route path="/visualization" element={<VisualizationPage />} />
            <Route path="/announcements" element={<AnnouncementsPage />} />
            <Route path="/admin" element={<AdminGuard><AdminPage /></AdminGuard>} />
            <Route path="/profile/:username" element={<ProfilePage />} />
            <Route path="/settings/*" element={<AuthGuard><SettingsPage /></AuthGuard>} />
          </Routes>
        </div>
      </Content>
      {!isDetailPage && <AppFooter />}
    </Layout>
  );
}

export default App;
