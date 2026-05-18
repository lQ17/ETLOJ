import { useState, useEffect, useCallback } from "react";
import {
  Typography, Radio, Space, DatePicker, Table, Avatar, Message, Card, Button,
} from "@arco-design/web-react";
import { IconUser } from "@arco-design/web-react/icon";
import ReactECharts from "echarts-for-react";
import { useNavigate } from "react-router-dom";
import { rankingApi } from "../../api/ranking";
import { useAuthStore } from "../../stores/auth";

const { RangePicker } = DatePicker;

// HTML 实体转义，防止 XSS
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const MODE_OPTIONS = [
  { label: "按AC数量", value: "ac" },
  { label: "按累计分数", value: "score" },
];

const RANGE_OPTIONS = [
  { label: "全部时间", value: "all" },
  { label: "近半年", value: "6m" },
  { label: "近一月", value: "1m" },
  { label: "近一周", value: "1w" },
  { label: "昨天", value: "yesterday" },
  { label: "今天", value: "today" },
  { label: "自定义", value: "custom" },
];

interface RankItem {
  id: number;
  username: string;
  avatar?: string;
  value: number;
}

export default function RankingPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);

  const [mode, setMode] = useState<"ac" | "score">("ac");
  const [range, setRange] = useState("all");
  const [customDates, setCustomDates] = useState<[string, string] | null>(null);
  const [data, setData] = useState<RankItem[]>([]);
  const [top10, setTop10] = useState<RankItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (p = page, ps = pageSize, fetchTop = false) => {
    setLoading(true);
    try {
      const params: any = { mode, range, page: p, pageSize: ps };
      if (range === "custom" && customDates) {
        params.startDate = customDates[0];
        if (customDates[1]) params.endDate = customDates[1];
      }
      const res: any = await rankingApi.getRanking(params);
      setData(res.items || []);
      setTotal(res.total || 0);
      // 第一页时更新 top10；或切换模式/范围时强制刷新 top10
      if (p === 1 || fetchTop) {
        setTop10((res.items || []).slice(0, 10));
      }
    } catch {
      Message.error("加载排名失败");
    } finally {
      setLoading(false);
    }
  }, [mode, range, customDates, page, pageSize]);

  // 当 mode / range / customDates 变化时，重置到第一页并拉取数据
  useEffect(() => {
    if (!user) return;
    setPage(1);
    fetchData(1, pageSize, true);
  }, [mode, range, customDates, user]);

  // 日期选择回调
  const handleRangeChange = (val: string) => {
    setRange(val);
    if (val !== "custom") {
      setCustomDates(null);
    }
  };

  const handleCustomDateChange = (dateStrings: string[], _date: any[]) => {
    if (dateStrings[0]) {
      setCustomDates([dateStrings[0], dateStrings[1] || ""]);
    } else {
      setCustomDates(null);
    }
  };

  // ========== ECharts 配置 ==========
  const barColors = ["#ff6b6b", "#ffa94d", "#ffd43b", "#69db7c", "#69db7c",
    "#69db7c", "#69db7c", "#69db7c", "#69db7c", "#69db7c"];

  const chartOption = {
    tooltip: {
      trigger: "axis" as const,
      formatter: (params: any) => {
        const p = params[0];
        if (!p) return "";
        const user = top10[p.dataIndex];
        if (!user) return "";
        const suffix = mode === "ac" ? " 题" : " 分";
        return `<b>${escapeHtml(user.username)}</b><br/>${mode === "ac" ? "AC数" : "累计分数"}: ${user.value}${suffix}`;
      },
    },
    grid: { left: 60, right: 30, top: 30, bottom: 30 },
    xAxis: {
      type: "category",
      data: top10.map((item) => {
        const name = item.username || "";
        return name.length > 6 ? name.slice(0, 6) + "..." : name;
      }),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#e5e6eb" } },
      axisLabel: { color: "#86909c", fontSize: 12 },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      splitLine: { lineStyle: { color: "#f2f3f5" } },
      axisLabel: { color: "#86909c" },
    },
    series: [{
      type: "bar",
      data: top10.map((item, i) => ({
        value: item.value,
        itemStyle: {
          color: barColors[i] || "#69db7c",
          borderRadius: [4, 4, 0, 0],
        },
      })),
      barWidth: "50%",
      label: {
        show: true,
        position: "top",
        formatter: (params: any) => {
          const user = top10[params.dataIndex];
          return user ? `${user.value}` : "";
        },
        fontSize: 14,
        fontWeight: "bold",
        color: "#1d2129",
      },
    }],
  };

  // ========== 表格列定义 ==========
  const columns = [
    {
      title: "排名",
      width: 80,
      render: (_: any, __: any, index: number) => {
        const rank = (page - 1) * pageSize + index + 1;
        let color = "";
        if (rank === 1) color = "#ff6b6b";
        else if (rank === 2) color = "#ffa94d";
        else if (rank === 3) color = "#ffd43b";
        return (
          <span style={{ fontWeight: 600, color: color || "var(--color-text-2)" }}>
            {rank}
          </span>
        );
      },
    },
    {
      title: "用户名",
      dataIndex: "username",
      render: (username: string, record: RankItem) => (
        <Space size={8}>
          <Avatar size={28} shape="circle" style={{ backgroundColor: "var(--color-primary)", flexShrink: 0 }}>
            {record.avatar
              ? <img src={record.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : (username?.[0]?.toUpperCase() || <IconUser />)
            }
          </Avatar>
          <Typography.Text
            style={{ cursor: "pointer", color: "var(--color-primary)" }}
            onClick={() => navigate(`/profile/${username}`)}
          >
            {username}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: mode === "ac" ? "AC数" : "累计分数",
      dataIndex: "value",
      width: 120,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
  ];

  if (!authLoading && !user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <div style={{ textAlign: "center" }}>
          <Typography.Title heading={4} style={{ marginBottom: 8 }}>排名</Typography.Title>
          <Typography.Paragraph style={{ color: "var(--color-muted)", marginBottom: 24 }}>
            登录后即可查看排名
          </Typography.Paragraph>
          <Button type="primary" size="large" onClick={() => navigate("/login")}>
            去登录
          </Button>
        </div>
      </div>
    );
  }

  // ========== 渲染 ==========
  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <Typography.Title heading={4} style={{ marginBottom: 20 }}>排名</Typography.Title>

      {/* 筛选区域 */}
      <Card bordered={false} style={{ marginBottom: 20 }}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Space size={16} wrap>
            <span style={{ color: "var(--color-text-3)", fontSize: 13 }}>排名模式：</span>
            <Radio.Group
              type="button"
              value={mode}
              onChange={(val) => setMode(val as "ac" | "score")}
              options={MODE_OPTIONS}
            />
          </Space>

          <Space size={16} wrap align="center">
            <span style={{ color: "var(--color-text-3)", fontSize: 13 }}>时间范围：</span>
            <Radio.Group
              type="button"
              value={range}
              onChange={handleRangeChange}
              options={RANGE_OPTIONS}
            />
            {range === "custom" && (
              <RangePicker
                style={{ width: 260 }}
                onChange={handleCustomDateChange}
                placeholder={["开始日期", "结束日期"]}
              />
            )}
          </Space>
        </Space>
      </Card>

      {/* Top 10 柱状图 */}
      {top10.length > 0 && (
        <Card bordered={false} style={{ marginBottom: 20 }}>
          <Typography.Title heading={6} style={{ marginBottom: 12 }}>
            Top 10 {mode === "ac" ? "(AC数)" : "(累计分数)"}
          </Typography.Title>
          <ReactECharts option={chartOption} style={{ height: 260 }} />
        </Card>
      )}

      {/* 排名表格 */}
      <Card bordered={false}>
        <Table
          columns={columns}
          data={data}
          loading={loading}
          rowKey="id"
          pagination={{
            current: page,
            pageSize,
            total,
            showTotal: true,
            showJumper: true,
            sizeCanChange: true,
            sizeOptions: [10, 20, 50],
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
              fetchData(p, ps);
            },
          }}
        />
      </Card>
    </div>
  );
}
