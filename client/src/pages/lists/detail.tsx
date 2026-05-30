import { useState, useEffect, useCallback } from "react";
import {
  Table, Tag, Button, Breadcrumb, Modal, Input, Message, Typography, Space, Popconfirm,
} from "@arco-design/web-react";
import { IconPlus, IconDelete, IconDragArrow } from "@arco-design/web-react/icon";
import { useParams, Link } from "react-router-dom";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { problemListApi } from "../../api/problem-list";
import { submissionApi } from "../../api/submission";
import { useAuthStore } from "../../stores/auth";
import DifficultyTag from "../../components/DifficultyTag";

const { Title, Text, Paragraph } = Typography;

function SortableRow({
  item, index, user, statusMap, canEdit, onRemove,
}: {
  item: any; index: number; user: any; statusMap: Record<number, string>;
  canEdit: boolean; onRemove: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: "flex",
    alignItems: "center",
    padding: "10px 16px",
    borderBottom: "1px solid var(--color-border)",
    background: isDragging ? "var(--color-fill-2)" : "transparent",
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1 : 0,
    position: "relative" as const,
  };

  const s = statusMap[item.problem?.id];
  const statusIcon = s === "AC"
    ? <span style={{ color: "var(--color-success)", fontWeight: 600 }}>✓</span>
    : s === "ATTEMPTED"
      ? <span style={{ color: "var(--color-error)", fontWeight: 600 }}>✗</span>
      : <span style={{ color: "var(--color-text-4)", fontSize: 18 }}>•</span>;

  return (
    <div ref={setNodeRef} style={style}>
      {canEdit && (
        <div
          {...attributes}
          {...listeners}
          style={{ cursor: "grab", padding: "0 8px 0 0", color: "var(--color-text-3)", touchAction: "none" }}
        >
          <IconDragArrow style={{ fontSize: 16 }} />
        </div>
      )}
      {user && (
        <div style={{ width: 40, textAlign: "center", flexShrink: 0 }}>{statusIcon}</div>
      )}
      <div style={{ width: 50, textAlign: "center", flexShrink: 0, color: "var(--color-text-3)" }}>{index + 1}</div>
      <div style={{ width: 100, fontFamily: "Consolas, monospace", flexShrink: 0 }}>{item.problem?.slug}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link to={`/problems/${item.problem?.slug}`} style={{ color: "#3b82f6", textDecoration: "none" }}>
          {item.problem?.title}
        </Link>
      </div>
      <div style={{ width: 80, flexShrink: 0 }}>
        {item.problem?.difficulty ? <DifficultyTag difficulty={item.problem.difficulty} size="small" /> : "-"}
      </div>
      <div style={{ width: 60, textAlign: "center", flexShrink: 0 }}>{item.problem?.score ?? "-"}</div>
      {canEdit && (
        <div style={{ width: 40, textAlign: "center", flexShrink: 0 }}>
          <Popconfirm title="确定移除此题？" onOk={() => onRemove(item.problem?.id)}>
            <Button type="text" size="mini" status="danger" icon={<IconDelete />} />
          </Popconfirm>
        </div>
      )}
    </div>
  );
}

export default function ProblemListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);

  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [problemSlugs, setProblemSlugs] = useState("");
  const [adding, setAdding] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<number, string>>({});
  const [sortableItems, setSortableItems] = useState<any[]>([]);
  const [orderChanged, setOrderChanged] = useState(false);
  const [saving, setSaving] = useState(false);

  const isOwner = user?.id === detail?.creator?.id;
  const isAdmin = user?.role === "ADMIN" || user?.role === "TEACHER";
  const canEdit = isOwner || isAdmin;
  const canAddProblems = canEdit && !detail?.isPublic;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res: any = await problemListApi.getDetail(+id);
      setDetail(res);
      setSortableItems(res.items || []);
      setOrderChanged(false);
      if (user && res.items?.length > 0) {
        const ids = res.items.map((item: any) => item.problem?.id).filter(Boolean);
        try {
          const status: any = await submissionApi.getStatus(ids);
          setStatusMap(status);
        } catch { /* ignore */ }
      }
    } catch {
      Message.error("加载题单详情失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleAddProblems = async () => {
    const slugs = problemSlugs.split(/[,，\s\n]+/).map((s) => s.trim()).filter(Boolean);
    if (slugs.length === 0) {
      Message.warning("请输入题号");
      return;
    }
    setAdding(true);
    try {
      const res: any = await problemListApi.addItems(+id!, slugs);
      setAddModalVisible(false);
      setProblemSlugs("");
      fetchDetail();
      if (res.errors?.length > 0) {
        Message.warning(`以下题号不存在：${res.errors.join("、")}`);
      } else {
        Message.success(`成功添加 ${res.added?.length ?? slugs.length} 道题`);
      }
    } catch {
      Message.error("添加失败");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (problemId: number) => {
    try {
      await problemListApi.removeItem(+id!, problemId);
      Message.success("移除成功");
      fetchDetail();
    } catch {
      Message.error("移除失败");
    }
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSortableItems((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      const moved = arrayMove(items, oldIndex, newIndex);
      setOrderChanged(true);
      return moved;
    });
  }, []);

  const handleSaveOrder = async () => {
    setSaving(true);
    try {
      const items = sortableItems.map((item, index) => ({ id: item.id, sortOrder: index }));
      await problemListApi.updateSortOrder(+id!, items);
      Message.success("排序已保存");
      setOrderChanged(false);
      // 更新 detail 中的 items 顺序
      setDetail((prev: any) => ({ ...prev, items: sortableItems }));
    } catch {
      Message.error("保存排序失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 80 }}>加载中...</div>;
  }

  if (!detail) {
    return <div style={{ textAlign: "center", padding: 80 }}>题单不存在</div>;
  }

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 16 }}>
        <Breadcrumb.Item>
          <Link to="/lists">题单</Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>{detail.title}</Breadcrumb.Item>
      </Breadcrumb>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <Title heading={4} style={{ marginBottom: 8 }}>{detail.title}</Title>
            <Paragraph type="secondary" style={{ marginBottom: 8 }}>
              {detail.description || "暂无简介"}
            </Paragraph>
            <Space>
              <Text type="secondary">创建者: {detail.creator?.username}</Text>
              <Tag color="blue">{detail.items?.length ?? 0} 题</Tag>
              {user && detail.items?.length > 0 && (() => {
                const acCount = detail.items.filter((item: any) => statusMap[item.problem?.id] === "AC").length;
                const total = detail.items.length;
                const pct = Math.round((acCount / total) * 100);
                return (
                  <Tag color={acCount === total && total > 0 ? "green" : acCount > 0 ? "orange" : "gray"}>
                    {acCount}/{total} 已通过{pct === 100 ? " ✓" : ` (${pct}%)`}
                  </Tag>
                );
              })()}
            </Space>
          </div>
          <Space>
            {orderChanged && (
              <Button type="primary" loading={saving} onClick={handleSaveOrder}>
                保存排序
              </Button>
            )}
            {canAddProblems && (
              <Button type="primary" icon={<IconPlus />} onClick={() => setAddModalVisible(true)}>
                添加题目
              </Button>
            )}
          </Space>
        </div>
      </div>

      {/* 列头 */}
      <div style={{
        display: "flex", alignItems: "center", padding: "8px 16px",
        background: "var(--color-fill-1)", borderRadius: "4px 4px 0 0",
        fontWeight: 500, fontSize: 13, color: "var(--color-text-3)",
      }}>
        {canEdit && <div style={{ width: 24, flexShrink: 0 }} />}
        {user && <div style={{ width: 40, textAlign: "center", flexShrink: 0 }}>状态</div>}
        <div style={{ width: 50, textAlign: "center", flexShrink: 0 }}>序号</div>
        <div style={{ width: 100, flexShrink: 0 }}>题号</div>
        <div style={{ flex: 1 }}>标题</div>
        <div style={{ width: 80, flexShrink: 0 }}>难度</div>
        <div style={{ width: 60, textAlign: "center", flexShrink: 0 }}>分数</div>
        {canEdit && <div style={{ width: 40, flexShrink: 0 }} />}
      </div>

      {/* 列表内容 */}
      {sortableItems.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-3)" }}>
          暂无题目
        </div>
      ) : canEdit ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {sortableItems.map((item, index) => (
              <SortableRow
                key={item.id}
                item={item}
                index={index}
                user={user}
                statusMap={statusMap}
                canEdit={canEdit}
                onRemove={handleRemove}
              />
            ))}
          </SortableContext>
        </DndContext>
      ) : (
        sortableItems.map((item, index) => (
          <SortableRow
            key={item.id}
            item={item}
            index={index}
            user={user}
            statusMap={statusMap}
            canEdit={false}
            onRemove={handleRemove}
          />
        ))
      )}

      {canAddProblems && (
        <Modal
          title="添加题目"
          visible={addModalVisible}
          onCancel={() => { setAddModalVisible(false); setProblemSlugs(""); }}
          onOk={handleAddProblems}
          confirmLoading={adding}
          unmountOnExit
        >
          <div style={{ marginBottom: 8 }}>
            <Text type="secondary">请输入题号（如 P1012），多个用逗号或空格分隔</Text>
          </div>
          <Input.TextArea
            placeholder="例如: P1001, P1002, P1012"
            value={problemSlugs}
            onChange={setProblemSlugs}
            autoSize={{ minRows: 2 }}
          />
        </Modal>
      )}
    </div>
  );
}
