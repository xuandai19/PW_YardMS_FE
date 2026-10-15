import { Client, type IMessage } from '@stomp/stompjs';
import {
  BellOutlined,
  CameraOutlined,
  CheckCircleOutlined,
  EditOutlined,
  EnvironmentOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  QrcodeOutlined,
  StopOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  notification as antdNotification,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Timeline,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  formatYardDuration,
  type PreNotification,
  type ServiceOption,
  type ServiceOrder,
  type Yard,
  type YardAlert,
  type YardHistoryEntry,
  type YardInventory,
} from './operations';

const { Title, Text } = Typography;

function apiError(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

function localDateTimeMin(): string {
  const date = new Date(Date.now() + 4 * 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function VehicleRegistrationTab() {
  const [form] = Form.useForm();
  const [partners, setPartners] = useState<{ id: string; name: string; code: string }[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [notifications, setNotifications] = useState<PreNotification[]>([]);
  const [saving, setSaving] = useState(false);
  const [qr, setQr] = useState<{ imageBase64: string; expiresAt: string; token: string }>();

  const load = useCallback(async () => {
    try {
      const [partnerResponse, serviceResponse, queueResponse] = await Promise.all([
        api.get('/partners'),
        api.get('/services', { params: { activeOnly: true } }),
        api.get('/vehicles/pre-notifications/waiting'),
      ]);
      setPartners(partnerResponse.data.data.filter((partner: { partnerType: string }) =>
        partner.partnerType === 'A'));
      setServices(serviceResponse.data.data);
      setNotifications(queueResponse.data.data);
    } catch (error) {
      message.error(apiError(error, 'Không thể tải dữ liệu đăng ký xe'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const register = async (values: {
    partnerAId: string;
    plateNumber: string;
    plannedArrival: string;
    driverName: string;
    driverPhone?: string;
    carrierCompany?: string;
    vehicleType?: string;
    serviceIds?: string[];
  }) => {
    setSaving(true);
    try {
      await api.post('/vehicles/pre-notifications', {
        ...values,
        plannedArrival: new Date(values.plannedArrival).toISOString(),
        serviceIds: values.serviceIds ?? [],
      });
      form.resetFields();
      message.success('Đã đăng ký xe và dịch vụ trước');
      await load();
    } catch (error) {
      message.error(apiError(error, 'Không thể đăng ký xe'));
    } finally {
      setSaving(false);
    }
  };

  const issueQr = async (id: string) => {
    try {
      const response = await api.post(`/vehicles/pre-notifications/${id}/qr`);
      setQr(response.data.data);
    } catch (error) {
      message.error(apiError(error, 'Không thể tạo QR cho xe'));
    }
  };

  const columns: ColumnsType<PreNotification> = [
    { title: 'Biển số', dataIndex: 'plateNumber', key: 'plateNumber' },
    { title: 'Tài xế', dataIndex: 'driverName', key: 'driverName' },
    {
      title: 'Dự kiến đến',
      dataIndex: 'plannedArrival',
      key: 'plannedArrival',
      render: (value: string) => new Date(value).toLocaleString('vi-VN'),
    },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (value: string) => <Tag color="blue">{value}</Tag> },
    {
      title: 'QR',
      key: 'qr',
      render: (_, record) => <Button icon={<QrcodeOutlined />} onClick={() => void issueQr(record.id)}>Tạo QR</Button>,
    },
  ];

  return (
    <Space direction="vertical" size="large" className="w-full">
      <Card title="Thông báo xe trước">
        <Form form={form} layout="vertical" onFinish={register}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="partnerAId" label="Đối tác A" rules={[{ required: true, message: 'Chọn đối tác A' }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={partners.map((partner) => ({
                    value: partner.id,
                    label: `${partner.code} — ${partner.name}`,
                  }))}
                  placeholder="Chọn đối tác"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="plateNumber" label="Biển số xe" rules={[{ required: true, message: 'Nhập biển số' }]}>
                <Input placeholder="Ví dụ: 51C12345" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="plannedArrival" label="Thời gian dự kiến đến" rules={[{ required: true, message: 'Chọn thời gian đến' }]}>
                <Input type="datetime-local" min={localDateTimeMin()} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="driverName" label="Tên tài xế" rules={[{ required: true, message: 'Nhập tên tài xế' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="driverPhone" label="Số điện thoại tài xế"><Input /></Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="carrierCompany" label="Đơn vị vận chuyển"><Input /></Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="vehicleType" label="Loại xe"><Input /></Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="serviceIds" label="Đăng ký dịch vụ trước">
                <Select
                  mode="multiple"
                  options={services.map((service) => ({
                    value: service.id,
                    label: `${service.name} — ${service.hourlyRate.toLocaleString('vi-VN')} / giờ`,
                  }))}
                  placeholder="Có thể chọn nhiều dịch vụ"
                />
              </Form.Item>
            </Col>
          </Row>
          <Button type="primary" htmlType="submit" loading={saving} icon={<PlusOutlined />}>
            Đăng ký xe
          </Button>
        </Form>
      </Card>
      <Card title="Danh sách xe chờ vào bãi">
        <Table rowKey="id" columns={columns} dataSource={notifications} pagination={{ pageSize: 8 }} />
      </Card>
      <Modal open={!!qr} title="QR xe vào bãi" footer={null} onCancel={() => setQr(undefined)}>
        {qr && (
          <div className="flex flex-col items-center gap-3">
            <img alt="QR xe" className="h-64 w-64" src={`data:image/png;base64,${qr.imageBase64}`} />
            <Text type="secondary">Hết hạn: {new Date(qr.expiresAt).toLocaleString('vi-VN')}</Text>
          </div>
        )}
      </Modal>
    </Space>
  );
}

function GateTab({ yards }: { yards: Yard[] }) {
  const [token, setToken] = useState('');
  const [vehicle, setVehicle] = useState<{
    preNotificationId: string;
    vehicleId: string;
    plateNumber: string;
    driverName: string;
    plannedArrival: string;
    partnerAId: string;
  }>();
  const [yardId, setYardId] = useState<string>();
  const [checking, setChecking] = useState(false);
  const [history, setHistory] = useState<YardHistoryEntry[]>([]);
  const scanBusy = useRef(false);
  const lastScannedToken = useRef('');

  const loadHistory = useCallback(async () => {
    try {
      const response = await api.get('/yard-logs');
      setHistory(response.data.data);
    } catch (error) {
      message.error(apiError(error, 'Không thể tải lịch sử ra vào bãi'));
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const scan = useCallback(async (value: string) => {
    if (scanBusy.current || value === lastScannedToken.current) return;
    scanBusy.current = true;
    lastScannedToken.current = value;
    setChecking(true);
    try {
      const response = await api.post('/yard-logs/scan', { token: value });
      setToken(value);
      setVehicle(response.data.data);
      message.success(`Đã nhận diện xe ${response.data.data.plateNumber}`);
    } catch (error) {
      message.error(apiError(error, 'QR không hợp lệ hoặc đã hết hạn'));
    } finally {
      scanBusy.current = false;
      setChecking(false);
    }
  }, []);

  const checkIn = async () => {
    if (!vehicle || !yardId) return;
    setChecking(true);
    try {
      await api.post('/yard-logs/check-in', { token, yardId });
      message.success(`Đã check-in xe ${vehicle.plateNumber}`);
      setVehicle(undefined);
      setToken('');
      setYardId(undefined);
      await loadHistory();
    } catch (error) {
      message.error(apiError(error, 'Không thể check-in xe'));
    } finally {
      setChecking(false);
    }
  };

  const checkOut = async (preNotificationId: string) => {
    try {
      const response = await api.post('/yard-logs/check-out', { preNotificationId });
      message.success(`Đã check-out. Thời gian lưu bãi: ${formatYardDuration(response.data.data.durationSeconds)}`);
      await loadHistory();
    } catch (error) {
      message.error(apiError(error, 'Không thể check-out xe'));
    }
  };

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('qr-reader', {
      fps: 10,
      qrbox: { width: 240, height: 240 },
    }, false);
    scanner.render((decodedText) => void scan(decodedText), () => undefined);
    return () => {
      void scanner.clear().catch((error: unknown) => {
        message.error(apiError(error, 'Không thể đóng trình quét QR'));
      });
    };
  }, [scan]);

  const historyColumns: ColumnsType<YardHistoryEntry> = [
    { title: 'Xe', dataIndex: 'plateNumber', key: 'plateNumber', render: (value, row) => `${value} — ${row.driverName}` },
    { title: 'Bãi', dataIndex: 'yardCode', key: 'yardCode', render: (value, row) => `${value} — ${row.yardName}` },
    {
      title: 'Vào bãi',
      dataIndex: 'checkInAt',
      key: 'checkInAt',
      render: (value: string) => new Date(value).toLocaleString('vi-VN'),
    },
    {
      title: 'Ra bãi',
      dataIndex: 'checkOutAt',
      key: 'checkOutAt',
      render: (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : <Tag color="processing">Đang trong bãi</Tag>,
    },
    {
      title: 'Thời gian',
      dataIndex: 'durationSeconds',
      key: 'durationSeconds',
      render: (value?: number) => value == null ? '—' : formatYardDuration(value),
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_, row) => row.checkOutAt ? null : (
        <Button danger onClick={() => void checkOut(row.preNotificationId)}>Check-out</Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="large" className="w-full">
      <Card title="Quét QR tại cổng">
        <Row gutter={24}>
          <Col xs={24} lg={12}>
            <div id="qr-reader" className="min-h-64 w-full" />
            <Text type="secondary"><CameraOutlined /> Cho phép camera hoặc nhập QR bên dưới.</Text>
            <Input.Search
              className="mt-3"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              onSearch={(value) => {
                lastScannedToken.current = '';
                void scan(value);
              }}
              enterButton="Kiểm tra QR"
              placeholder="Dán nội dung QR để kiểm tra"
            />
          </Col>
          <Col xs={24} lg={12}>
            {checking && <Spin />}
            {vehicle ? (
              <Space direction="vertical" className="w-full">
                <Alert type="success" showIcon message="QR hợp lệ — xác nhận thông tin xe" />
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label="Biển số">{vehicle.plateNumber}</Descriptions.Item>
                  <Descriptions.Item label="Tài xế">{vehicle.driverName}</Descriptions.Item>
                  <Descriptions.Item label="Dự kiến đến">
                    {new Date(vehicle.plannedArrival).toLocaleString('vi-VN')}
                  </Descriptions.Item>
                </Descriptions>
                <Select
                  value={yardId}
                  onChange={setYardId}
                  className="w-full"
                  placeholder="Chọn bãi tiếp nhận"
                  options={yards.filter((yard) => yard.status === 'ACTIVE').map((yard) => ({
                    value: yard.id,
                    label: `${yard.code} — ${yard.name}`,
                  }))}
                />
                <Button type="primary" icon={<CheckCircleOutlined />} loading={checking}
                  disabled={!yardId} onClick={() => void checkIn()}>
                  Xác nhận check-in
                </Button>
              </Space>
            ) : (
              <Empty description="Quét mã QR để xem thông tin xe" />
            )}
          </Col>
        </Row>
      </Card>
      <Card title="Lịch sử ra vào bãi">
        <Table rowKey="id" columns={historyColumns} dataSource={history} pagination={{ pageSize: 8 }} />
      </Card>
    </Space>
  );
}

function ServiceDispatchTab() {
  const [notifications, setNotifications] = useState<PreNotification[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [vehicleId, setVehicleId] = useState<string>();
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const loadOptions = useCallback(async () => {
    try {
      const [queue, catalog] = await Promise.all([
        api.get('/vehicles/pre-notifications/in-yard'),
        api.get('/services', { params: { activeOnly: true } }),
      ]);
      setNotifications(queue.data.data);
      setServices(catalog.data.data);
    } catch (error) {
      message.error(apiError(error, 'Không thể tải dữ liệu điều phối dịch vụ'));
    }
  }, []);

  const loadOrders = useCallback(async (id?: string) => {
    if (!id) {
      setOrders([]);
      return;
    }
    try {
      const response = await api.get('/service-orders', { params: { vehicleId: id } });
      setOrders(response.data.data);
    } catch (error) {
      message.error(apiError(error, 'Không thể tải tiến độ dịch vụ'));
    }
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    void loadOrders(vehicleId);
  }, [loadOrders, vehicleId]);

  const assign = async () => {
    const notification = notifications.find((item) => item.vehicleId === vehicleId);
    if (!notification || selectedServices.length === 0) return;
    setLoading(true);
    try {
      await api.post('/service-orders', {
        preNotificationId: notification.id,
        serviceIds: selectedServices,
      });
      setSelectedServices([]);
      message.success('Đã gán dịch vụ cho xe');
      await loadOrders(vehicleId);
    } catch (error) {
      message.error(apiError(error, 'Không thể gán dịch vụ'));
    } finally {
      setLoading(false);
    }
  };

  const transition = async (order: ServiceOrder, action: 'start' | 'end') => {
    try {
      await api.post(`/service-orders/${order.id}/${action}`);
      message.success(action === 'start' ? 'Đã bắt đầu dịch vụ' : 'Đã hoàn tất dịch vụ');
      await loadOrders(vehicleId);
    } catch (error) {
      message.error(apiError(error, 'Không thể cập nhật dịch vụ'));
    }
  };

  const serviceNames = useMemo(() => new Map(services.map((service) => [service.id, service.name])), [services]);
  const orderColumns: ColumnsType<ServiceOrder> = [
    { title: 'Dịch vụ', dataIndex: 'serviceId', key: 'serviceId', render: (id: string) => serviceNames.get(id) ?? id.slice(0, 8) },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (status: string) => <Tag>{status}</Tag> },
    {
      title: 'Bắt đầu',
      dataIndex: 'startAt',
      key: 'startAt',
      render: (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : '—',
    },
    {
      title: 'Kết thúc',
      dataIndex: 'endAt',
      key: 'endAt',
      render: (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : '—',
    },
    { title: 'Đơn giá/giờ', dataIndex: 'unitPrice', key: 'unitPrice', render: (value: number) => value.toLocaleString('vi-VN') },
    { title: 'Chi phí', dataIndex: 'totalAmount', key: 'totalAmount', render: (value: number) => value.toLocaleString('vi-VN') },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_, order) => order.status === 'ASSIGNED' || order.status === 'SCHEDULED'
        ? <Button icon={<PlayCircleOutlined />} onClick={() => void transition(order, 'start')}>Bắt đầu</Button>
        : order.status === 'IN_PROGRESS'
          ? <Button icon={<StopOutlined />} onClick={() => void transition(order, 'end')}>Kết thúc</Button>
          : <Tag color="green">Hoàn tất</Tag>,
    },
  ];

  return (
    <Space direction="vertical" size="large" className="w-full">
      <Card title="Điều phối dịch vụ">
        <Row gutter={16} align="bottom">
          <Col xs={24} md={8}>
            <Text strong>Chọn xe trong bãi</Text>
            <Select
              className="mt-2 w-full"
              value={vehicleId}
              onChange={setVehicleId}
              placeholder="Chọn xe"
              options={notifications.map((item) => ({
                value: item.vehicleId,
                label: `${item.plateNumber} — ${item.driverName}`,
              }))}
            />
          </Col>
          <Col xs={24} md={12}>
            <Text strong>Gán dịch vụ</Text>
            <Select
              mode="multiple"
              className="mt-2 w-full"
              value={selectedServices}
              onChange={setSelectedServices}
              placeholder="Chọn một hoặc nhiều dịch vụ"
              options={services.map((service) => ({
                value: service.id,
                label: `${service.name} (${service.hourlyRate.toLocaleString('vi-VN')}/giờ)`,
              }))}
            />
          </Col>
          <Col xs={24} md={4}>
            <Button type="primary" className="mt-2 w-full" loading={loading}
              disabled={!vehicleId || selectedServices.length === 0} onClick={() => void assign()}>
              Gán dịch vụ
            </Button>
          </Col>
        </Row>
      </Card>
      <Card title="Tiến độ dịch vụ">
        <Table rowKey="id" columns={orderColumns} dataSource={orders} pagination={{ pageSize: 8 }} />
      </Card>
      <Card title="Timeline thực hiện">
        {orders.length ? (
          <Timeline items={orders.flatMap((order) => {
            const name = serviceNames.get(order.serviceId) ?? order.serviceId.slice(0, 8);
            const items = [{ color: 'blue', children: `${name} — Đã phân công` }];
            if (order.startAt) {
              items.push({ color: 'green', children: `${name} — Bắt đầu ${new Date(order.startAt).toLocaleString('vi-VN')}` });
            }
            if (order.endAt) {
              items.push({ color: 'gray', children: `${name} — Kết thúc ${new Date(order.endAt).toLocaleString('vi-VN')} · ${Number(order.totalAmount).toLocaleString('vi-VN')}` });
            }
            return items;
          })} />
        ) : <Empty description="Chọn xe để theo dõi tiến độ dịch vụ" />}
      </Card>
    </Space>
  );
}

function YardManagementTab({
  inventory,
  alerts,
  onInventoryRefresh,
}: {
  inventory: YardInventory[];
  alerts: YardAlert[];
  onInventoryRefresh: () => Promise<void>;
}) {
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<Yard>();
  const [modalOpen, setModalOpen] = useState(false);
  const [mapView, setMapView] = useState(false);
  const [alertDrawerOpen, setAlertDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(undefined);
    form.resetFields();
    form.setFieldsValue({ capacity: 100, status: 'ACTIVE' });
    setModalOpen(true);
  };

  const openEdit = (yard: Yard) => {
    setEditing(yard);
    form.setFieldsValue(yard);
    setModalOpen(true);
  };

  const saveYard = async (values: Omit<Yard, 'id'>) => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/yards/${editing.id}`, values);
      } else {
        await api.post('/yards', values);
      }
      message.success(editing ? 'Đã cập nhật bãi' : 'Đã tạo bãi');
      setModalOpen(false);
      await onInventoryRefresh();
    } catch (error) {
      message.error(apiError(error, 'Không thể lưu thông tin bãi'));
    } finally {
      setSaving(false);
    }
  };

  const setYardActive = async (yard: Yard, active: boolean) => {
    try {
      await api.put(`/yards/${yard.id}`, { ...yard, status: active ? 'ACTIVE' : 'INACTIVE' });
      await onInventoryRefresh();
    } catch (error) {
      message.error(apiError(error, 'Không thể cập nhật trạng thái bãi'));
    }
  };

  const columns: ColumnsType<YardInventory> = [
    { title: 'Mã bãi', dataIndex: ['yard', 'code'], key: 'code' },
    { title: 'Tên bãi', dataIndex: ['yard', 'name'], key: 'name' },
    { title: 'Địa chỉ', dataIndex: ['yard', 'address'], key: 'address' },
    {
      title: 'Tồn kho',
      key: 'occupancy',
      render: (_, row) => `${row.occupancy} / ${row.yard.capacity}`,
    },
    {
      title: 'Mức sử dụng',
      key: 'percentage',
      render: (_, row) => <Progress percent={row.occupancyPercent} status={row.alert ? 'exception' : 'active'} />,
    },
    {
      title: 'Hoạt động',
      key: 'active',
      render: (_, row) => (
        <Switch checked={row.yard.status === 'ACTIVE'} onChange={(active) => void setYardActive(row.yard, active)} />
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_, row) => <Button icon={<EditOutlined />} onClick={() => openEdit(row.yard)}>Sửa</Button>,
    },
  ];

  const locations = inventory.map((item, index) => {
    const coordinates = inventory
      .filter((entry) => Number.isFinite(entry.yard.latitude) && Number.isFinite(entry.yard.longitude));
    const latitudes = coordinates.map((entry) => entry.yard.latitude ?? 0);
    const longitudes = coordinates.map((entry) => entry.yard.longitude ?? 0);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    const hasCoordinates = Number.isFinite(item.yard.latitude) && Number.isFinite(item.yard.longitude);
    const left = hasCoordinates && maxLng !== minLng
      ? 10 + ((item.yard.longitude! - minLng) / (maxLng - minLng)) * 75
      : 12 + (index % 4) * 22;
    const top = hasCoordinates && maxLat !== minLat
      ? 12 + ((maxLat - item.yard.latitude!) / (maxLat - minLat)) * 72
      : 15 + (Math.floor(index / 4) % 3) * 27;
    return { item, left, top };
  });

  return (
    <Space direction="vertical" size="large" className="w-full">
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}><Card><Statistic title="Tổng số bãi" value={inventory.length} /></Card></Col>
        <Col xs={24} sm={8}>
          <Card><Statistic title="Xe đang lưu bãi" value={inventory.reduce((total, item) => total + item.occupancy, 0)} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Space className="w-full justify-between">
              <Statistic title="Cảnh báo" value={alerts.length} valueStyle={{ color: alerts.length ? '#cf1322' : undefined }} />
              <Badge count={alerts.length}>
                <Button aria-label="Mở cảnh báo" shape="circle" icon={<BellOutlined />}
                  onClick={() => setAlertDrawerOpen(true)} />
              </Badge>
            </Space>
          </Card>
        </Col>
      </Row>
      <Card
        title={<Space><EnvironmentOutlined /> Quản lý bãi</Space>}
        extra={
          <Space>
            <Text>Map view</Text>
            <Switch checked={mapView} onChange={setMapView} />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm bãi</Button>
          </Space>
        }
      >
        {mapView ? (
          <div className="relative min-h-96 overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50"
            aria-label="Sơ đồ phân bố bãi">
            {locations.map(({ item, left, top }) => (
              <div key={item.yard.id} className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${left}%`, top: `${top}%` }}>
                <Card size="small" className="w-44 shadow-md">
                  <Text strong>{item.yard.code} — {item.yard.name}</Text>
                  <Progress percent={item.occupancyPercent} status={item.alert ? 'exception' : 'active'} />
                  <Text type="secondary">{item.occupancy}/{item.yard.capacity} xe</Text>
                </Card>
              </div>
            ))}
            {inventory.length === 0 && <Empty className="pt-24" description="Chưa có bãi để hiển thị" />}
          </div>
        ) : (
          <Table rowKey={(row) => row.yard.id} columns={columns} dataSource={inventory} pagination={{ pageSize: 8 }} />
        )}
      </Card>
      <Drawer title="Cảnh báo bãi" open={alertDrawerOpen} onClose={() => setAlertDrawerOpen(false)}>
        <Space direction="vertical" className="w-full">
          {alerts.length ? alerts.map((alert) => (
            <Alert key={alert.id} type="warning" showIcon message={alert.message}
              description={new Date(alert.createdAt).toLocaleString('vi-VN')} />
          )) : <Empty description="Không có cảnh báo đang mở" />}
        </Space>
      </Drawer>
      <Modal
        title={editing ? 'Cập nhật bãi' : 'Thêm bãi mới'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" onFinish={saveYard}>
          <Form.Item name="code" label="Mã bãi" rules={[{ required: true }]}><Input disabled={!!editing} /></Form.Item>
          <Form.Item name="name" label="Tên bãi" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="address" label="Địa chỉ" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="latitude" label="Vĩ độ"><InputNumber className="w-full" min={-90} max={90} /></Form.Item></Col>
            <Col span={12}><Form.Item name="longitude" label="Kinh độ"><InputNumber className="w-full" min={-180} max={180} /></Form.Item></Col>
          </Row>
          <Form.Item name="capacity" label="Sức chứa" rules={[{ required: true, type: 'number', min: 1 }]}>
            <InputNumber className="w-full" min={1} />
          </Form.Item>
          <Form.Item name="status" label="Trạng thái">
            <Select options={[{ value: 'ACTIVE', label: 'Hoạt động' }, { value: 'INACTIVE', label: 'Tạm ngưng' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

export function OperationsPage() {
  const { token } = useAuth();
  const [inventory, setInventory] = useState<YardInventory[]>([]);
  const [alerts, setAlerts] = useState<YardAlert[]>([]);
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const alertIds = useRef(new Set<string>());

  const refreshYards = useCallback(async () => {
    try {
      const [inventoryResponse, alertResponse] = await Promise.all([
        api.get('/yards/inventory'),
        api.get('/yards/alerts'),
      ]);
      setInventory(inventoryResponse.data.data);
      const currentAlerts: YardAlert[] = alertResponse.data.data;
      alertIds.current = new Set(currentAlerts.map((alert) => alert.id));
      setAlerts(currentAlerts);
    } catch (error) {
      message.error(apiError(error, 'Không thể tải tình trạng các bãi'));
    }
  }, []);

  useEffect(() => {
    void refreshYards();
  }, [refreshYards]);

  useEffect(() => {
    if (!token) return undefined;
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
    const socketBase = (import.meta.env.VITE_WS_URL as string | undefined)
      ?? `${apiBase.replace(/\/api\/?$/, '')}/ws`;
    const socketUrl = socketBase.replace(/^http/, window.location.protocol === 'https:' ? 'wss' : 'ws');
    const client = new Client({
      brokerURL: socketUrl,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        setConnection('connected');
        client.subscribe('/topic/yards/inventory', (frame: IMessage) => {
          try {
            const nextInventory: unknown = JSON.parse(frame.body);
            if (Array.isArray(nextInventory)) setInventory(nextInventory as YardInventory[]);
          } catch {
            message.error('Dữ liệu tồn kho realtime không hợp lệ');
          }
        });
        client.subscribe('/topic/yards/alerts', (frame: IMessage) => {
          try {
            const nextAlerts: unknown = JSON.parse(frame.body);
            if (!Array.isArray(nextAlerts)) return;
            const parsedAlerts = nextAlerts as YardAlert[];
            parsedAlerts.forEach((alert) => {
              if (!alertIds.current.has(alert.id)) {
                antdNotification.warning({ message: 'Cảnh báo bãi', description: alert.message });
              }
            });
            alertIds.current = new Set(parsedAlerts.map((alert) => alert.id));
            setAlerts(parsedAlerts);
          } catch {
            message.error('Dữ liệu cảnh báo realtime không hợp lệ');
          }
        });
      },
      onDisconnect: () => setConnection('disconnected'),
      onWebSocketClose: () => setConnection('disconnected'),
      onWebSocketError: () => setConnection('disconnected'),
      onStompError: () => {
        setConnection('disconnected');
        message.error('Không thể kết nối kênh realtime tồn kho');
      },
    });
    client.activate();
    return () => {
      void client.deactivate();
    };
  }, [token]);

  const yards = useMemo(() => inventory.map((item) => item.yard), [inventory]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Title level={2} className="!mb-1">Vận hành bãi</Title>
          <Text type="secondary">Thông báo xe, kiểm soát cổng, điều phối dịch vụ và quản lý tồn bãi.</Text>
        </div>
        <Tag color={connection === 'connected' ? 'green' : 'default'}>
          Realtime: {connection === 'connected' ? 'Đã kết nối' : connection === 'connecting' ? 'Đang kết nối' : 'Mất kết nối'}
        </Tag>
      </div>
      <Tabs
        items={[
          { key: 'prenotification', label: 'Thông báo xe trước', children: <VehicleRegistrationTab /> },
          { key: 'gate', label: 'Check-in / Check-out', children: <GateTab yards={yards} /> },
          { key: 'dispatch', label: 'Điều phối dịch vụ', children: <ServiceDispatchTab /> },
          {
            key: 'yards',
            label: 'Quản lý bãi',
            children: <YardManagementTab inventory={inventory} alerts={alerts} onInventoryRefresh={refreshYards} />,
          },
        ]}
      />
    </div>
  );
}
