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
  AutoComplete,
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
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  type TripSummary,
} from './operations';

const { Title, Text } = Typography;

const ORIGIN_ADDRESS_SUGGESTIONS = [
  'Cảng Cát Lái, TP. Thủ Đức, TP. Hồ Chí Minh',
  'ICD Sóng Thần, Dĩ An, Bình Dương',
  'Cảng Cái Mép, Phú Mỹ, Bà Rịa - Vũng Tàu',
  'Cảng Hải Phòng, Hải An, Hải Phòng',
  'Bãi xe Long Bình, TP. Thủ Đức, TP. Hồ Chí Minh',
].map((value) => ({ value }));

function localDateTimeValue(timestamp: number): string {
  const date = new Date(timestamp);
  return new Date(timestamp - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function tokenFromQr(rawValue: string): string {
  try {
    const token = new URL(rawValue).searchParams.get('token');
    if (token) return token;
  } catch {
    // Some QR codes contain the signed token directly.
  }
  return rawValue.trim();
}

function notifyYardChanged() {
  window.dispatchEvent(new Event('yms-yard-changed'));
}

function apiError(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

function VehicleRegistrationTab({ yards }: { yards: Yard[] }) {
  const [form] = Form.useForm();
  const [partners, setPartners] = useState<{ id: string; name: string; code: string }[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [notifications, setNotifications] = useState<PreNotification[]>([]);
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [saving, setSaving] = useState(false);
  const [qr, setQr] = useState<{ imageBase64: string; expiresAt: string; token: string; scanUrl?: string }>();
  const [minimumArrival, setMinimumArrival] = useState(() => localDateTimeValue(Date.now() + 4 * 60 * 60 * 1000));
  const [originCoordinates, setOriginCoordinates] = useState('');
  const [locatingOrigin, setLocatingOrigin] = useState(false);

  const load = useCallback(async () => {
    try {
      const [partnerResponse, serviceResponse, queueResponse, tripResponse] = await Promise.all([
        api.get('/partners'),
        api.get('/services', { params: { activeOnly: true } }),
        api.get('/vehicles/pre-notifications/waiting'),
        api.get('/trips'),
      ]);
      setPartners(partnerResponse.data.data.filter((partner: { partnerType: string }) =>
        partner.partnerType === 'A'));
      setServices(serviceResponse.data.data);
      setNotifications(queueResponse.data.data);
      setTrips(tripResponse.data.data);
    } catch (error) {
      message.error(apiError(error, 'Không thể tải dữ liệu đăng ký xe'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMinimumArrival(localDateTimeValue(Date.now() + 4 * 60 * 60 * 1000));
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const register = async (values: {
    partnerAId: string;
    plateNumber: string;
    plannedArrival: string;
    driverName: string;
    driverPhone?: string;
    carrierCompany?: string;
    vehicleType?: string;
    startAddress: string;
    originLatitude?: number;
    originLongitude?: number;
    targetYardId: string;
    serviceIds?: string[];
  }) => {
    setSaving(true);
    try {
      await api.post('/vehicles/pre-notifications', {
        ...values,
        plannedArrival: new Date(values.plannedArrival).toISOString(),
        serviceIds: values.serviceIds ?? [],
        targetYardId: values.targetYardId,
      });
      form.resetFields();
      setOriginCoordinates('');
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
      const appUrl = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin;
      const response = await api.post(`/vehicles/pre-notifications/${id}/qr`, undefined, { params: { appUrl } });
      setQr(response.data.data);
    } catch (error) {
      message.error(apiError(error, 'Không thể tạo QR cho xe'));
    }
  };

  const locateOrigin = async () => {
    if (!navigator.geolocation) {
      message.error('Trình duyệt không hỗ trợ xác định vị trí. Bạn vẫn có thể nhập địa chỉ bằng tay.');
      return;
    }
    setLocatingOrigin(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15_000,
          maximumAge: 0,
        });
      });
      const latitude = Number(position.coords.latitude.toFixed(7));
      const longitude = Number(position.coords.longitude.toFixed(7));
      const enteredAddress = String(form.getFieldValue('startAddress') ?? '').trim();
      form.setFieldsValue({
        originLatitude: latitude,
        originLongitude: longitude,
        startAddress: enteredAddress || `Vị trí GPS (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`,
      });
      const accuracy = Math.round(position.coords.accuracy);
      setOriginCoordinates(`${latitude.toFixed(6)}, ${longitude.toFixed(6)} (sai số khoảng ±${accuracy} m)`);
      message.success('Đã lưu tọa độ GPS xuất phát; điểm này sẽ được đánh dấu trên bản đồ theo dõi hành trình.');
    } catch (error) {
      const geoError = error as GeolocationPositionError;
      message.error(geoError.code === 1
        ? 'Bạn chưa cấp quyền vị trí cho trình duyệt. Có thể nhập địa chỉ xuất phát bằng tay.'
        : 'Không lấy được vị trí hiện tại. Kiểm tra GPS hoặc nhập địa chỉ bằng tay.');
    } finally {
      setLocatingOrigin(false);
    }
  };

  const columns: ColumnsType<PreNotification> = [
    { title: 'Biển số', dataIndex: 'plateNumber', key: 'plateNumber' },
    {
      title: 'Điểm xuất phát', key: 'origin',
      render: (_, row) => trips.find((item) => item.id === row.tripId)?.origin ?? '—',
    },
    {
      title: 'Chuyến đi', key: 'trip',
      render: (_, row) => {
        const trip = trips.find((item) => item.id === row.tripId);
        return trip ? <Space direction="vertical" size={0}><Text strong>{trip.tripName}</Text><Text type="secondary">{trip.tripCode}</Text></Space> : 'Đang tải mã chuyến';
      },
    },
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
        <Alert className="mb-4" type="info" showIcon
          message="Sau khi kiểm tra và xác nhận, hệ thống tạo chuyến với mã theo ngày đến và biển số xe." />
        <Form form={form} layout="vertical" onFinish={register} onFinishFailed={({ errorFields }) => {
          const firstError = errorFields[0];
          message.error(firstError?.errors[0] ?? 'Vui lòng kiểm tra lại thông tin đăng ký xe.');
          if (firstError) form.scrollToField(firstError.name);
        }}>
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
              <Form.Item name="plateNumber" label="Biển số xe" rules={[
                { required: true, whitespace: true, message: 'Nhập biển số' },
                { max: 30, message: 'Biển số tối đa 30 ký tự' },
                { pattern: /^[A-Za-z0-9.\-\s]+$/, message: 'Biển số chỉ gồm chữ cái, chữ số, dấu chấm hoặc dấu gạch ngang' },
              ]}>
                <Input placeholder="Ví dụ: 51C12345" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="plannedArrival" label="Thời gian dự kiến đến" rules={[
                { required: true, message: 'Chọn thời gian đến' },
                { validator: (_, value: string | undefined) => !value || new Date(value).getTime() >= Date.now() + 4 * 60 * 60 * 1000
                  ? Promise.resolve() : Promise.reject(new Error('Thời gian đến phải cách hiện tại ít nhất 4 giờ. Hãy chọn giờ muộn hơn.')) },
              ]}>
                <Input type="datetime-local" min={minimumArrival} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="startAddress" label="Địa chỉ xe bắt đầu đi" rules={[
                { required: true, whitespace: true, message: 'Nhập địa chỉ xuất phát để theo dõi hành trình' },
                { max: 255, message: 'Địa chỉ tối đa 255 ký tự' },
              ]}>
                <AutoComplete className="w-full" options={ORIGIN_ADDRESS_SUGGESTIONS}
                  filterOption={(input, option) => (option?.value ?? '').toLowerCase().includes(input.toLowerCase())}
                  >
                  <Input placeholder="Chọn địa chỉ gợi ý hoặc nhập địa chỉ khác"
                    addonAfter={<Button type="link" size="small" loading={locatingOrigin}
                      icon={<EnvironmentOutlined />} onClick={() => void locateOrigin()}>Lấy vị trí hiện tại</Button>} />
                </AutoComplete>
              </Form.Item>
              <Text type="secondary">{originCoordinates
                ? `Tọa độ đã xác định: ${originCoordinates}`
                : 'Bạn có thể nhập địa chỉ hoặc lấy tọa độ GPS hiện tại.'}</Text>
              <Form.Item name="originLatitude" hidden><InputNumber /></Form.Item>
              <Form.Item name="originLongitude" hidden><InputNumber /></Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="targetYardId" label="Bãi xe muốn tới" rules={[{ required: true, message: 'Chọn bãi xe đích' }]}>
                <Select showSearch optionFilterProp="label" options={yards.filter(yard => yard.status === 'ACTIVE').map(yard => ({
                  value: yard.id, label: `${yard.code} — ${yard.name} · ${yard.address}`,
                }))} placeholder="Chọn bãi xe đích" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="driverName" label="Tên tài xế" rules={[{ required: true, message: 'Nhập tên tài xế' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="driverPhone" label="Số điện thoại tài xế" rules={[
                { pattern: /^[+0-9 ().-]{7,30}$/, message: 'Số điện thoại gồm 7–30 ký tự số hoặc dấu +, khoảng trắng, ngoặc, chấm, gạch ngang' },
              ]}><Input /></Form.Item>
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
            {qr.scanUrl && <Text>Quét bằng điện thoại để xem thông tin xe: <a href={qr.scanUrl} target="_blank" rel="noreferrer">Mở trang thông tin</a></Text>}
            {qr.scanUrl && ['localhost', '127.0.0.1'].includes(new URL(qr.scanUrl).hostname)}
          </div>
        )}
      </Modal>
    </Space>
  );
}

function GateTab({ yards, isAdmin }: { yards: Yard[]; isAdmin: boolean }) {
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
  const [historyDetail, setHistoryDetail] = useState<YardHistoryEntry>();
  const [waiting, setWaiting] = useState<PreNotification[]>([]);
  const [manualNotificationId, setManualNotificationId] = useState<string>();
  const [manualYardId, setManualYardId] = useState<string>();
  const [manualLoading, setManualLoading] = useState(false);
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

  const loadWaiting = useCallback(async () => {
    try {
      const response = await api.get('/vehicles/pre-notifications/waiting');
      setWaiting(response.data.data);
    } catch (error) {
      message.error(apiError(error, 'Không thể tải danh sách xe chờ vào bãi'));
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (isAdmin) void loadWaiting();
  }, [isAdmin, loadWaiting]);

  const scan = useCallback(async (value: string) => {
    if (scanBusy.current || value === lastScannedToken.current) return;
    scanBusy.current = true;
    lastScannedToken.current = value;
    setChecking(true);
    try {
      const scannedToken = tokenFromQr(value);
      const response = await api.post('/yard-logs/scan', { token: scannedToken });
      setToken(scannedToken);
      setVehicle(response.data.data);
      message.success(`Đã nhận diện xe ${response.data.data.plateNumber}`);
    } catch (error) {
      lastScannedToken.current = '';
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
      notifyYardChanged();
      message.success(`Đã check-in xe ${vehicle.plateNumber}`);
      setVehicle(undefined);
      setToken('');
      setYardId(undefined);
      await loadHistory();
      await loadWaiting();
    } catch (error) {
      message.error(apiError(error, 'Không thể check-in xe'));
    } finally {
      setChecking(false);
    }
  };

  const manualCheckIn = async () => {
    if (!manualNotificationId || !manualYardId) return;
    setManualLoading(true);
    try {
      await api.post('/yard-logs/manual-check-in', {
        preNotificationId: manualNotificationId,
        yardId: manualYardId,
      });
      notifyYardChanged();
      message.success('Đã xác nhận xe vào bãi thủ công');
      setManualNotificationId(undefined);
      setManualYardId(undefined);
      await Promise.all([loadHistory(), loadWaiting()]);
    } catch (error) {
      message.error(apiError(error, 'Không thể check-in xe thủ công'));
    } finally {
      setManualLoading(false);
    }
  };

  const checkOut = async (preNotificationId: string) => {
    try {
      const response = await api.post('/yard-logs/check-out', { preNotificationId });
      message.success(`Đã check-out. Thời gian lưu bãi: ${formatYardDuration(response.data.data.durationSeconds)}`);
      if (response.data.data.invoiceNo) {
        message.success(`Đã tạo hóa đơn ${response.data.data.invoiceNo} cho đối tác A; hóa đơn nằm trong mục Công nợ và hóa đơn.`);
      }
      notifyYardChanged();
      await Promise.all([loadHistory(), loadWaiting()]);
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
    { title: 'Đối tác A đăng ký', dataIndex: 'partnerAName', key: 'partnerAName', render: (value: string, row) => `${row.partnerACode} — ${value}` },
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
      render: (_, row) => <Space>
        <Button onClick={() => setHistoryDetail(row)}>Xem thông tin xe</Button>
        {!row.checkOutAt && <Button danger onClick={() => void checkOut(row.preNotificationId)}>Check-out</Button>}
      </Space>,
    },
  ];

  return (
    <Space direction="vertical" size="large" className="w-full">
      {isAdmin && <Card title="Check-in thủ công (Admin)">
        <Alert className="mb-4" type="info" showIcon
          message="Dùng khi không quét được QR. Xe vẫn phải có thông báo đăng ký và bãi còn sức chứa." />
        <Row gutter={16} align="bottom">
          <Col xs={24} md={10}>
            <Text strong>Xe chờ vào bãi</Text>
            <Select className="mt-2 w-full" value={manualNotificationId} onChange={setManualNotificationId}
              placeholder="Chọn xe đã đăng ký"
              options={waiting.map((item) => ({ value: item.id, label: `${item.plateNumber} — ${item.driverName}` }))} />
          </Col>
          <Col xs={24} md={9}>
            <Text strong>Bãi tiếp nhận</Text>
            <Select className="mt-2 w-full" value={manualYardId} onChange={setManualYardId}
              placeholder="Chọn bãi còn hoạt động"
              options={yards.filter((yard) => yard.status === 'ACTIVE').map((yard) => ({
                value: yard.id, label: `${yard.code} — ${yard.name}`,
              }))} />
          </Col>
          <Col xs={24} md={5}>
            <Button type="primary" className="mt-2 w-full" loading={manualLoading}
              disabled={!manualNotificationId || !manualYardId} onClick={() => void manualCheckIn()}>
              Xác nhận xe vào
            </Button>
          </Col>
        </Row>
      </Card>}
      <Card title="Quét QR tại cổng">
        <Row gutter={24}>
          <Col xs={24} lg={12}>
            <div id="qr-reader" className="min-h-64 w-full" />
            <Text type="secondary"><CameraOutlined /> Cho ph?p camera v? h??ng camera v?o m? QR tr?n phi?u xe.</Text>
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
      <Modal open={!!historyDetail} title="Thông tin xe trong lịch sử ra vào bãi"
        footer={null} onCancel={() => setHistoryDetail(undefined)}>
        {historyDetail && <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Biển số">{historyDetail.plateNumber}</Descriptions.Item>
          <Descriptions.Item label="Loại xe">{historyDetail.vehicleType || 'Chưa cập nhật'}</Descriptions.Item>
          <Descriptions.Item label="Đơn vị vận chuyển">{historyDetail.carrierCompany || 'Chưa cập nhật'}</Descriptions.Item>
          <Descriptions.Item label="Tài xế">{historyDetail.driverName}</Descriptions.Item>
          <Descriptions.Item label="Đối tác A đăng ký">{historyDetail.partnerACode} — {historyDetail.partnerAName}</Descriptions.Item>
          <Descriptions.Item label="Bãi">{historyDetail.yardCode} — {historyDetail.yardName}</Descriptions.Item>
          <Descriptions.Item label="Check-in">{new Date(historyDetail.checkInAt).toLocaleString('vi-VN')}</Descriptions.Item>
          <Descriptions.Item label="Check-out">{historyDetail.checkOutAt ? new Date(historyDetail.checkOutAt).toLocaleString('vi-VN') : 'Xe đang trong bãi'}</Descriptions.Item>
        </Descriptions>}
      </Modal>
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
  const [workerAvailability, setWorkerAvailability] = useState<Record<string, {
    availableCount: number; workerCount: number; workers: { id: string; name: string; available: boolean }[];
  }>>({});

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

  const existingServiceIds = useMemo(() => new Set(orders.map((order) => order.serviceId)), [orders]);
  const servicesToCheck = useMemo(() => [...new Set([
    ...selectedServices,
    ...orders.filter((order) => order.status !== 'COMPLETED').map((order) => order.serviceId),
  ])], [orders, selectedServices]);

  useEffect(() => {
    setWorkerAvailability({});
    if (!vehicleId || !servicesToCheck.length) return;
    let cancelled = false;
    void Promise.all(servicesToCheck.map(async (serviceId) => {
      try {
        const response = await api.get('/service-orders/availability', { params: { vehicleId, serviceId } });
        return [serviceId, response.data.data] as const;
      } catch {
        return [serviceId, null] as const;
      }
    })).then((results) => {
      if (!cancelled) setWorkerAvailability(Object.fromEntries(results.filter(([, value]) => value)));
    });
    return () => { cancelled = true; };
  }, [vehicleId, servicesToCheck]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    if (vehicleId && !notifications.some(item => item.vehicleId === vehicleId)) {
      setVehicleId(undefined);
      setOrders([]);
      setSelectedServices([]);
      setWorkerAvailability({});
    }
  }, [notifications, vehicleId]);

  useEffect(() => {
    const refresh = () => { void loadOptions(); };
    window.addEventListener('yms-yard-changed', refresh);
    return () => window.removeEventListener('yms-yard-changed', refresh);
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
      await Promise.all([loadOrders(vehicleId), loadOptions()]);
    } catch (error) {
      message.error(apiError(error, 'Không thể gán dịch vụ'));
    } finally {
      setLoading(false);
    }
  };

  const transition = async (order: ServiceOrder, action: 'start' | 'end') => {
    try {
      await api.post(`/service-orders/${order.id}/${action}`);
      message.success(action === 'start'
        ? 'Đã bắt đầu dịch vụ'
        : 'Đã hoàn tất dịch vụ. Hóa đơn sẽ tự phát hành khi toàn bộ dịch vụ của xe hoàn tất.');
      await Promise.all([loadOrders(vehicleId), loadOptions()]);
    } catch (error) {
      message.error(apiError(error, 'Không thể cập nhật dịch vụ'));
    }
  };

  const refreshTimeline = async () => {
    await Promise.all([loadOrders(vehicleId), loadOptions()]);
    message.success('Đã làm mới tiến độ và timeline');
  };

  const serviceNames = useMemo(() => new Map(services.map((service) => [service.id, service.name])), [services]);
  const orderColumns: ColumnsType<ServiceOrder> = [
    { title: 'Dịch vụ', dataIndex: 'serviceId', key: 'serviceId', render: (id: string) => serviceNames.get(id) ?? id.slice(0, 8) },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (status: string) => <Tag>{status}</Tag> },
    {
      title: 'Dự kiến hoàn thành', dataIndex: 'expectedEndAt', key: 'expectedEndAt',
      render: (value?: string, order?: ServiceOrder) => {
        if (order?.endAt) return <span>Thực tế: {new Date(order.endAt).toLocaleString('vi-VN')}</span>;
        return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có thời gian dự kiến';
      },
    },
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
      <Card title="Điều phối dịch vụ" extra={<Button onClick={() => void refreshTimeline()}>Làm mới tiến độ</Button>}>
        <Row gutter={16} align="bottom">
          <Col xs={24} md={8}>
            <Text strong>Chọn xe trong bãi</Text>
            <Select
              className="mt-2 w-full"
              value={vehicleId}
              onChange={(id) => { setOrders([]); setSelectedServices([]); setVehicleId(id); }}
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
              disabled={!vehicleId}
              value={selectedServices}
              onChange={setSelectedServices}
              placeholder={vehicleId ? "Chọn một hoặc nhiều dịch vụ" : "Chọn xe trong bãi trước"}
              options={services.map((service) => ({
                value: service.id,
                label: `${service.name} · ${service.expectedDurationMinutes} phút · ${service.hourlyRate.toLocaleString('vi-VN')}/giờ`,
                disabled: existingServiceIds.has(service.id),
              }))}
            />
            {servicesToCheck.map((serviceId) => {
              const service = services.find((item) => item.id === serviceId);
              const availability = workerAvailability[serviceId];
              if (!service) return null;
              return <Alert key={serviceId} className="mt-2" showIcon
                type={!availability ? 'info' : availability.availableCount > 0 ? 'success' : 'warning'}
                message={!availability ? `${service.name}: kiểm tra nhân sự tại bãi...`
                  : `${service.name}: ${availability.availableCount}/${availability.workerCount} thợ đang sẵn sàng tại bãi`}
                description={availability?.workers.map((worker) => `${worker.name}: ${worker.available ? 'sẵn sàng' : 'đang làm'}`).join(' · ')} />;
            })}
          </Col>
          <Col xs={24} md={4}>
            <Button type="primary" className="mt-2 w-full" loading={loading}
              disabled={!vehicleId || selectedServices.length === 0} onClick={() => void assign()}>
              Gán dịch vụ
            </Button>
          </Col>
        </Row>
      </Card>
      {vehicleId && orders.length > 0 && <Alert className="mb-2" showIcon type="info"
        message={`${orders.length} dịch vụ cho xe đã chọn; dịch vụ đăng ký trước được giữ nguyên và không thể gán trùng.`} />}
      <Card title="Tiến độ dịch vụ">
        <Table rowKey="id" columns={orderColumns} dataSource={orders} pagination={{ pageSize: 8 }} />
      </Card>
      <Card title="Timeline thực hiện">
        {orders.length ? (
          <Timeline items={orders.flatMap((order) => {
            const name = serviceNames.get(order.serviceId) ?? order.serviceId.slice(0, 8);
            const items = [{ color: order.status === 'COMPLETED' ? 'green' : 'blue', children: `${name} — ${order.status === 'SCHEDULED' ? 'Đã đăng ký trước' : 'Đã phân công'}` }];
            if (order.startAt) {
              items.push({ color: 'green', children: `${name} — Bắt đầu ${new Date(order.startAt).toLocaleString('vi-VN')}${order.expectedEndAt ? ` · dự kiến xong ${new Date(order.expectedEndAt).toLocaleString('vi-VN')}` : ''}` });
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
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm bãi</Button>}
      >
        <Table rowKey={(row) => row.yard.id} columns={columns} dataSource={inventory} pagination={{ pageSize: 8 }} />
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
  const { token, user } = useAuth();
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
  const can = (permission: string) => !!user?.roles.includes('ADMIN')
    || user?.permissions.includes('*') === true
    || user?.permissions.includes(permission) === true;
  const operationTabs: { key: string; label: string; children: ReactNode }[] = [];
  if (can('VEHICLE_OPERATE')) operationTabs.push({ key: 'prenotification', label: 'Thông báo xe trước', children: <VehicleRegistrationTab yards={yards} /> });
  if (can('GATE_OPERATE')) operationTabs.push({ key: 'gate', label: 'Check-in / Check-out', children: <GateTab yards={yards} isAdmin={!!user?.roles.includes('ADMIN')} /> });
  if (can('SERVICE_DISPATCH')) operationTabs.push({ key: 'dispatch', label: 'Điều phối dịch vụ', children: <ServiceDispatchTab /> });
  if (can('YARD_READ') || can('YARD_WRITE')) operationTabs.push({
      key: 'yards',
      label: 'Quản lý bãi',
      children: <YardManagementTab inventory={inventory} alerts={alerts} onInventoryRefresh={refreshYards} />,
    });

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
        items={operationTabs}
      />
    </div>
  );
}
