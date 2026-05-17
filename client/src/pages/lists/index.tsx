import { useState, useEffect, useCallback } from "react";
import {
  Tabs, Card, Input, Button, Grid, Pagination, Modal, Form, Message,
  Typography, Empty, Tag, Space, Popconfirm,
} from "@arco-design/web-react";
import { IconPlus, IconEdit, IconDelete } from "@arco-design/web-react/icon";
import { useNavigate } from "react-router-dom";
import { problemListApi } from "../../api/problem-list";
import { useAuthStore } from "../../stores/auth";

const { Row, Col } = Grid;
const { Title, Paragraph, Text } = Typography;

export default function ProblemListsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState("public");
  const [publicData, setPublicData] = useState<any[]>([]);
  const [publicTotal, setPublicTotal] = useState(0);
  const [publicPage, setPublicPage] = useState(1);
  const [publicKeyword, setPublicKeyword] = useState("");
  const [publicLoading, setPublicLoading] = useState(false);

  const [myData, setMyData] = useState<any[]>([]);
  const [myTotal, setMyTotal] = useState(0);
  const [myPage, setMyPage] = useState(1);
  const [myLoading, setMyLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();

  const fetchPublic = useCallback(async (p = publicPage, keyword = publicKeyword) => {
    setPublicLoading(true);
    try {
      const res: any = await problemListApi.getPublicLists({ page: p, pageSize: 12, keyword });
      setPublicData(res.items);
      setPublicTotal(res.total);
    } catch {
      Message.error("加载题单失败");
    } finally {
      setPublicLoading(false);
    }
  }, [publicPage, publicKeyword]);

  const fetchMy = useCallback(async (p = myPage) => {
    if (!user) return;
    setMyLoading(true);
    try {
      const res: any = await problemListApi.getMyLists({ page: p, pageSize: 12 });
      setMyData(res.items);
      setMyTotal(res.total);
    } catch {
      Message.error("加载我的题单失败");
    } finally {
      setMyLoading(false);
    }
  }, [myPage, user]);

  useEffect(() => {
    if (activeTab === "public") {
      fetchPublic(1);
    } else {
      fetchMy(1);
    }
  }, [activeTab]);

  const handlePublicSearch = () => {
    setPublicPage(1);
    fetchPublic(1, publicKeyword);
  };

  const handleCreate = () => {
    setEditingId(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (item: any, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setEditingId(item.id);
    form.setFieldsValue({ title: item.title, description: item.description });
    setModalVisible(true);
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await problemListApi.delete(id);
      Message.success("删除成功");
      fetchMy(myPage);
    } catch {
      Message.error("删除失败");
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      if (editingId) {
        await problemListApi.update(editingId, values);
        Message.success("修改成功");
      } else {
        await problemListApi.create({ ...values, isPublic: false });
        Message.success("创建成功");
      }
      setModalVisible(false);
      fetchMy(1);
      setMyPage(1);
    } catch {
      // validation failed or API error
    }
  };

  const renderCards = (data: any[], showActions = false) => {
    if (data.length === 0) {
      return <Empty description="暂无题单" />;
    }
    return (
      <Row gutter={[16, 16]}>
        {data.map((item) => (
          <Col key={item.id} span={8}>
            <Card
              hoverable
              style={{ cursor: "pointer", height: "100%" }}
              onClick={() => navigate(`/lists/${item.id}`)}
            >
              <Title heading={6} style={{ marginBottom: 8 }}>{item.title}</Title>
              <Paragraph type="secondary" ellipsis={{ rows: 2 }}>
                {item.description || "暂无简介"}
              </Paragraph>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <Space>
                  <Tag color="blue">{item._count?.items ?? 0} 题</Tag>
                  <Text type="secondary">{item.creator?.username}</Text>
                </Space>
                {showActions && (
                  <Space>
                    <Button
                      type="text"
                      size="mini"
                      icon={<IconEdit />}
                      onClick={(e: any) => handleEdit(item, e)}
                    />
                    <Popconfirm
                      title="确定删除此题单？"
                      onOk={(e) => handleDelete(item.id, e!)}
                      onCancel={(e) => e?.stopPropagation()}
                    >
                      <Button
                        type="text"
                        size="mini"
                        status="danger"
                        icon={<IconDelete />}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Popconfirm>
                  </Space>
                )}
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    );
  };

  return (
    <div>
      <Title heading={4} style={{ marginBottom: 16 }}>题单</Title>

      <Tabs activeTab={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane key="public" title="公共题单">
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Input.Search
                placeholder="搜索题单"
                value={publicKeyword}
                onChange={setPublicKeyword}
                onSearch={handlePublicSearch}
                style={{ width: 300 }}
              />
            </Space>
          </div>
          <div style={{ minHeight: 300 }}>
            {publicLoading ? (
              <div style={{ textAlign: "center", padding: 80 }}>加载中...</div>
            ) : (
              renderCards(publicData)
            )}
          </div>
          {publicTotal > 12 && (
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <Pagination
                current={publicPage}
                pageSize={12}
                total={publicTotal}
                onChange={(p) => { setPublicPage(p); fetchPublic(p, publicKeyword); }}
              />
            </div>
          )}
        </Tabs.TabPane>

        <Tabs.TabPane key="mine" title="我的题单">
          {!user ? (
            <div style={{ textAlign: "center", padding: 80 }}>
              <Text type="secondary">请先登录查看我的题单</Text>
              <div style={{ marginTop: 16 }}>
                <Button type="primary" onClick={() => navigate("/login")}>去登录</Button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 16, textAlign: "right" }}>
                <Button type="primary" icon={<IconPlus />} onClick={handleCreate}>
                  新建题单
                </Button>
              </div>
              <div style={{ minHeight: 300 }}>
                {myLoading ? (
                  <div style={{ textAlign: "center", padding: 80 }}>加载中...</div>
                ) : (
                  renderCards(myData, true)
                )}
              </div>
              {myTotal > 12 && (
                <div style={{ marginTop: 16, textAlign: "center" }}>
                  <Pagination
                    current={myPage}
                    pageSize={12}
                    total={myTotal}
                    onChange={(p) => { setMyPage(p); fetchMy(p); }}
                  />
                </div>
              )}
            </>
          )}
        </Tabs.TabPane>
      </Tabs>

      <Modal
        title={editingId ? "编辑题单" : "新建题单"}
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        unmountOnExit
      >
        <Form form={form} layout="vertical">
          <Form.Item field="title" label="题单标题" rules={[{ required: true, message: "请输入标题" }]}>
            <Input placeholder="请输入题单标题" maxLength={50} />
          </Form.Item>
          <Form.Item field="description" label="题单简介">
            <Input.TextArea placeholder="请输入题单简介" maxLength={200} autoSize={{ minRows: 3 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
