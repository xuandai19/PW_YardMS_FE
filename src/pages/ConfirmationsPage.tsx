import { Alert, Button, Card, Input, message, Select, Space, Table, Tag, Typography, Upload } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UploadOutlined } from '@ant-design/icons';
import { Client } from '@stomp/stompjs';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { ACCESS_TOKEN_KEY, api } from '../services/api';

type Confirmation = {
  id: string;
  tripId: string;
  confirmationType: 'DEPARTURE' | 'ARRIVAL';
  status: string;
  requestedAt: string;
  dueAt: string;
  confirmedAt?: string;
  signatureUrl?: string;
};
type ConfirmationAlert = { id: string; message: string; createdAt: string; acknowledged: boolean };
const { Title, Text } = Typography;

function errorText(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) return error.response?.data?.message ?? 'Thao tác thất bại';
  return error instanceof Error ? error.message : 'Thao tác thất bại';
}

export default function ConfirmationsPage() {
  const [tripId, setTripId] = useState('');
  const [type, setType] = useState<'DEPARTURE' | 'ARRIVAL'>('DEPARTURE');
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [alerts, setAlerts] = useState<ConfirmationAlert[]>([]);

  const load = useCallback(async () => {
    try {
      const [alertResponse, confirmationResponse] = await Promise.all([
        api.get('/confirmations/alerts'),
        tripId ? api.get('/confirmations', { params: { tripId } }) : Promise.resolve({ data: { data: [] } }),
      ]);
      setAlerts(alertResponse.data.data);
      setConfirmations(confirmationResponse.data.data);
    } catch (error) {
      message.error(errorText(error));
    }
  }, [tripId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const base = api.defaults.baseURL ?? window.location.origin;
    const client = new Client({
      webSocketFactory: () => new WebSocket(`${new URL(base).origin.replace(/^http/, 'ws')}/ws`),
      connectHeaders: { Authorization: `Bearer ${localStorage.getItem(ACCESS_TOKEN_KEY) ?? ''}` },
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe('/topic/driver-confirmation-alerts', (frame) => {
          const alert = JSON.parse(frame.body) as ConfirmationAlert;
          setAlerts((previous) => [alert, ...previous].slice(0, 100));
          message.warning(alert.message);
        });
        client.subscribe('/topic/driver-confirmations', () => void load());
      },
      onStompError: (frame) => message.error(frame.headers.message ?? 'Kết nối cảnh báo xác nhận thất bại'),
    });
    client.activate();
    return () => { void client.deactivate(); };
  }, [load]);

  const request = async () => {
    if (!tripId.trim()) {
      message.warning('Nhập mã chuyến đi');
      return;
    }
    try {
      await api.post(`/confirmations/trips/${tripId}`, { confirmationType: type });
      message.success('Đã tạo yêu cầu xác nhận với SLA 30 phút');
      await load();
    } catch (error) {
      message.error(errorText(error));
    }
  };

  const confirm = async (id: string) => {
    try {
      await api.post(`/confirmations/${id}/confirm`);
      message.success('Đã ghi nhận xác nhận tài xế');
      await load();
    } catch (error) {
      message.error(errorText(error));
    }
  };

  const uploadSignature = async (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    try {
      await api.post(`/confirmations/${id}/signature`, form);
      message.success('Đã lưu ảnh chữ ký');
      await load();
    } catch (error) {
      message.error(errorText(error));
    }
  };

  const columns: ColumnsType<Confirmation> = [
    { title: 'Sự kiện', dataIndex: 'confirmationType', key: 'type',
      render: (value: string) => value === 'DEPARTURE' ? 'Xác nhận xuất phát' : 'Xác nhận đến nơi' },
    { title: 'Yêu cầu lúc', dataIndex: 'requestedAt', key: 'requestedAt',
      render: (value: string) => new Date(value).toLocaleString('vi-VN') },
    { title: 'Hạn SLA', dataIndex: 'dueAt', key: 'dueAt',
      render: (value: string) => new Date(value).toLocaleString('vi-VN') },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (value: string) =>
      <Tag color={value === 'CONFIRMED' ? 'green' : value === 'OVERDUE' || value === 'LATE' ? 'red' : 'processing'}>{value}</Tag> },
    { title: 'Xác nhận lúc', dataIndex: 'confirmedAt', key: 'confirmedAt',
      render: (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : '—' },
    { title: 'Chữ ký', key: 'signature', render: (_, row) => row.signatureUrl
      ? <Text type="secondary">Đã lưu</Text>
      : <Upload accept="image/png,image/jpeg" maxCount={1} showUploadList={false}
          beforeUpload={(file) => { void uploadSignature(row.id, file); return false; }}>
          <Button icon={<UploadOutlined />}>Tải ảnh</Button>
        </Upload> },
    { title: 'Thao tác', key: 'action', render: (_, row) =>
      row.status === 'CONFIRMED' || row.status === 'LATE' ? '—'
        : <Button type="primary" onClick={() => void confirm(row.id)}>Xác nhận</Button> },
  ];

  return (
    <Space direction="vertical" size="large" className="w-full">
      <Title level={3}>Xác nhận tài xế và SLA</Title>
      <Card title="Tạo yêu cầu xác nhận">
        <Space.Compact className="w-full">
          <Input value={tripId} onChange={(event) => setTripId(event.target.value)}
            onPressEnter={() => void load()} placeholder="Mã chuyến đi (UUID)" />
          <Select value={type} onChange={setType} options={[
            { value: 'DEPARTURE', label: 'Xuất phát' },
            { value: 'ARRIVAL', label: 'Đến nơi' },
          ]} />
          <Button type="primary" onClick={() => void request()}>Tạo yêu cầu · 30 phút</Button>
        </Space.Compact>
        <Button className="mt-3" onClick={() => void load()}>Tải chuyến đi</Button>
      </Card>
      <Card title="Danh sách xác nhận">
        <Table rowKey="id" columns={columns} dataSource={confirmations} pagination={{ pageSize: 8 }} />
      </Card>
      <Card title="Cảnh báo quá hạn">
        {alerts.some((alert) => !alert.acknowledged) &&
          <Alert className="mb-3" type="warning" showIcon message="Có xác nhận tài xế quá hạn SLA" />}
        <Table rowKey="id" dataSource={alerts} pagination={{ pageSize: 6 }}
          columns={[
            { title: 'Cảnh báo', dataIndex: 'message', key: 'message' },
            { title: 'Thời điểm', dataIndex: 'createdAt', key: 'createdAt',
              render: (value: string) => new Date(value).toLocaleString('vi-VN') },
            { title: 'Trạng thái', dataIndex: 'acknowledged', key: 'acknowledged',
              render: (value: boolean) => <Tag color={value ? 'green' : 'red'}>{value ? 'Đã xử lý' : 'Mới'}</Tag> },
          ]} />
      </Card>
    </Space>
  );
}
