import { useState, useEffect } from "react";
import { Tabs, Card, Statistic, Grid, Table, Button, Modal, Form, Input, InputNumber, Switch, Message, Space, Typography, Badge, Tag, Select, DatePicker } from "@arco-design/web-react";
import { adminAiApi } from "../../../api/adminAi";
import { IconCheckCircleFill, IconCloseCircleFill } from "@arco-design/web-react/icon";

const { Row, Col } = Grid;

export default function AdminAiPage() {
  return (
    <Tabs defaultActiveTab="stats" type="card-gutter">
      <Tabs.TabPane key="stats" title="用量统计">
        <StatsPanel />
      </Tabs.TabPane>
      <Tabs.TabPane key="quotas" title="额度与用户管理">
        <QuotasPanel />
      </Tabs.TabPane>
      <Tabs.TabPane key="providers" title="API 提供商配置">
        <ProvidersPanel />
      </Tabs.TabPane>
    </Tabs>
  );
}

// ─── 统计面板 ───
function StatsPanel() {
  const [stats, setStats] = useState<any>({ todayCalls: 0, todayTokens: 0, totalConversations: 0, totalMessages: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  const [logs, setLogs] = useState<any[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  
  const [filters, setFilters] = useState({ provider: '', model: '', startDate: '', endDate: '' });

  useEffect(() => {
    adminAiApi.getStats().then((res: any) => {
      setStats(res);
      setLoadingStats(false);
    });
  }, []);

  const fetchLogs = (page = pagination.current, pageSize = pagination.pageSize, f = filters) => {
    setLoadingLogs(true);
    adminAiApi.getUsageLogs({ page, pageSize, ...f }).then((res: any) => {
      setLogs(res.logs);
      setTotalLogs(res.total);
      setPagination({ current: page, pageSize });
      setLoadingLogs(false);
    });
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const logColumns = [
    { title: '时间', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
    { title: '供应商', dataIndex: 'providerName' },
    { title: '计费模型', dataIndex: 'modelName', render: (v: string) => <Tag color="gray">{v}</Tag> },
    { title: '输入', dataIndex: 'inputTokens', render: (v: number) => v.toLocaleString() },
    { title: '输出', dataIndex: 'outputTokens', render: (v: number) => v.toLocaleString() },
    { title: '总Tokens', dataIndex: 'totalTokens', render: (v: number) => <span style={{ fontWeight: 600 }}>{v.toLocaleString()}</span> },
    { title: '用时', dataIndex: 'timeUsedMs', render: (v: number) => `${(v / 1000).toFixed(1)}s` },
    { title: '状态', dataIndex: 'status', render: (v: number) => <span style={{ color: v === 200 ? 'var(--color-success-light-4)' : 'var(--color-danger-light-4)' }}>{v}</span> },
    { title: '来源', dataIndex: 'source' }
  ];

  const handleDateChange = (dateString: string[]) => {
    const [startDate, endDate] = dateString;
    const newFilters = { ...filters, startDate, endDate };
    setFilters(newFilters);
    fetchLogs(1, pagination.pageSize, newFilters);
  };

  return (
    <div style={{ padding: "24px 0" }}>
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card loading={loadingStats} bordered={false} style={{ borderRadius: 12, boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
            <Statistic title="今日 Tokens 数" value={stats.todayTokens} groupSeparator style={{ fontWeight: 'bold' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loadingStats} bordered={false} style={{ borderRadius: 12, boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
            <Statistic title="今日请求数" value={stats.todayCalls} groupSeparator style={{ fontWeight: 'bold' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loadingStats} bordered={false} style={{ borderRadius: 12, boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
            <Statistic title="总 Tokens 数" value={stats.totalTokens} groupSeparator style={{ fontWeight: 'bold' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loadingStats} bordered={false} style={{ borderRadius: 12, boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
            <Statistic title="总请求数" value={stats.totalMessages} groupSeparator style={{ fontWeight: 'bold' }} />
          </Card>
        </Col>
      </Row>

      <Card title="调用明细日志" bordered={false} style={{ borderRadius: 12, boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input.Search 
            placeholder="搜索供应商..." 
            allowClear 
            onSearch={(v) => { setFilters(prev => ({ ...prev, provider: v })); fetchLogs(1, pagination.pageSize, { ...filters, provider: v }); }} 
            style={{ width: 160 }}
          />
          <Input.Search 
            placeholder="搜索模型..." 
            allowClear 
            onSearch={(v) => { setFilters(prev => ({ ...prev, model: v })); fetchLogs(1, pagination.pageSize, { ...filters, model: v }); }} 
            style={{ width: 160 }}
          />
          
          <Button type="secondary" onClick={() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const end = new Date(today);
            end.setHours(23, 59, 59, 999);
            handleDateChange([today.toISOString(), end.toISOString()]);
          }}>本日</Button>
          
          <Button type="secondary" onClick={() => {
            const today = new Date();
            const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)));
            startOfWeek.setHours(0, 0, 0, 0);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            handleDateChange([startOfWeek.toISOString(), endOfWeek.toISOString()]);
          }}>本周</Button>
          
          <Button type="secondary" onClick={() => {
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
            handleDateChange([startOfMonth.toISOString(), endOfMonth.toISOString()]);
          }}>本月</Button>

          <DatePicker.RangePicker 
            style={{ width: 260 }} 
            value={filters.startDate && filters.endDate ? [filters.startDate, filters.endDate] : undefined}
            onChange={(dateString) => handleDateChange(dateString)}
            allowClear
          />

          <Button type="secondary" onClick={() => {
            setFilters({ provider: '', model: '', startDate: '', endDate: '' });
            fetchLogs(1, pagination.pageSize, { provider: '', model: '', startDate: '', endDate: '' });
          }}>清除筛选</Button>

          <Button type="primary" onClick={() => fetchLogs()}>刷新记录</Button>
        </Space>
        
        <Table 
          columns={logColumns} 
          data={logs} 
          rowKey="id" 
          loading={loadingLogs}
          pagination={{
            total: totalLogs,
            current: pagination.current,
            pageSize: pagination.pageSize,
            onChange: (page, pageSize) => fetchLogs(page, pageSize)
          }}
        />
      </Card>
    </div>
  );
}

// ─── 额度与用户管理 ───
function QuotasPanel() {
  const [data, setData] = useState<any[]>([]);
  const [globalLimit, setGlobalLimit] = useState(100);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchUsername, setSearchUsername] = useState('');

  const [form] = Form.useForm();
  const [globalForm] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);

  const fetchData = (page = pagination.current, username = searchUsername) => {
    setLoading(true);
    adminAiApi.getUsersQuotas({ page, pageSize: pagination.pageSize, username }).then((res: any) => {
      setData(res.users);
      setGlobalLimit(res.globalLimit);
      setPagination({ ...pagination, current: page, total: res.total });
      globalForm.setFieldsValue({ globalLimit: res.globalLimit });
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGlobalLimitSubmit = async (values: any) => {
    try {
      await adminAiApi.setGlobalLimit(values.globalLimit);
      Message.success('全局默认额度已更新');
      fetchData();
    } catch (err: any) {
      Message.error(err.response?.data?.message || '更新失败');
    }
  };

  const handleEditUser = (record: any) => {
    setEditingUserId(record.id);
    form.setFieldsValue({
      aiDailyLimit: record.aiDailyLimit,
    });
    setModalVisible(true);
  };

  const handleModalSubmit = async () => {
    try {
      const values = await form.validate();
      if (editingUserId) {
        await adminAiApi.updateUserQuota(editingUserId, values.aiDailyLimit ?? null);
        Message.success('更新成功');
        setModalVisible(false);
        fetchData();
      }
    } catch (err: any) {
      Message.error(err.response?.data?.message || '更新失败');
    }
  };

  const columns = [
    { title: '用户ID', dataIndex: 'id' },
    { title: '用户名', dataIndex: 'username' },
    { title: '角色', dataIndex: 'role' },
    { 
      title: '今日已用', 
      dataIndex: 'usedToday',
      render: (val: number, record: any) => {
        const isLimit = val >= record.effectiveLimit;
        return <Typography.Text type={isLimit ? 'error' : undefined}>{val} / {record.effectiveLimit}</Typography.Text>;
      }
    },
    { 
      title: '专属额度', 
      dataIndex: 'aiDailyLimit', 
      render: (val: number | null) => val !== null ? <Badge count={val} status="processing" /> : <Typography.Text type="secondary">默认 ({globalLimit})</Typography.Text> 
    },
    {
      title: '操作',
      render: (_: any, record: any) => (
        <Button type="text" size="small" onClick={() => handleEditUser(record)}>修改额度</Button>
      )
    }
  ];

  return (
    <div style={{ padding: "24px 0" }}>
      <Card title="全局设置" style={{ marginBottom: 24 }}>
        <Form form={globalForm} layout="inline" onSubmit={handleGlobalLimitSubmit}>
          <Form.Item label="每日默认请求额度" field="globalLimit">
            <InputNumber min={0} style={{ width: 160 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">保存</Button>
          </Form.Item>
        </Form>
      </Card>
      
      <Card title="用户专属额度配置">
        <div style={{ marginBottom: 16 }}>
          <Input.Search 
            placeholder="搜索用户名" 
            style={{ width: 300 }} 
            onSearch={(val) => { setSearchUsername(val); fetchData(1, val); }} 
          />
        </div>
        <Table 
          loading={loading}
          columns={columns}
          data={data}
          rowKey="id"
          pagination={pagination}
          onChange={(pg) => fetchData(pg.current, searchUsername)}
        />
      </Card>

      <Modal
        title="设置用户专属额度"
        visible={modalVisible}
        onOk={handleModalSubmit}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item 
            label="自定义每日额度" 
            field="aiDailyLimit"
            extra="留空表示使用全局默认额度"
          >
            <InputNumber placeholder="输入专属额度..." min={0} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ─── API 提供商配置 ───
function ProvidersPanel() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();

  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);

  const fetchData = () => {
    setLoading(true);
    adminAiApi.getProviders().then((res: any) => {
      setData(res);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEdit = (record?: any) => {
    setFetchedModels([]);
    if (record) {
      setEditingId(record.id);
      form.setFieldsValue(record);
      if (record.modelName) {
        setFetchedModels([record.modelName]);
      }
    } else {
      setEditingId(null);
      form.resetFields();
      form.setFieldsValue({ apiBase: 'https://api.openai.com/v1', modelName: 'gpt-4o' });
      setFetchedModels(['gpt-4o']);
    }
    setModalVisible(true);
  };

  const handleFetchModels = async () => {
    const apiBase = form.getFieldValue('apiBase');
    const apiKey = form.getFieldValue('apiKey');
    if (!apiBase || !apiKey) {
      Message.warning('请先填写 API Base URL 和 API Key');
      return;
    }
    setFetchingModels(true);
    try {
      const list: any = await adminAiApi.fetchAvailableModels(apiBase, apiKey);
      setFetchedModels(list);
      Message.success(`成功获取 ${list.length} 个模型`);
    } catch (err: any) {
      Message.error(err.response?.data?.message || '获取模型列表失败，请检查配置和网络');
    } finally {
      setFetchingModels(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await adminAiApi.deleteProvider(id);
      Message.success('删除成功');
      fetchData();
    } catch (err: any) {
      Message.error('删除失败');
    }
  };

  const handleActivate = async (id: number) => {
    try {
      await adminAiApi.activateProvider(id);
      Message.success('已切换当前提供商');
      fetchData();
    } catch (err: any) {
      Message.error('切换失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      if (editingId) {
        await adminAiApi.updateProvider(editingId, values);
      } else {
        await adminAiApi.addProvider(values);
      }
      Message.success('保存成功');
      setModalVisible(false);
      fetchData();
    } catch (err: any) {
      Message.error('保存失败');
    }
  };

  const columns = [
    { title: '提供商名称', dataIndex: 'name' },
    { title: '模型 (Model)', dataIndex: 'modelName' },
    { title: 'API Base', dataIndex: 'apiBase', render: (v: string) => <Typography.Text ellipsis={{ showTooltip: true }} style={{ width: 200 }}>{v}</Typography.Text> },
    { 
      title: '状态', 
      render: (_: any, record: any) => (
        record.isActive ? 
          <Tag color="green" icon={<IconCheckCircleFill />}>当前使用</Tag> : 
          <Tag color="gray" icon={<IconCloseCircleFill />}>未激活</Tag>
      )
    },
    {
      title: '操作',
      render: (_: any, record: any) => (
        <Space>
          {!record.isActive && <Button size="small" type="primary" onClick={() => handleActivate(record.id)}>设为当前</Button>}
          <Button size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Button size="small" status="danger" onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: "24px 0" }}>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => handleEdit()}>添加提供商</Button>
      </div>
      <Table loading={loading} columns={columns} data={data} rowKey="id" pagination={false} />

      <Modal
        title={editingId ? '编辑提供商' : '添加提供商'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="名称 (如: DeepSeek, OpenAI)" field="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="API Base URL (OpenAI兼容)" field="apiBase" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="API Key" field="apiKey" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item label="模型名称 (Model)" required>
            <Input.Group compact style={{ display: 'flex' }}>
              <Form.Item field="modelName" rules={[{ required: true }]} noStyle>
                <Select
                  allowCreate
                  placeholder="选择或输入模型名称..."
                  style={{ flex: 1 }}
                  options={fetchedModels.map(m => ({ label: m, value: m }))}
                />
              </Form.Item>
              <Button type="primary" onClick={handleFetchModels} loading={fetchingModels} style={{ marginLeft: 8 }}>
                获取模型列表
              </Button>
            </Input.Group>
          </Form.Item>
          <Form.Item label="设为当前使用" field="isActive" triggerPropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
