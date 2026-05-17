import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Table, Tag, Input, Select, Space, Typography, Button, Switch, Modal, Checkbox, Tooltip,
} from "@arco-design/web-react";
import { IconQuestionCircle, IconSearch } from "@arco-design/web-react/icon";
import { problemApi } from "../../api/problem";
import { tagApi } from "../../api/tag";
import { submissionApi } from "../../api/submission";
import { useAuthStore } from "../../stores/auth";
import DifficultyTag from "../../components/DifficultyTag";
import { DIFFICULTY_VALUES, DIFFICULTY_CONFIG } from "../../constants/difficulty";

export default function ProblemListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState(() => searchParams.get("keyword") || "");
  const [difficulty, setDifficulty] = useState<string | undefined>(() => searchParams.get("difficulty") || undefined);
  const [loading, setLoading] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<number, string>>({});

  // 标签筛选
  const [allTags, setAllTags] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    const tags = searchParams.get("tags");
    return tags ? tags.split(",") : [];
  });
  const [tagMode, setTagMode] = useState<"AND" | "OR">(() => (searchParams.get("tagMode") as "AND" | "OR") || "AND");
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [tagSearchKeyword, setTagSearchKeyword] = useState("");
  const [tempSelectedTags, setTempSelectedTags] = useState<string[]>([]);
  const [tempTagMode, setTempTagMode] = useState<"AND" | "OR">("AND");

  // 加载标签列表
  useEffect(() => {
    tagApi.list().then((res: any) => setAllTags(res || [])).catch(() => {});
  }, []);

  const fetchData = async (p = page) => {
    setLoading(true);
    try {
      const params: any = {
        page: p,
        pageSize: 20,
        keyword: keyword || undefined,
        difficulty: difficulty || undefined,
      };
      if (selectedTags.length > 0) {
        params.tags = selectedTags;
        params.tagMode = tagMode;
      }
      const res: any = await problemApi.list(params);
      setData(res.items);
      setTotal(res.total);
      if (user && res.items?.length > 0) {
        const ids = res.items.map((item: any) => item.id);
        try {
          const status: any = await submissionApi.getStatus(ids);
          setStatusMap(status);
        } catch { /* ignore */ }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1);
    setPage(1);
    // Sync filter state to URL params for back navigation
    const params: Record<string, string> = {};
    if (keyword) params.keyword = keyword;
    if (difficulty) params.difficulty = difficulty;
    if (selectedTags.length > 0) {
      params.tags = selectedTags.join(",");
      params.tagMode = tagMode;
    }
    setSearchParams(params, { replace: true });
  }, [keyword, difficulty, selectedTags, tagMode]);

  const openTagModal = () => {
    setTempSelectedTags([...selectedTags]);
    setTempTagMode(tagMode);
    setTagSearchKeyword("");
    setTagModalVisible(true);
  };

  const handleTagModalOk = () => {
    setSelectedTags(tempSelectedTags);
    setTagMode(tempTagMode);
    setTagModalVisible(false);
  };

  const statusIcon = (id: number) => {
    const s = statusMap[id];
    if (s === "AC") return <span style={{ color: "var(--color-success)", fontWeight: 600 }}>✓</span>;
    if (s === "ATTEMPTED") return <span style={{ color: "var(--color-error)", fontWeight: 600 }}>✗</span>;
    return <span style={{ color: "var(--color-text-4)", fontSize: 18 }}>•</span>;
  };

  const columns = [
    ...(user
      ? [
          {
            title: "状态",
            width: 60,
            align: "center" as const,
            render: (_: any, record: any) => (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                {statusIcon(record.id)}
              </div>
            ),
          },
        ]
      : []),
    {
      title: "题号",
      dataIndex: "slug",
      width: 120,
      render: (slug: string) => <span>{slug}</span>,
    },
    {
      title: "标题",
      dataIndex: "title",
      render: (title: string, record: any) => (
        <Typography.Text
          style={{ cursor: "pointer", color: "#3b82f6" }}
          onClick={() => {
            const params = new URLSearchParams();
            if (keyword) params.set("keyword", keyword);
            if (difficulty) params.set("difficulty", difficulty);
            if (selectedTags.length > 0) {
              params.set("tags", selectedTags.join(","));
              params.set("tagMode", tagMode);
            }
            const qs = params.toString();
            navigate(`/problems/${record.slug}`, { state: { listParams: qs || undefined } });
          }}
        >
          {title}
        </Typography.Text>
      ),
    },
    {
      title: "难度",
      dataIndex: "difficulty",
      width: 100,
      render: (d: string) => <DifficultyTag difficulty={d} />,
    },
    {
      title: "分数", dataIndex: "score", width: 70,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v ?? 0}</span>,
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
      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="搜索题号或标题"
          allowClear
          style={{ width: 240 }}
          value={keyword}
          onChange={setKeyword}
          onPressEnter={() => { setPage(1); fetchData(1); }}
        />
        <Button
          type="primary"
          icon={<IconSearch />}
          onClick={() => { setPage(1); fetchData(1); }}
        />
        <Select
          placeholder="难度筛选"
          allowClear
          style={{ width: 140 }}
          value={difficulty}
          onChange={(v) => setDifficulty(v || undefined)}
        >
          {DIFFICULTY_VALUES.map(d => (
            <Select.Option key={d} value={d}>{DIFFICULTY_CONFIG[d].label}</Select.Option>
          ))}
        </Select>
        <Button type="outline" onClick={openTagModal}>
          标签筛选{selectedTags.length > 0 ? `（${selectedTags.length}个）` : ""}
        </Button>
        {selectedTags.length > 0 && (
          <Button
            type="text"
            size="small"
            onClick={() => { setSelectedTags([]); }}
          >
            清除标签
          </Button>
        )}
      </Space>
      {selectedTags.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              当前筛选：{selectedTags.join(tagMode === "AND" ? " 且 " : " 或 ")}
            </Typography.Text>
          </Space>
        </div>
      )}
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

      {/* 标签筛选弹窗 */}
      <Modal
        title="标签筛选"
        visible={tagModalVisible}
        onCancel={() => setTagModalVisible(false)}
        onOk={handleTagModalOk}
        okText="确认筛选"
        cancelText="取消"
        style={{ width: 560 }}
      >
        <Input.Search
          placeholder="搜索标签..."
          value={tagSearchKeyword}
          onChange={setTagSearchKeyword}
          style={{ marginBottom: 16 }}
          allowClear
        />
        <div style={{ maxHeight: 400, overflow: "auto", marginBottom: 16 }}>
          {(() => {
            const filtered = allTags
              .filter(t => !tagSearchKeyword || t.name.includes(tagSearchKeyword))
              .sort((a, b) => a.name.localeCompare(b.name, "zh"));
            if (filtered.length === 0) {
              return <Typography.Text type="secondary">暂无标签</Typography.Text>;
            }
            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px 16px" }}>
                {filtered.map(tag => (
                  <div key={tag.id}>
                    <Checkbox
                      checked={tempSelectedTags.includes(tag.name)}
                      onChange={(checked) => {
                        if (checked) {
                          setTempSelectedTags([...tempSelectedTags, tag.name]);
                        } else {
                          setTempSelectedTags(tempSelectedTags.filter(n => n !== tag.name));
                        }
                      }}
                    >
                      <Tag style={{ marginRight: 4 }}>{tag.name}</Tag>
                    </Checkbox>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            当前模式：<b style={{ color: "var(--color-text-1)" }}>{tempTagMode === "AND" ? "并且" : "或者"}</b>
          </Typography.Text>
          <Switch
            checked={tempTagMode === "AND"}
            checkedText="并且"
            uncheckedText="或者"
            onChange={(v) => setTempTagMode(v ? "AND" : "OR")}
            size="small"
          />
          <Tooltip
            content={
              <div style={{ lineHeight: 1.8 }}>
                <div><b>并且：</b>题目必须包含所有选中的标签</div>
                <div><b>或者：</b>题目包含任一选中的标签即可</div>
              </div>
            }
          >
            <IconQuestionCircle style={{ color: "var(--color-text-3)", cursor: "help" }} />
          </Tooltip>
        </div>
      </Modal>
    </div>
  );
}
