import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Grid, Card, Typography, Space, Divider, Tabs, Tag, Spin, Empty, Avatar } from "@arco-design/web-react";
import { IconUser, IconCalendar, IconStar, IconThunderbolt } from "@arco-design/web-react/icon";
import * as echarts from "echarts";
import ReactECharts from "echarts-for-react";
import { profileApi } from "../../api/profile";
import "echarts-wordcloud";
import "./profile.css";

const { Row, Col } = Grid;
const { Title, Text } = Typography;

// ---------- Color palette (cal.com inspired) ----------
const COLORS = {
  ac: "#00b42a",
  wa: "#f53f3f",
  tle: "#ff7d00",
  mle: "#7816ff",
  re: "#b37feb", // 淡紫色
  ce: "#ffb470", // 淡橙色
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
  wordCloudData: { name: string; value: number }[];
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
            <Row gutter={16} style={{ display: 'flex', alignItems: 'stretch' }}>
              <Col xs={24} lg={12} style={{ display: 'flex', marginBottom: 16 }}>
                <Card bordered={false} className="profile-card" style={{ width: '100%', height: '100%' }}>
                  <Title heading={6} className="card-title">提交统计</Title>
                  <div style={{ width: '100%' }}>
                    <PieChart data={stats?.statusDistribution || []} />
                  </div>
                </Card>
              </Col>
              <Col xs={24} lg={12} style={{ display: 'flex', marginBottom: 16 }}>
                <Card bordered={false} className="profile-card" style={{ width: '100%', height: '100%' }}>
                  <Title heading={6} className="card-title">能力词云</Title>
                  <div style={{ width: '100%' }}>
                    <WordCloudChart data={stats?.wordCloudData || []} />
                  </div>
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

import { GitHubCalendar } from "react-github-calendar";

import { Tooltip } from "@arco-design/web-react";

/** 热力图 (使用 react-github-calendar 库) */
function HeatmapChart({ data }: { data: [string, number][] }) {
  const now = new Date();
  
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(now.getMonth() - 6);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(now.getMonth() - 1);
  oneMonthAgo.setHours(0, 0, 0, 0);

  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(now.getDate() - 7);
  oneWeekAgo.setHours(0, 0, 0, 0);

  // 统计不同时间段的提交总数
  let sum6Months = 0;
  let sum1Month = 0;
  let sum1Week = 0;

  // 将传入的数据转为 Map 方便查询
  const dateMap = new Map();
  data.forEach(([d, v]) => {
    const ds = typeof d === "string" ? d : (new Date(new Date(d).getTime() - new Date(d).getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
    dateMap.set(ds, v);
    
    // 累加统计
    // d 是字符串 YYYY-MM-DD，这里在构造 Date 时如果用 YYYY-MM-DD 会被当成 UTC 零点，导致判断时区偏移。
    // 改为手动解析年、月、日构造本地时间的 Date，或者简单字符串比较。为了简单，我们将它转为本地的开始时间
    const [year, month, day] = ds.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    if (dateObj >= sixMonthsAgo && dateObj <= now) sum6Months += v;
    if (dateObj >= oneMonthAgo && dateObj <= now) sum1Month += v;
    if (dateObj >= oneWeekAgo && dateObj <= now) sum1Week += v;
  });

  // 必须生成指定时间段的全量数据，否则库无法正确推断出日历的起始时间
  const calendarData: Array<{ date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }> = [];
  const tempDate = new Date(sixMonthsAgo);
  tempDate.setHours(0, 0, 0, 0);
  
  while (tempDate <= now) {
    const y = tempDate.getFullYear();
    const m = String(tempDate.getMonth() + 1).padStart(2, '0');
    const d = String(tempDate.getDate()).padStart(2, '0');
    const ds = `${y}-${m}-${d}`;
    const v = dateMap.get(ds) || 0;
    
    // 计算 level (0-4)
    let level = 0;
    if (v > 0 && v <= 2) level = 1;
    else if (v > 2 && v <= 5) level = 2;
    else if (v > 5 && v <= 9) level = 3;
    else if (v > 9) level = 4;

    calendarData.push({
      date: ds,
      count: v,
      level: level as 0 | 1 | 2 | 3 | 4,
    });
    
    tempDate.setDate(tempDate.getDate() + 1);
  }

  return (
    <div className="gh-calendar-container" style={{ display: 'flex', alignItems: 'center', paddingTop: '10px' }}>
      {/* 左侧热力图主体 */}
      <div style={{ flex: 1, overflowX: 'auto' }}>
        <GitHubCalendar
          data={calendarData}
          showWeekdayLabels
          blockSize={15}
          blockMargin={5}
          blockRadius={3}
          labels={{
            months: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
            weekdays: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
            totalCount: "此处仅统计初次通过的题目记录",
            legend: {
              less: "少",
              more: "多",
            },
          }}
          theme={{
            light: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
            dark: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
          }}
          renderBlock={(block, activity) => {
            const [y, m, d] = activity.date.split("-");
            const dateStr = `${y}年${parseInt(m)}月${parseInt(d)}日`;
            const tooltipContent = (
              <div style={{ textAlign: "center", padding: "4px 2px" }}>
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>{dateStr}</div>
                <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "12px" }}>
                  {activity.count > 0 ? `通过了 ${activity.count} 道题` : "无通过记录"}
                </div>
              </div>
            );

            return (
              <Tooltip key={activity.date} content={tooltipContent} position="top" trigger="hover" style={{ backgroundColor: '#24292e' }}>
                {block}
              </Tooltip>
            );
          }}
        />
      </div>

      {/* 右侧统计信息 */}
      <div style={{ width: '180px', marginLeft: '32px', borderLeft: '1px solid var(--color-border-2)', paddingLeft: '24px' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Text type="secondary" style={{ fontSize: 13 }}>最近半年通过了</Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--color-text-1)', marginTop: 4 }}>
              {sum6Months} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--color-text-3)' }}>道题</span>
            </div>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 13 }}>最近一个月通过了</Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--color-text-1)', marginTop: 4 }}>
              {sum1Month} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--color-text-3)' }}>道题</span>
            </div>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 13 }}>最近一周通过了</Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--color-text-1)', marginTop: 4 }}>
              {sum1Week} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--color-text-3)' }}>道题</span>
            </div>
          </div>
        </Space>
      </div>
    </div>
  );
}

/** 提交状态饼图 */
function PieChart({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const option = {
    title: {
      text: `总提交数\n${total}`,
      left: 'center',
      top: '42%',
      textBaseline: 'middle',
      textAlign: 'center',
      textStyle: { fontSize: 14, color: 'var(--color-text-2)', lineHeight: 22, fontWeight: 500 },
    },
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { bottom: 0, textStyle: { color: "#86909c" }, itemWidth: 12, itemHeight: 12 },
    series: [{
      type: "pie",
      radius: ["45%", "70%"],
      center: ["50%", "42%"],
      avoidLabelOverlap: false,
      label: { show: false },
      emphasis: { scale: true, label: { show: false } },
      itemStyle: { borderRadius: 6 },
      data: data.map((d) => ({
        ...d,
        itemStyle: { color: STATUS_COLOR_MAP[d.name] || "#86909c" },
      })),
    }],
  };

  if (!data.length) return <Empty description="暂无提交记录" style={{ padding: 40 }} />;
  return <ReactECharts option={option} style={{ height: 280, width: '100%' }} />;
}

/** 词云图 */
function WordCloudChart({ data }: { data: { name: string; value: number }[] }) {
  if (!data || data.length === 0) return <Empty description="暂无标签数据" style={{ padding: 40 }} />;

  const option = {
    tooltip: { show: true },
    series: [{
      type: 'wordCloud',
      shape: 'circle',
      keepAspect: false,
      left: 'center',
      top: 'center',
      width: '90%',
      height: '90%',
      sizeRange: [12, 40],
      rotationRange: [-90, 90],
      rotationStep: 45,
      gridSize: 8,
      drawOutOfBound: false,
      textStyle: {
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
        color: function () {
          const palette = ['#165dff', '#0fc6c2', '#00b42a', '#ff7d00', '#f53f3f', '#7816ff', '#b37feb', '#ffb470'];
          return palette[Math.floor(Math.random() * palette.length)];
        }
      },
      emphasis: { focus: 'self', textStyle: { shadowBlur: 10, shadowColor: '#333' } },
      data: data
    }]
  };

  return <ReactECharts option={option} style={{ height: 280, width: '100%' }} />;
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
