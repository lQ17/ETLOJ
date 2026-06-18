import { useState, useEffect, useCallback, useRef } from "react";
import {
  Modal, Table, Input, Select, Space, Tag, Message,
  Button, Checkbox, Switch, Tooltip, Typography,
} from "@arco-design/web-react";
import { IconQuestionCircle } from "@arco-design/web-react/icon";
import { problemApi } from "../api/problem";
import { tagApi } from "../api/tag";
import DifficultyTag from "./DifficultyTag";
import { DIFFICULTY_VALUES, DIFFICULTY_CONFIG } from "../constants/difficulty";

interface AddProblemsModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (slugs: string[]) => Promise<void>;
  existingSlugs?: string[];
}

export default function AddProblemsModal({
  visible, onClose, onAdd, existingSlugs = [],
}: AddProblemsModalProps) {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [difficulty, setDifficulty] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 标签筛选
  const [allTags, setAllTags] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMode, setTagMode] = useState<"AND" | "OR">("AND");
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [tempSelectedTags, setTempSelectedTags] = useState<string[]>([]);
  const [tempTagMode, setTempTagMode] = useState<"AND" | "OR">("AND");
  const [tagSearchKeyword, setTagSearchKeyword] = useState("");

  const PAGE_SIZE = 10;
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const existingSet = new Set(existingSlugs);

  const fetchData = useCallback(async (
    p: number,
    kw: string,
    diff: string | undefined,
    tags: string[],
    tMode: "AND" | "OR",
  ) => {
    setLoading(true);
    try {
      const params: any = {
        page: p,
        pageSize: PAGE_SIZE,
        keyword: kw || undefined,
        difficulty: diff as any,
      };
      if (tags.length > 0) {
        params.tags = tags;
        params.tagMode = tMode;
      }
      const res: any = await problemApi.list(params);
      setData(res.items || []);
      setTotal(res.total || 0);
    } catch {
      Message.error("获取题目列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  // 弹窗打开时加载数据、重置状态
  useEffect(() => {
    if (visible) {
      setSelectedSlugs([]);
      setKeyword("");
      setDifficulty(undefined);
      setSelectedTags([]);
      setTagMode("AND");
      setPage(1);
      fetchData(1, "", undefined, [], "AND");
      // 加载标签列表
      tagApi.list().then((res: any) => setAllTags(res || [])).catch(() => {});
    }
  }, [visible]);

  // 关键字输入防抖自动搜索
  const handleKeywordChange = (v: string) => {
    setKeyword(v);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setPage(1);
      fetchData(1, v, difficulty, selectedTags, tagMode);
    }, 300);
  };

  // 难度变化立即搜索
  const handleDifficultyChange = (v: string | undefined) => {
    const newDiff = v || undefined;
    setDifficulty(newDiff);
    setPage(1);
    fetchData(1, keyword, newDiff, selectedTags, tagMode);
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    fetchData(p, keyword, difficulty, selectedTags, tagMode);
  };

  // 标签筛选弹窗
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
    setPage(1);
    fetchData(1, keyword, difficulty, tempSelectedTags, tempTagMode);
  };

  const clearTags = () => {
    setSelectedTags([]);
    setPage(1);
    fetchData(1, keyword, difficulty, [], tagMode);
  };

  // 跨页多选逻辑
  const handleSelectionChange = (slugs: string[]) => {
    setSelectedSlugs((prev) => {
      const currentPageSlugs = data
        .filter((item) => !existingSet.has(item.slug))
        .map((item) => item.slug);
      const withoutCurrentPage = prev.filter((s) => !currentPageSlugs.includes(s));
      return [...withoutCurrentPage, ...slugs];
    });
  };

  const handleConfirm = async () => {
    if (selectedSlugs.length === 0) {
      Message.warning("请至少选择一道题目");
      return;
    }
    setSubmitting(true);
    try {
      await onAdd(selectedSlugs);
      onClose();
    } catch {
      Message.error("添加题目失败");
    } finally {
      setSubmitting(false);
    }
  };

  const columns: any[] = [
    {
      title: "题号",
      dataIndex: "slug",
      width: 110,
      render: (slug: string) => (
        <span style={{ fontFamily: "Consolas, monospace" }}>{slug}</span>
      ),
    },
    {
      title: "标题",
      dataIndex: "title",
      render: (title: string, record: any) => (
        <Space>
          <span>{title}</span>
          {existingSet.has(record.slug) && (
            <Tag size="small" color="gray">已添加</Tag>
          )}
        </Space>
      ),
    },
    {
      title: "难度",
      dataIndex: "difficulty",
      width: 90,
      render: (d: string) => d ? <DifficultyTag difficulty={d} size="small" /> : "-",
    },
    {
      title: "分数",
      dataIndex: "score",
      width: 70,
      render: (v: number) => v ?? "-",
    },
  ];

  const currentPageSelectedSlugs = selectedSlugs.filter((s) =>
    data.some((item) => item.slug === s)
  );

  return (
    <>
      <Modal
        title="添加题目"
        visible={visible}
        onCancel={onClose}
        onOk={handleConfirm}
        confirmLoading={submitting}
        okText={`添加${selectedSlugs.length > 0 ? ` (${selectedSlugs.length})` : ""}`}
        style={{ width: 720 }}
        unmountOnExit
      >
        <Space style={{ marginBottom: 12 }} wrap>
          <Input
            placeholder="搜索题号或标题"
            allowClear
            style={{ width: 220 }}
            value={keyword}
            onChange={handleKeywordChange}
          />
          <Select
            placeholder="难度筛选"
            allowClear
            style={{ width: 120 }}
            value={difficulty}
            onChange={handleDifficultyChange}
          >
            {DIFFICULTY_VALUES.map((d) => (
              <Select.Option key={d} value={d}>
                {DIFFICULTY_CONFIG[d].label}
              </Select.Option>
            ))}
          </Select>
          <Button type="outline" size="small" onClick={openTagModal}>
            标签筛选{selectedTags.length > 0 ? `（${selectedTags.length}个）` : ""}
          </Button>
          {selectedTags.length > 0 && (
            <Button type="text" size="small" onClick={clearTags}>
              清除标签
            </Button>
          )}
        </Space>

        {selectedTags.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              当前筛选：{selectedTags.join(tagMode === "AND" ? " 且 " : " 或 ")}
            </Typography.Text>
          </div>
        )}

        <Table
          columns={columns}
          data={data}
          loading={loading}
          rowKey="slug"
          size="small"
          border={false}
          rowSelection={{
            type: "checkbox",
            selectedRowKeys: currentPageSelectedSlugs,
            onChange: (selectedRowKeys: (string | number)[]) => {
              handleSelectionChange(selectedRowKeys as string[]);
            },
            checkboxProps: (record: any) => ({
              disabled: existingSet.has(record.slug),
            }),
          }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            size: "small",
            showTotal: true,
            onChange: handlePageChange,
          }}
        />

        {selectedSlugs.length > 0 && (
          <div style={{ marginTop: 8, color: "var(--color-text-2)", fontSize: 13 }}>
            已选择 <b>{selectedSlugs.length}</b> 道题目
          </div>
        )}
      </Modal>

      {/* 标签筛选子弹窗 */}
      <Modal
        title="标签筛选"
        visible={tagModalVisible}
        onCancel={() => setTagModalVisible(false)}
        onOk={handleTagModalOk}
        okText="确认筛选"
        cancelText="取消"
        style={{ width: 520 }}
        unmountOnExit
      >
        <Input.Search
          placeholder="搜索标签..."
          value={tagSearchKeyword}
          onChange={setTagSearchKeyword}
          style={{ marginBottom: 16 }}
          allowClear
        />
        <div style={{ maxHeight: 320, overflow: "auto", marginBottom: 16 }}>
          {(() => {
            const filtered = allTags
              .filter((t) => !tagSearchKeyword || t.name.includes(tagSearchKeyword))
              .sort((a, b) => a.name.localeCompare(b.name, "zh"));
            if (filtered.length === 0) {
              return <Typography.Text type="secondary">暂无标签</Typography.Text>;
            }
            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px 16px" }}>
                {filtered.map((tag) => (
                  <div key={tag.id}>
                    <Checkbox
                      checked={tempSelectedTags.includes(tag.name)}
                      onChange={(checked) => {
                        if (checked) {
                          setTempSelectedTags([...tempSelectedTags, tag.name]);
                        } else {
                          setTempSelectedTags(tempSelectedTags.filter((n) => n !== tag.name));
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
    </>
  );
}
