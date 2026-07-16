import { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { useMediaQuery } from "../../hooks/useMediaQuery";

function parsePage(raw: string | null): number {
  const p = parseInt(raw || "1", 10);
  return Number.isFinite(p) && p > 0 ? p : 1;
}

/** 从当前 URL 构建题库列表 query（用于同步 URL / 返回题库） */
function buildListQuery(opts: {
  page: number;
  keyword: string;
  difficulty?: string;
  selectedTags: string[];
  tagMode: "AND" | "OR";
}): URLSearchParams {
  const params = new URLSearchParams();
  if (opts.keyword) params.set("keyword", opts.keyword);
  if (opts.difficulty) params.set("difficulty", opts.difficulty);
  if (opts.selectedTags.length > 0) {
    params.set("tags", opts.selectedTags.join(","));
    params.set("tagMode", opts.tagMode);
  }
  if (opts.page > 1) params.set("page", String(opts.page));
  return params;
}

export default function ProblemListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);

  // URL 为唯一数据源：返回题库 / 浏览器后退时直接按 query 恢复
  // 注意：用字符串 snapshot 作依赖，避免 URLSearchParams 引用变化导致重复请求
  const page = parsePage(searchParams.get("page"));
  const keyword = searchParams.get("keyword") || "";
  const difficulty = searchParams.get("difficulty") || undefined;
  const tagsKey = searchParams.get("tags") || "";
  const selectedTags = useMemo(
    () => (tagsKey ? tagsKey.split(",").filter(Boolean) : []),
    [tagsKey],
  );
  const tagMode = (searchParams.get("tagMode") as "AND" | "OR") || "AND";

  // 搜索框本地草稿：输入时不立刻改 URL，点搜索 / 回车再提交（避免每键重置页码）
  const [keywordInput, setKeywordInput] = useState(keyword);
  useEffect(() => {
    setKeywordInput(keyword);
  }, [keyword]);

  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<number, string>>({});

  // 标签筛选弹窗
  const [allTags, setAllTags] = useState<any[]>([]);
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [tagSearchKeyword, setTagSearchKeyword] = useState("");
  const [tempSelectedTags, setTempSelectedTags] = useState<string[]>([]);
  const [tempTagMode, setTempTagMode] = useState<"AND" | "OR">("AND");

  const { isMobile, isTablet } = useMediaQuery();

  /** 写回 URL；筛选变更时由调用方传入 page: 1 */
  const applyListParams = (next: {
    page?: number;
    keyword?: string;
    /** 传 null 表示清除难度 */
    difficulty?: string | null;
    selectedTags?: string[];
    tagMode?: "AND" | "OR";
  }) => {
    const params = buildListQuery({
      page: next.page ?? page,
      keyword: next.keyword ?? keyword,
      difficulty: next.difficulty === null
        ? undefined
        : (next.difficulty !== undefined ? next.difficulty : difficulty),
      selectedTags: next.selectedTags ?? selectedTags,
      tagMode: next.tagMode ?? tagMode,
    });
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    tagApi.list().then((res: any) => setAllTags(res || [])).catch(() => {});
  }, []);

  // 仅随 URL 中的列表状态拉数，避免 StrictMode / 本地 state 误把页码打回 1
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params: any = {
          page,
          pageSize: 20,
          keyword: keyword || undefined,
          difficulty: difficulty || undefined,
        };
        if (selectedTags.length > 0) {
          params.tags = selectedTags;
          params.tagMode = tagMode;
        }
        const res: any = await problemApi.list(params);
        if (cancelled) return;
        setData(res.items);
        setTotal(res.total);
        if (user && res.items?.length > 0) {
          const ids = res.items.map((item: any) => item.id);
          try {
            const status: any = await submissionApi.getStatus(ids);
            if (!cancelled) setStatusMap(status);
          } catch { /* ignore */ }
        } else {
          setStatusMap({});
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page, keyword, difficulty, tagsKey, tagMode, user]);

  const openTagModal = () => {
    setTempSelectedTags([...selectedTags]);
    setTempTagMode(tagMode);
    setTagSearchKeyword("");
    setTagModalVisible(true);
  };

  const handleTagModalOk = () => {
    // 改标签筛选时回到第 1 页
    applyListParams({ selectedTags: tempSelectedTags, tagMode: tempTagMode, page: 1 });
    setTagModalVisible(false);
  };

  const handleSearch = () => {
    applyListParams({ keyword: keywordInput.trim(), page: 1 });
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
      render: (title: string, record: any) => {
        // 把当前列表 query 原样塞进 back，返回时可完整恢复（含 page）
        const qs = searchParams.toString();
        const to = `/problems/${record.slug}${qs ? `?back=${encodeURIComponent(qs)}` : ""}`;
        return <Link to={to} style={{ color: "#3b82f6", textDecoration: "none" }}>{title}</Link>;
      },
    },
    {
      title: "难度",
      dataIndex: "difficulty",
      width: 100,
      render: (d: string) => <DifficultyTag difficulty={d} />,
    },
    ...(!isMobile ? [{
      title: "分数", dataIndex: "score", width: 70,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v ?? 0}</span>,
    }] : []),
    ...(!isTablet ? [{
      title: "通过率",
      width: 100,
      render: (_: any, record: any) => {
        const t = record.totalSubmissions || 0;
        const ac = record.acceptedCount || 0;
        return t > 0 ? `${Math.round((ac / t) * 100)}%` : "-";
      },
    }] : []),
    ...(!isMobile ? [{
      title: "提交数",
      dataIndex: "totalSubmissions",
      width: 80,
    }] : []),
    ...(!isTablet ? [{
      title: "标签",
      dataIndex: "tags",
      render: (tags: string[]) =>
        Array.isArray(tags)
          ? tags.map((t: string) => <Tag key={t} style={{ marginRight: 4 }}>{t}</Tag>)
          : null,
    }] : []),
  ];

  return (
    <div>
      <Typography.Title heading={4}>题库</Typography.Title>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="搜索题号或标题"
          allowClear
          style={{ width: 240 }}
          value={keywordInput}
          onChange={setKeywordInput}
          onClear={() => applyListParams({ keyword: "", page: 1 })}
          onPressEnter={handleSearch}
        />
        <Button
          type="primary"
          icon={<IconSearch />}
          onClick={handleSearch}
        />
        <Select
          placeholder="难度筛选"
          allowClear
          style={{ width: 140 }}
          value={difficulty}
          onChange={(v) => applyListParams({ difficulty: v || null, page: 1 })}
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
            onClick={() => applyListParams({ selectedTags: [], page: 1 })}
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
            applyListParams({ page: p });
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
