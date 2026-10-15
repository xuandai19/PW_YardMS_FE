import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Typography, message } from 'antd';
import { Client } from '@stomp/stompjs';
import { api } from '../services/api';
import { ACCESS_TOKEN_KEY } from '../services/api';

export function DashboardPage() {
  const [dashboard, setDashboard] = useState({
    vehiclesInYard: 0,
    vehiclesInTrip: 0,
    activeAlerts: 0,
    outstandingDebt: 0,
  });

  useEffect(() => {
    const load = () => api.get('/reports/dashboard')
      .then(response => setDashboard(response.data.data))
      .catch(() => message.error('Không thể tải dashboard'));
    void load();
    const base = api.defaults.baseURL ?? window.location.origin;
    const client = new Client({
      webSocketFactory: () => new WebSocket(`${new URL(base).origin.replace(/^http/, 'ws')}/ws`),
      connectHeaders: { Authorization: `Bearer ${localStorage.getItem(ACCESS_TOKEN_KEY) ?? ''}` },
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe('/topic/dashboard', frame => setDashboard(JSON.parse(frame.body)));
      },
      onStompError: () => message.error('Kết nối dashboard realtime thất bại'),
    });
    client.activate();
    return () => { void client.deactivate(); };
  }, []);

  return (
    <div>
      <Typography.Title level={2}>Dashboard</Typography.Title>
      <Typography.Paragraph type="secondary">
        Dữ liệu vận hành được làm mới tự động mỗi 30 giây.
      </Typography.Paragraph>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}><Card><Statistic title="Xe trong bãi" value={dashboard.vehiclesInYard} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="Xe đang vận chuyển" value={dashboard.vehiclesInTrip} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="Cảnh báo" value={dashboard.activeAlerts} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="Công nợ còn lại" value={dashboard.outstandingDebt} precision={2} /></Card></Col>
      </Row>
    </div>
  );
}
