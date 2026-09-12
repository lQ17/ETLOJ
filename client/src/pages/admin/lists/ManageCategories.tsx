import { useEffect, useState } from "react";
import { Alert, Button, Card, Checkbox, Empty, Form, Input, InputNumber, Message, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography } from "@arco-design/web-react";
import { Link } from "react-router-dom";
import { categoryApi } from "../../../api/problem-list-category";
import type { CategoryMembership, ListCategory } from "../../../api/problem-list-category";
import { problemListApi } from "../../../api/problem-list";
import { useAuthStore } from "../../../stores/auth";

export default function ManageCategories() {
  const isAdmin = useAuthStore(s => s.user?.role === "ADMIN");
  const [tree, setTree] = useState<ListCategory[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<number>();
  const [items, setItems] = useState<CategoryMembership[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsFailed, setItemsFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<{ item?: ListCategory; parentId?: number }>();
  const [adding, setAdding] = useState(false);
  const [form] = Form.useForm();
  const refresh = () => setRevision(value => value + 1);
  const initialize = async () => {
    setBusy(true);
    try { await categoryApi.initialize(); refresh(); Message.success("已建立建议分类，可继续调整名称和顺序"); }
    catch { Message.error("初始化失败；若已有分类，请刷新后直接编辑"); }
    finally { setBusy(false); }
  };
  const categories = tree.flatMap(root => (root.children ?? []).map(child => ({ ...child, path: `${root.name} / ${child.name}`, available: root.enabled && child.enabled })));
  const current = categories.find(category => category.id === selected);

  useEffect(() => {
    let active = true;
    setLoading(true);
    categoryApi.tree(true).then(value => { if (active) { setTree(value); setFailed(false); } })
      .catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  useEffect(() => {
    let active = true;
    setItems([]); setItemsFailed(false);
    if (!selected) { setItemsLoading(false); return; }
    setItemsLoading(true);
    categoryApi.items(selected).then(value => { if (active) setItems(value); })
      .catch(() => { if (active) setItemsFailed(true); }).finally(() => { if (active) setItemsLoading(false); });
    return () => { active = false; };
  }, [selected, revision]);

  const openEditor = (item?: ListCategory, parentId?: number) => {
    form.resetFields();
    form.setFieldsValue(item ? { name: item.name, description: item.description ?? "", sortOrder: item.sortOrder, enabled: item.enabled } : { sortOrder: 0, enabled: true });
    setEditor({ item, parentId });
  };
  const save = async () => {
    let values;
    try { values = await form.validate(); } catch { return; }
    setBusy(true);
    try {
      if (editor?.item) await categoryApi.update(editor.item.id, values);
      else await categoryApi.create({ ...values, parentId: editor?.parentId });
      setEditor(undefined); refresh(); Message.success("分类已保存");
    } catch { Message.error("保存失败，请重试"); }
    finally { setBusy(false); }
  };
  const toggle = async (category: ListCategory) => {
    setBusy(true);
    try { await categoryApi.update(category.id, { enabled: !category.enabled }); refresh(); }
    catch { Message.error("修改状态失败"); }
    finally { setBusy(false); }
  };
  const move = async (index: number, offset: number) => {
    if (!selected) return;
    const next = [...items];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setBusy(true);
    try { await categoryApi.sort(selected, next.map(item => item.listId)); setItems(next); Message.success("顺序已保存"); }
    catch { Message.error("保存失败，分类可能已被他人修改，请刷新后重试"); }
    finally { setBusy(false); }
  };
  const remove = async (listId: number) => {
    if (!selected) return;
    setBusy(true);
    try { await categoryApi.remove(selected, listId); refresh(); Message.success("已从当前分类移出，题单仍保留"); }
    catch { Message.error("移出失败"); }
    finally { setBusy(false); }
  };
  const controls = (category: ListCategory) => <Space>
    {isAdmin && <><Button size="small" onClick={() => openEditor(category)}>编辑</Button>
      <Popconfirm title={category.enabled ? "停用后不再出现在公共分类导航中，题单仍可在全部题单中访问。" : "确认启用此分类？"} onOk={() => toggle(category)}>
        <Button size="small" disabled={busy}>{category.enabled ? "停用" : "启用"}</Button>
      </Popconfirm></>}
    {category.parentId !== null && <Button size="small" type="primary" disabled={busy} onClick={() => setSelected(category.id)}>编排题单</Button>}
  </Space>;

  return <Space direction="vertical" style={{ width: "100%" }} size={20}>
    <Card title="分类结构" extra={isAdmin && <Button type="primary" onClick={() => openEditor()}>新建一级栏目</Button>} loading={loading}>
      <Typography.Paragraph type="secondary">一级栏目组织方向，二级分类收录题单。排序值越小越靠前；停用栏目会同时隐藏其下分类。{!isAdmin && "分类结构由管理员维护。"}</Typography.Paragraph>
      {!failed && !tree.length && isAdmin && <Button loading={busy} style={{ marginBottom: 16 }} onClick={initialize}>一键建立建议分类</Button>}
      {failed ? <Alert type="error" content="分类加载失败" action={<Button onClick={refresh}>重试</Button>} /> : !tree.length ? <Empty description="还没有分类，请管理员创建一级栏目和二级分类" /> : tree.map(root => <div key={root.id} style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, background: "var(--color-fill-2)", padding: 12 }}>
          <Space><Typography.Text bold>{root.name}</Typography.Text><Tag>{root.enabled ? "启用" : "停用"}</Tag><Typography.Text type="secondary">排序 {root.sortOrder}</Typography.Text></Space>
          <Space wrap>{isAdmin && <Button size="small" onClick={() => openEditor(undefined, root.id)}>添加二级分类</Button>}{controls(root)}</Space>
        </div>
        {root.children?.map(child => <div key={child.id} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between", padding: "12px 12px 12px 24px", borderBottom: "1px solid var(--color-border-2)" }}>
          <Space><Typography.Text>{child.name}</Typography.Text><Typography.Text type="secondary">{child._count.items} 份公共题单 · 排序 {child.sortOrder}</Typography.Text>{(!root.enabled || !child.enabled) && <Tag>前台已隐藏</Tag>}</Space>{controls(child)}
        </div>)}
      </div>)}
    </Card>
    <Card title="题单编排">
      <Space wrap style={{ marginBottom: 16 }}>
        <Select placeholder="选择二级分类" value={selected} style={{ width: 320, maxWidth: "100%" }} disabled={busy} onChange={setSelected}>
          {categories.map(category => <Select.Option key={category.id} value={category.id}>{category.path}{category.available ? "" : "（已停用）"}</Select.Option>)}
        </Select>
        <Button type="primary" disabled={!selected || busy || itemsLoading || itemsFailed} onClick={() => setAdding(true)}>批量添加题单</Button>
        <Button disabled={busy} onClick={refresh}>刷新</Button>
      </Space>
      {current && !current.available && <Alert style={{ marginBottom: 12 }} content="此分类或其上级栏目已停用，编排结果暂不在公共分类导航中展示。" />}
      {itemsFailed ? <Alert type="error" content="题单加载失败，请刷新后重试" /> : !selected ? <Empty description="选择一个二级分类开始编排" /> : <Table data={items} loading={itemsLoading} rowKey="listId" pagination={false}
        columns={[
          { title: "顺序", width: 70, render: (_: unknown, __: CategoryMembership, index: number) => index + 1 },
          { title: "题单", render: (_: unknown, item: CategoryMembership) => <Space><Link to={`/lists/${item.listId}`}>{item.list.title}</Link>{!item.list.isPublic && <Tag>私有，前台不可见</Tag>}</Space> },
          { title: "操作", width: 230, render: (_: unknown, item: CategoryMembership, index: number) => <Space>
            <Button size="small" disabled={busy || index === 0} onClick={() => move(index, -1)}>上移</Button>
            <Button size="small" disabled={busy || index === items.length - 1} onClick={() => move(index, 1)}>下移</Button>
            <Popconfirm title="只从当前分类移出，不删除题单。继续？" onOk={() => remove(item.listId)}><Button size="small" status="danger" disabled={busy}>移出</Button></Popconfirm>
          </Space> },
        ]} />}
    </Card>
    <Modal visible={!!editor} title={editor?.item ? "编辑分类" : editor?.parentId ? "新建二级分类" : "新建一级栏目"} onCancel={() => setEditor(undefined)} onOk={save} confirmLoading={busy}>
      <Form form={form} layout="vertical">
        <Form.Item field="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}><Input maxLength={60} /></Form.Item>
        <Form.Item field="description" label="说明"><Input.TextArea maxLength={300} /></Form.Item>
        <Form.Item field="sortOrder" label="排序（越小越靠前）" rules={[{ required: true }]}><InputNumber min={0} max={1000000} precision={0} /></Form.Item>
        <Form.Item field="enabled" label="启用" triggerPropName="checked"><Switch /></Form.Item>
      </Form>
    </Modal>
    {adding && selected && <AddLists key={selected} categoryId={selected} existing={items.map(item => item.listId)} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); refresh(); }} />}
  </Space>;
}

function AddLists({ categoryId, existing, onClose, onAdded }: { categoryId: number; existing: number[]; onClose: () => void; onAdded: () => void }) {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [input, setInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [uncategorized, setUncategorized] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setFailed(false);
    problemListApi.getPublicLists({ page, pageSize: 10, keyword, uncategorized }).then((res: any) => {
      if (active) { setData(res.items); setTotal(res.total); }
    }).catch(() => { if (active) { setData([]); setFailed(true); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, keyword, uncategorized, retry]);
  const add = async () => {
    setSaving(true);
    try { const res = await categoryApi.add(categoryId, selected); Message.success(`新增 ${res.count} 份题单，重复项已跳过`); onAdded(); }
    catch { Message.error("添加失败，请刷新并确认题单仍为公共题单"); }
    finally { setSaving(false); }
  };
  return <Modal title="批量添加公共题单" visible onCancel={onClose} onOk={add} confirmLoading={saving} okButtonProps={{ disabled: !selected.length }} style={{ width: 780, maxWidth: "95vw" }}>
    <Space wrap style={{ marginBottom: 16 }}>
      <Input.Search placeholder="搜索题单标题" value={input} onChange={setInput} onSearch={() => { setKeyword(input.trim()); setPage(1); }} allowClear />
      <Checkbox checked={uncategorized} onChange={value => { setUncategorized(value); setPage(1); }}>仅看未分类</Checkbox>
      <Typography.Text type="secondary">已选 {selected.length} 份（跨页保留）</Typography.Text>
    </Space>
    {failed && <Alert type="error" content="题单加载失败" action={<Button onClick={() => setRetry(value => value + 1)}>重试</Button>} />}
    <Table data={data} rowKey="id" loading={loading} columns={[{ title: "ID", dataIndex: "id", width: 70 }, { title: "标题", dataIndex: "title" }]}
      rowSelection={{ selectedRowKeys: selected, checkCrossPage: true, preserveSelectedRowKeys: true,
        checkboxProps: item => ({ disabled: existing.includes(item.id) || saving }),
        onChange: keys => setSelected((keys as number[]).filter(id => !existing.includes(id))) }}
      pagination={{ current: page, total, pageSize: 10, onChange: setPage }} />
  </Modal>;
}
