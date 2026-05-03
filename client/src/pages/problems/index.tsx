import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table, Tag, Input, Select, Space, Typography, Button,
} from "@arco-design/web-react";
import { problemApi } from "../../api/problem";

const difficultyColor: Record<string, string> = {
  EASY: "green",
  MEDIUM: "orange",
  HARD: "red",
};
const difficultyLabel: Record<string, string> = {
  EASY: "简单",
  MEDIUM: "中等",
  HARD: "困难",
};

export default function ProblemListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [difficulty, setDifficulty] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const fetchData = async (p = page) => {
    setLoading(true);
    try {
      const res: any = await problemApi.list({
        page: p,
        pageSize: 20,
        keyword: keyword || undefined,
        difficulty: difficulty || undefined,
      });
      setData(res.items);
      setTotal(res.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1);
    setPage(1);
  }, [keyword, difficulty]);

  const columns = [
    {
      title: "题号",
      dataIndex: "slug",
      width: 120,
      render: (slug: string) => <span style={{ fontFamily: "monospace" }}>{slug}</span>,
    },
    {
      title: "标题",
      dataIndex: "title",
      render: (title: string, record: any) => (
        <Typography.Text
          style={{ cursor: "pointer", color: "rgb(var(--primary-6))" }}
          onClick={() => navigate(`/problems/${record.id}`)}
        >
          {title}
        </Typography.Text>
      ),
    },
    {
      title: "难度",
      dataIndex: "difficulty",
      width: 100,
      render: (d: string) => <Tag color={difficultyColor[d]}>{difficultyLabel[d]}</Tag>,
    },
    {
      title: "通过率",
      width: 100,
      render: (_: any, record: any) => {
        const total = record.totalSubmissions || 0;
        const ac = record.acceptedCount || 0;
        return total > 0 ? `${Math.round((ac / total) * 100)}%` : "-";
      },
    },
    {
      title: "提交数",
      dataIndex: "totalSubmissions",
      width: 80,
    },
    {
      title: "标签",
      dataIndex: "tags",
      render: (tags: string[]) =>
        Array.isArray(tags)
          ? tags.map((t) => <Tag key={t} style={{ marginRight: 4 }}>{t}</Tag>)
          : null,
    },
  ];

  return (
    <div>
      <Typography.Title heading={4}>题库</Typography.Title>
      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="搜索题号或标题"
          allowClear
          style={{ width: 240 }}
          onSearch={(v) => setKeyword(v)}
        />
        <Select
          placeholder="难度筛选"
          allowClear
          style={{ width: 140 }}
          value={difficulty}
          onChange={(v) => setDifficulty(v || undefined)}
        >
          <Select.Option value="EASY">简单</Select.Option>
          <Select.Option value="MEDIUM">中等</Select.Option>
          <Select.Option value="HARD">困难</Select.Option>
        </Select>
      </Space>
      <Table
        columns={columns}
        data={data}
        loading={loading}
        rowKey="id"
        border={false}
        pagination={{
          current: page,
          pageSize: 20,
          total,
          onChange: (p) => {
            setPage(p);
            fetchData(p);
          },
        }}
      />
    </div>
  );
}
