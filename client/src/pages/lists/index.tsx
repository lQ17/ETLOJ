import { useState, useEffect } from "react";
import { Tabs, Card, Input, Button, Grid, Pagination, Modal, Form, Message, Typography, Empty, Space, Popconfirm, Progress, Alert } from "@arco-design/web-react";
import { IconPlus, IconEdit, IconDelete } from "@arco-design/web-react/icon";
import { useLocation, useSearchParams, Link } from "react-router-dom";
import { problemListApi } from "../../api/problem-list";
import { categoryApi } from "../../api/problem-list-category";
import type { ListCategory } from "../../api/problem-list-category";
import { useAuthStore } from "../../stores/auth";
import "./index.css";

const { Row, Col } = Grid;
const { Title, Text, Paragraph } = Typography;
const positive = (value: string | null) => value && /^\d+$/.test(value) && Number.isSafeInteger(+value) && +value > 0 ? +value : undefined;

export default function ProblemListsPage() {
  const user = useAuthStore(s => s.user);
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "mine" ? "mine" : "public";
  const page = positive(params.get(tab === "mine" ? "myPage" : "page")) ?? 1;
  const categoryId = positive(params.get("category"));
  const keyword = params.get("q") ?? "";
  const [search, setSearch] = useState(keyword);
  const [categories, setCategories] = useState<ListCategory[]>([]);
  const [categoryError, setCategoryError] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const root = categories.find(c => c.id === categoryId || c.children?.some(child => child.id === categoryId));
  const selected = root?.children?.find(c => c.id === categoryId) ?? root;

  const change = (values: Record<string, string | undefined>) => {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
      return next;
    });
  };
  useEffect(() => { setSearch(keyword); }, [keyword]);
  useEffect(() => {
    let active = true;
    categoryApi.tree().then(value => { if (active) { setCategories(value); setCategoryError(false); } })
      .catch(() => { if (active) setCategoryError(true); });
    return () => { active = false; };
  }, [revision]);
  useEffect(() => {
    let active = true;
    setData([]); setError(""); setLoading(true);
    if (tab === "mine" && !user) { setLoading(false); setTotal(0); return; }
    const request = tab === "mine"
      ? problemListApi.getMyLists({ page, pageSize: 12 })
      : problemListApi.getPublicLists({ page, pageSize: 12, keyword, categoryId });
    request.then((res: any) => {
      if (!active) return;
      const last = Math.max(1, Math.ceil(res.total / 12));
      if (page > last) {
        setParams(previous => {
          const next = new URLSearchParams(previous);
          next.set(tab === "mine" ? "myPage" : "page", String(last));
          return next;
        }, { replace: true });
      }
      setData(res.items); setTotal(res.total);
    }).catch((err) => { if (active) setError(err.message || "加载题单失败，请重试"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tab, page, keyword, categoryId, user?.id, user?.role, revision, setParams]);

  const edit = (item?: any) => {
    setEditingId(item?.id ?? null); form.resetFields();
    if (item) form.setFieldsValue({ title: item.title, description: item.description });
    setModal(true);
  };
  const save = async () => {
    let values;
    try { values = await form.validate(); } catch { return; }
    setSaving(true);
    try {
      if (editingId) await problemListApi.update(editingId, values);
      else await problemListApi.create({ ...values, isPublic: false });
      setModal(false); change({ myPage: "1" }); setRevision(v => v + 1);
      Message.success("题单已保存");
    } catch { Message.error("保存失败，请重试"); }
    finally { setSaving(false); }
  };
  const remove = async (id: number) => {
    try { await problemListApi.delete(id); setRevision(v => v + 1); Message.success("题单已删除"); }
    catch { Message.error("删除失败"); }
  };

  return <div className="problem-lists-page">
    <div className="problem-lists-heading">
      <Title heading={4} className="problem-lists-title">题单</Title>
      <Paragraph type="secondary" className="problem-lists-subtitle">按分类浏览和管理练习题单。</Paragraph>
    </div>
    <Tabs className="problem-lists-tabs" activeTab={tab} onChange={value => change({ tab: value === "public" ? undefined : value })}>
      <Tabs.TabPane key="public" title="公共题单" />
      <Tabs.TabPane key="mine" title="我的题单" />
    </Tabs>
    {tab === "public" && <>
      {categoryError && <Alert className="problem-lists-category-alert" type="warning" content="分类暂时加载失败，仍可浏览全部题单。" action={<Button onClick={() => setRevision(v => v + 1)}>重试</Button>} />}
      <section className="problem-lists-category-zone" aria-label="题单分类">
      <div className="problem-lists-primary-nav" aria-label="一级栏目">
        <Button className="problem-lists-primary-button" type={!categoryId ? "primary" : "secondary"} onClick={() => change({ category: undefined, page: undefined })}>全部题单</Button>
        {categories.map(category => <Button className="problem-lists-primary-button" key={category.id} type={root?.id === category.id ? "primary" : "secondary"}
          onClick={() => change({ category: String(category.id), page: undefined })}>{category.name}</Button>)}
      </div>
      {root && <Card className="problem-lists-secondary-panel">
        <Space className="problem-lists-secondary-actions" wrap>
          <Button size="small" type={categoryId === root.id ? "primary" : "text"} onClick={() => change({ category: String(root.id), page: undefined })}>栏目全部</Button>
          {root.children?.map(child => <Button key={child.id} size="small" type={categoryId === child.id ? "primary" : "text"}
            onClick={() => change({ category: String(child.id), page: undefined })}>{child.name}</Button>)}
        </Space>
        {selected?.description && <Paragraph type="secondary" className="problem-lists-secondary-description">{selected.description}</Paragraph>}
      </Card>}
      </section>
      <div className="problem-lists-search-row">
        <Input.Search className="problem-lists-search-input" value={search} onChange={setSearch} allowClear
          placeholder={selected ? `搜索「${selected.name}」中的题单` : "搜索全部公共题单"}
          onSearch={() => change({ q: search.trim() || undefined, page: undefined })} />
        {categoryId && <Button type="text" onClick={() => change({ category: undefined, q: search.trim() || undefined, page: undefined })}>在全部题单中搜索</Button>}
        <Text className="problem-lists-sort-hint" type="secondary">{selected?.parentId ? "按教学编排顺序" : "按创建时间排序"}</Text>
      </div>
    </>}
    {tab === "mine" && user && <div className="problem-lists-mine-actions"><Button type="primary" icon={<IconPlus />} onClick={() => edit()}>新建题单</Button></div>}
    <section className="problem-lists-results" aria-live="polite">
    {tab === "mine" && !user ? <div className="problem-lists-empty-state"><Empty description={<span>请先<Link to="/login">登录</Link>查看我的题单</span>} /></div>
      : error ? <Alert type="error" content={error} action={<Space><Button onClick={() => setRevision(v => v + 1)}>重试</Button><Button onClick={() => change({ category: undefined, page: undefined })}>全部题单</Button></Space>} />
      : loading ? <div className="problem-lists-loading">加载中...</div>
      : data.length === 0 ? <div className="problem-lists-empty-state"><Empty description={keyword ? "未找到匹配的题单，可清除关键词或在全部题单中搜索" : "暂无题单"} /></div>
      : <Row className="problem-lists-grid" gutter={[24, 24]}>{data.map(item => {
        const count = item._count?.items ?? 0;
        const ac = item.acCount ?? 0;
        const percent = count ? Math.round(ac / count * 100) : 0;
        const canEdit = tab === "mine" && (!item.isPublic || user?.role === "ADMIN" || user?.role === "TEACHER");
        return <Col key={item.id} xs={24} sm={12} lg={8}>
          <Card className="problem-list-card" hoverable>
            <Link className="problem-list-card-link" to={`/lists/${item.id}?from=${encodeURIComponent(location.pathname + location.search)}`}>
              <Text className="problem-list-card-meta" type="secondary">#{item.id} · {count} 题</Text>
              <Title className="problem-list-card-title" heading={6}>{item.title}</Title>
              <Paragraph className="problem-list-card-description" type="secondary" ellipsis={{ rows: 2 }}>{item.description || "暂无简介"}</Paragraph>
              {user ? <><div className="problem-list-card-progress-label"><Text type="secondary">{ac}/{count} 已通过</Text><Text type="secondary">{count ? `${percent}%` : "—"}</Text></div><Progress percent={percent} size="small" showText={false} /></>
                : <Text type="secondary">登录后记录练习进度</Text>}
            </Link>
            {canEdit && <Space className="problem-list-card-actions">
              <Button aria-label="编辑题单" type="text" size="mini" icon={<IconEdit />} onClick={() => edit(item)} />
              <Popconfirm title="确定删除此题单？" onOk={() => remove(item.id)}><Button aria-label="删除题单" type="text" size="mini" status="danger" icon={<IconDelete />} /></Popconfirm>
            </Space>}
          </Card>
        </Col>;
      })}</Row>}
    </section>
    {!loading && !error && total > 12 && <Pagination className="problem-lists-pagination" current={page} pageSize={12} total={total} showTotal
      onChange={value => change({ [tab === "mine" ? "myPage" : "page"]: String(value) })} />}
    <Modal title={editingId ? "编辑题单" : "新建题单"} visible={modal} onCancel={() => setModal(false)} onOk={save} confirmLoading={saving}>
      <Form form={form} layout="vertical">
        <Form.Item field="title" label="题单标题" rules={[{ required: true, message: "请输入标题" }]}><Input maxLength={50} /></Form.Item>
        <Form.Item field="description" label="题单简介"><Input.TextArea maxLength={200} autoSize={{ minRows: 3 }} /></Form.Item>
      </Form>
    </Modal>
  </div>;
}
