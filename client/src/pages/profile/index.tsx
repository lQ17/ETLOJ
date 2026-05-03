import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Grid, Card, Typography, Space, Divider, Tabs, Tag, Spin, Empty, Avatar } from "@arco-design/web-react";
import { IconUser, IconCalendar, IconStar, IconThunderbolt } from "@arco-design/web-react/icon";
import ReactECharts from "echarts-for-react";
import { profileApi } from "../../api/profile";
import "./profile.css";

const { Row, Col } = Grid;
const { Title, Text } = Typography;

// ---------- Color palette (cal.com inspired) ----------
const COLORS = {
  ac: "#00b42a",
  wa: "#f53f3f",
  tle: "#ff7d00",
  mle: "#7816ff",
  re: "#0fc6c2",
  ce: "#86909c",
  se: "#c9cdd4",
};

const STATUS_COLOR_MAP: Record<string, string> = {
  AC: COLORS.ac, WA: COLORS.wa, TLE: COLORS.tle,
  MLE: COLORS.mle, RE: COLORS.re, CE: COLORS.ce, SE: COLORS.se,
};

const DIFF_COLOR: Record<string, string> = {
  EASY: "#00b42a", MEDIUM: "#ff7d00", HARD: "#f53f3f",
};
const DIFF_LABEL: Record<string, string> = {
  EASY: "简单", MEDIUM: "中等", HARD: "困难",
};

// ---------- Types ----------
interface ProfileInfo {
  id: number; username: string; avatar?: string; signature?: string;
  role: string; createdAt: string; solvedCount: number; totalSubmissions: number;
}
interface ProfileStats {
  statusDistribution: { name: string; value: number }[];
  heatmapData: [string, number][];
  radarData: Record<string, number>;
  acProblems: { problem_id: number; slug: string; title: string; difficulty: string }[];
  attemptedProblems: { problem_id: number; slug: string; title: string; difficulty: string }[];
}

// ===================== Component =====================
export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    Promise.all([
      profileApi.getProfile(username),
      profileApi.getStats(username),
    ]).then(([p, s]: any) => {
      setProfile(p);
      setStats(s);
    }).catch(() => {
      setProfile(null);
      setStats(null);
    }).finally(() => setLoading(false));
  }, [username]);

  if (loading) return <div className="profile-loading"><Spin size={40} /></div>;
  if (!profile) return <div className="profile-loading"><Empty description="用户不存在" /></div>;

  return (
    <div className="profile-page">
      <Row gutter={24}>
        {/* ====== 左侧：用户名片 ====== */}
        <Col xs={24} md={7} lg={6}>
          <Card bordered={false} className="profile-card user-card">
            <div className="user-card-inner">
              <Avatar size={96} className="user-avatar" triggerIcon={null}>
                {profile.avatar
                  ? <img src={profile.avatar} alt="avatar" />
                  : <IconUser style={{ fontSize: 48 }} />
                }
              </Avatar>
              <Title heading={5} className="user-name">{profile.username}</Title>
              <Text type="secondary" className="user-handle">@{profile.username}</Text>

              <Divider className="user-divider" />

              <Space direction="vertical" className="user-meta" size={8}>
                <div className="meta-row">
                  <IconCalendar className="meta-icon" />
                  <Text type="secondary">注册于 {new Date(profile.createdAt).toLocaleDateString("zh-CN")}</Text>
                </div>
                <div className="meta-row">
                  <IconStar className="meta-icon" />
                  <Text type="secondary">{profile.signature || "这个人很懒，什么都没写~"}</Text>
                </div>
              </Space>

              <Divider className="user-divider" />

              <Row className="stat-row">
                <Col span={12} className="stat-cell">
                  <div className="stat-value">{profile.solvedCount}</div>
                  <div className="stat-label">已解题数</div>
                </Col>
                <Col span={12} className="stat-cell">
                  <div className="stat-value">{profile.totalSubmissions}</div>
                  <div className="stat-label">总提交数</div>
                </Col>
              </Row>
            </div>
          </Card>
        </Col>

        {/* ====== 右侧：图表面板 ====== */}
        <Col xs={24} md={17} lg={18}>
          <Space direction="vertical" size={20} style={{ width: "100%" }}>

            {/* ---- 热力图 ---- */}
            <Card bordered={false} className="profile-card">
              <Title heading={6} className="card-title">
                <IconThunderbolt style={{ marginRight: 8 }} />活跃度
              </Title>
              <HeatmapChart data={stats?.heatmapData || []} />
            </Card>

            {/* ---- 饼图 + 雷达图 ---- */}
            <Row gutter={20}>
              <Col xs={24} lg={12}>
                <Card bordered={false} className="profile-card">
                  <Title heading={6} className="card-title">提交统计</Title>
                  <PieChart data={stats?.statusDistribution || []} />
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card bordered={false} className="profile-card">
                  <Title heading={6} className="card-title">能力雷达</Title>
                  <RadarChart data={stats?.radarData || { EASY: 0, MEDIUM: 0, HARD: 0 }} />
                </Card>
              </Col>
            </Row>

            {/* ---- 题目墙 ---- */}
            <Card bordered={false} className="profile-card">
              <Tabs defaultActiveTab="ac" type="capsule">
                <Tabs.TabPane key="ac" title={`已通过 (${stats?.acProblems?.length || 0})`}>
                  <ProblemWall problems={stats?.acProblems || []} />
                </Tabs.TabPane>
                <Tabs.TabPane key="attempted" title={`尝试过 (${stats?.attemptedProblems?.length || 0})`}>
                  <ProblemWall problems={stats?.attemptedProblems || []} />
                </Tabs.TabPane>
              </Tabs>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
}

// ===================== Sub-components =====================

/** 热力图 */
function HeatmapChart({ data }: { data: [string, number][] }) {
  const now = new Date();
  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const rangeStart = yearAgo.toISOString().slice(0, 10);
  const rangeEnd = now.toISOString().slice(0, 10);

  // Format heatmap date strings
  const formatted = data.map(([d, v]) => {
    const ds = typeof d === "string" ? d : new Date(d).toISOString().slice(0, 10);
    return [ds, v];
  });

  const option = {
    tooltip: { formatter: (p: any) => `${p.value[0]}<br/>提交: <b>${p.value[1]}</b>` },
    visualMap: {
      min: 0, max: Math.max(10, ...formatted.map((d: any) => d[1])),
      show: false,
      inRange: { color: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"] },
    },
    calendar: {
      range: [rangeStart, rangeEnd],
      cellSize: [14, 14],
      splitLine: { show: false },
      itemStyle: { borderWidth: 3, borderColor: "transparent", borderRadius: 2 },
      dayLabel: { nameMap: "ZH", color: "#86909c", fontSize: 10 },
      monthLabel: { nameMap: "ZH", color: "#86909c", fontSize: 10 },
      yearLabel: { show: false },
      left: 40, right: 10, top: 20, bottom: 10,
    },
    series: [{
      type: "heatmap",
      coordinateSystem: "calendar",
      data: formatted,
    }],
  };

  return <ReactECharts option={option} style={{ height: 160 }} />;
}

/** 提交状态饼图 */
function PieChart({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const option = {
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { bottom: 0, textStyle: { color: "#86909c" }, itemWidth: 12, itemHeight: 12 },
    series: [{
      type: "pie",
      radius: ["45%", "70%"],
      center: ["50%", "42%"],
      avoidLabelOverlap: false,
      label: {
        show: true, position: "center", fontSize: 22, fontWeight: 700,
        formatter: () => `${total}`,
        color: "var(--color-text-1)",
      },
      emphasis: { label: { show: true, fontSize: 14, formatter: "{b}\n{c}" } },
      itemStyle: { borderRadius: 6, borderColor: "var(--color-bg-2)", borderWidth: 2 },
      data: data.map((d) => ({
        ...d,
        itemStyle: { color: STATUS_COLOR_MAP[d.name] || "#86909c" },
      })),
    }],
  };

  if (!data.length) return <Empty description="暂无提交记录" style={{ padding: 40 }} />;
  return <ReactECharts option={option} style={{ height: 280 }} />;
}

/** 能力雷达图 */
function RadarChart({ data }: { data: Record<string, number> }) {
  const maxVal = Math.max(1, data.EASY, data.MEDIUM, data.HARD);
  const option = {
    radar: {
      indicator: [
        { name: `简单 (${data.EASY})`, max: maxVal },
        { name: `中等 (${data.MEDIUM})`, max: maxVal },
        { name: `困难 (${data.HARD})`, max: maxVal },
      ],
      shape: "circle",
      splitNumber: 4,
      axisName: { color: "#86909c", fontSize: 12 },
      splitLine: { lineStyle: { color: "rgba(134,144,156,0.15)" } },
      splitArea: { areaStyle: { color: ["rgba(134,144,156,0.03)", "rgba(134,144,156,0.06)"] } },
      axisLine: { lineStyle: { color: "rgba(134,144,156,0.15)" } },
    },
    series: [{
      type: "radar",
      data: [{ value: [data.EASY, data.MEDIUM, data.HARD] }],
      areaStyle: { color: "rgba(22,93,255,0.15)" },
      lineStyle: { color: "#165dff", width: 2 },
      itemStyle: { color: "#165dff" },
      symbol: "circle", symbolSize: 6,
    }],
  };

  return <ReactECharts option={option} style={{ height: 280 }} />;
}

/** 题目墙 */
function ProblemWall({ problems }: { problems: { problem_id: number; slug: string; title: string; difficulty: string }[] }) {
  if (!problems.length) return <Empty description="暂无数据" style={{ padding: 32 }} />;

  return (
    <div className="problem-wall">
      {problems.map((p) => (
        <Link
          key={p.problem_id}
          to={`/problems/${p.slug}`}
          className="problem-tag"
          style={{ borderLeftColor: DIFF_COLOR[p.difficulty] || "#86909c" }}
        >
          <Tag size="small" color={DIFF_COLOR[p.difficulty] === "#00b42a" ? "green" : DIFF_COLOR[p.difficulty] === "#ff7d00" ? "orange" : "red"}>
            {DIFF_LABEL[p.difficulty] || p.difficulty}
          </Tag>
          <span className="problem-tag-title">{p.title}</span>
        </Link>
      ))}
    </div>
  );
}
