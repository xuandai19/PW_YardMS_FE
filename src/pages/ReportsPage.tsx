import { useEffect, useState } from 'react';
import { Button, Card, Col, DatePicker, Form, Input, Row, Space, Statistic, Table, message } from 'antd';
import { Client } from '@stomp/stompjs';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../services/api';
import { ACCESS_TOKEN_KEY } from '../services/api';

type MonthlyReport = {
  year: number;
  month: number;
  revenue: number;
  invoiceCount: number;
  trips: number;
  vehicleEntries: number;
  vehiclesCurrentlyInYards: number;
  yardCapacity: number;
  occupancyPercent: number;
  outstandingDebt: number;
};

type QuarterlyReport = {
  year: number;
  quarter: number;
  revenue: number;
  invoiceCount: number;
  topPartners: { partnerId: string; revenue: number }[];
  serviceOrderCount: number;
  completedServiceOrders: number;
  completedServiceRevenue: number;
};

type Dashboard = {
  vehiclesInYard: number;
  vehiclesInTrip: number;
  activeAlerts: number;
  outstandingDebt: number;
  generatedAt: string;
};

type RevenuePoint = { month: string; revenue: number };

export default function ReportsPage() {
  const today = new Date();
  const [monthly, setMonthly] = useState<MonthlyReport>();
  const [quarterly, setQuarterly] = useState<QuarterlyReport>();
  const [dashboard, setDashboard] = useState<Dashboard>();
  const [trend, setTrend] = useState<RevenuePoint[]>([]);
  const [periodForm] = Form.useForm();
  const [reconciliation, setReconciliation] = useState<Record<string, unknown>>();

  const load = async () => {
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const quarter = Math.floor((month - 1) / 3) + 1;
    const [monthlyResponse, quarterlyResponse, dashboardResponse, trendResponse] = await Promise.all([
      api.get('/reports/monthly', { params: { year, month } }),
      api.get('/reports/quarterly', { params: { year, quarter } }),
      api.get('/reports/dashboard'),
      api.get('/reports/revenue-trend', { params: { year } }),
    ]);
    setMonthly(monthlyResponse.data.data);
    setQuarterly(quarterlyResponse.data.data);
    setDashboard(dashboardResponse.data.data);
    setTrend(trendResponse.data.data);
  };

  useEffect(() => {
    void load().catch(() => message.error('Không thể tải báo cáo'));
    const base = api.defaults.baseURL ?? window.location.origin;
    const client = new Client({
      webSocketFactory: () => new WebSocket(`${new URL(base).origin.replace(/^http/, 'ws')}/ws`),
      connectHeaders: { Authorization: `Bearer ${localStorage.getItem(ACCESS_TOKEN_KEY) ?? ''}` },
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe('/topic/dashboard', frame => setDashboard(JSON.parse(frame.body) as Dashboard));
      },
      onStompError: () => message.error('Kết nối dashboard realtime thất bại'),
    });
    client.activate();
    return () => { void client.deactivate(); };
  }, []);

  const exportReport = async (format: 'xlsx' | 'pdf', values: { from: { format: (format: string) => string }; to: { format: (format: string) => string } }) => {
    try {
      const response = await api.get(`/reports/export.${format}`, {
        params: { from: values.from.format('YYYY-MM-DD'), to: values.to.format('YYYY-MM-DD') },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `yms-report.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error('Không thể xuất báo cáo');
    }
  };

  const reconcile = async (values: { partnerAId: string; partnerCId: string; from: { format: (format: string) => string }; to: { format: (format: string) => string } }) => {
    try {
      const response = await api.get('/finance/reconcile', { params: {
        partnerAId: values.partnerAId,
        partnerCId: values.partnerCId,
        from: values.from.format('YYYY-MM-DD'),
        to: values.to.format('YYYY-MM-DD'),
      } });
      setReconciliation(response.data.data);
    } catch {
      message.error('Không thể đối soát công nợ');
    }
  };

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Báo cáo tài chính và vận hành</h2>
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="Xe trong bãi" value={dashboard?.vehiclesInYard ?? 0} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="Xe đang vận chuyển" value={dashboard?.vehiclesInTrip ?? 0} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="Cảnh báo đang mở" value={dashboard?.activeAlerts ?? 0} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="Công nợ còn lại" value={dashboard?.outstandingDebt ?? 0} precision={2} /></Card></Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Báo cáo tháng">
            <Row gutter={16}>
              <Col span={12}><Statistic title="Doanh thu" value={monthly?.revenue ?? 0} precision={2} /></Col>
              <Col span={12}><Statistic title="Hóa đơn" value={monthly?.invoiceCount ?? 0} /></Col>
              <Col span={12}><Statistic title="Lượt xe" value={monthly?.vehicleEntries ?? 0} /></Col>
              <Col span={12}><Statistic title="Lấp đầy bãi" value={monthly?.occupancyPercent ?? 0} suffix="%" precision={2} /></Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Báo cáo quý">
            <Row gutter={16} className="mb-4">
              <Col span={12}><Statistic title="Doanh thu" value={quarterly?.revenue ?? 0} precision={2} /></Col>
              <Col span={12}><Statistic title="DV hoàn tất" value={quarterly?.completedServiceOrders ?? 0} /></Col>
            </Row>
            <Table size="small" rowKey="partnerId" pagination={false} dataSource={quarterly?.topPartners ?? []}
              columns={[{ title: 'Đối tác', dataIndex: 'partnerId' }, { title: 'Doanh thu', dataIndex: 'revenue', render: (value: number) => value.toLocaleString('vi-VN') }]} />
          </Card>
        </Col>
        <Col span={24}>
          <Card title="Xu hướng doanh thu theo tháng">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={value => Number(value).toLocaleString('vi-VN')} />
                  <Bar dataKey="revenue" name="Doanh thu" fill="#1677ff" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col span={24}>
          <Card title="Xuất báo cáo">
            <Form form={periodForm} layout="inline" onFinish={values => void exportReport('xlsx', values)}>
              <Form.Item name="from" rules={[{ required: true }]}><DatePicker placeholder="Từ ngày" /></Form.Item>
              <Form.Item name="to" rules={[{ required: true }]}><DatePicker placeholder="Đến ngày" /></Form.Item>
              <Form.Item><Space>
                <Button type="primary" htmlType="submit">Xuất Excel</Button>
                <Button onClick={() => { const values = periodForm.getFieldsValue(); void periodForm.validateFields().then(() => exportReport('pdf', values)); }}>Xuất PDF</Button>
              </Space></Form.Item>
            </Form>
          </Card>
        </Col>
        <Col span={24}>
          <Card title="Đối soát A–C">
            <Form layout="inline" onFinish={reconcile}>
              <Form.Item name="partnerAId" rules={[{ required: true }]}><Input placeholder="UUID đối tác A" /></Form.Item>
              <Form.Item name="partnerCId" rules={[{ required: true }]}><Input placeholder="UUID đối tác C" /></Form.Item>
              <Form.Item name="from" rules={[{ required: true }]}><DatePicker placeholder="Từ ngày" /></Form.Item>
              <Form.Item name="to" rules={[{ required: true }]}><DatePicker placeholder="Đến ngày" /></Form.Item>
              <Form.Item><Button htmlType="submit" type="primary">Đối soát</Button></Form.Item>
            </Form>
            {reconciliation && <pre className="mt-4 overflow-auto">{JSON.stringify(reconciliation, null, 2)}</pre>}
          </Card>
        </Col>
      </Row>
      {dashboard?.generatedAt && <p className="mt-3 text-right text-xs text-gray-500">Cập nhật {new Date(dashboard.generatedAt).toLocaleTimeString('vi-VN')}</p>}
    </div>
  );
}
