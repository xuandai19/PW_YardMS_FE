import { Client } from '@stomp/stompjs';
import { Alert, Button, Card, Col, Form, Input, InputNumber, message, Row, Space, Table, Tag, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import { api, ACCESS_TOKEN_KEY } from '../services/api';

type RoutePoint = {
  id: string;
  tripId: string;
  recordedAt: string;
  latitude: number;
  longitude: number;
  speedKmh?: number;
  offRoute: boolean;
};
type Geofence = { id: string; name: string; latitude: number; longitude: number; radiusM: number };
type RouteAlert = { id: string; tripId: string; message: string; createdAt: string };
const { Title, Text } = Typography;

function errorText(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) return error.response?.data?.message ?? 'Thao tác thất bại';
  return error instanceof Error ? error.message : 'Thao tác thất bại';
}

function FollowVehicle({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

export default function TrackingPage() {
  const [tripId, setTripId] = useState('');
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [alerts, setAlerts] = useState<RouteAlert[]>([]);
  const [playIndex, setPlayIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fenceForm] = Form.useForm();

  const loadTrip = useCallback(async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    try {
      const [history, fences] = await Promise.all([
        api.get(`/tracking/trips/${id}/history`),
        api.get(`/tracking/trips/${id}/geofences`),
      ]);
      setPoints(history.data.data);
      setGeofences(fences.data.data);
      setPlayIndex(0);
    } catch (error) {
      message.error(errorText(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let client: Client | undefined;
    if (tripId) {
      const base = api.defaults.baseURL ?? window.location.origin;
      const socketUrl = `${new URL(base).origin.replace(/^http/, 'ws')}/ws`;
      client = new Client({
        webSocketFactory: () => new WebSocket(socketUrl),
        connectHeaders: { Authorization: `Bearer ${localStorage.getItem(ACCESS_TOKEN_KEY) ?? ''}` },
        reconnectDelay: 5000,
        onConnect: () => {
          client?.subscribe(`/topic/trips/${tripId}/location`, (frame) => {
            const point = JSON.parse(frame.body) as RoutePoint;
            setPoints((previous) => [...previous, point].slice(-1000));
          });
          client?.subscribe('/topic/tracking/alerts', (frame) => {
            const alert = JSON.parse(frame.body) as RouteAlert;
            setAlerts((previous) => [alert, ...previous].slice(0, 100));
          });
        },
        onStompError: (frame) => message.error(frame.headers.message ?? 'Kết nối theo dõi GPS thất bại'),
      });
      client.activate();
    }
    return () => {
      void client?.deactivate();
    };
  }, [tripId]);

  useEffect(() => {
    void api.get('/tracking/alerts').then((response) => setAlerts(response.data.data))
      .catch((error: unknown) => message.error(errorText(error)));
  }, []);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => {
      setPlayIndex((index) => {
        if (index >= points.length - 1) {
          setPlaying(false);
          return index;
        }
        return index + 1;
      });
    }, 750);
    return () => window.clearInterval(timer);
  }, [playing, points.length]);

  const route = useMemo(() => points.slice(0, playing ? playIndex + 1 : undefined)
    .map((point) => [point.latitude, point.longitude] as [number, number]), [points, playIndex, playing]);
  const activePoint = points[Math.max(0, playing ? playIndex : points.length - 1)];
  const mapCenter = useMemo<[number, number]>(() => activePoint
    ? [activePoint.latitude, activePoint.longitude]
    : [10.7769, 106.7009], [activePoint]);

  const addGeofence = async (values: { name: string; latitude: number; longitude: number; radiusM: number }) => {
    if (!tripId) {
      message.warning('Nhập mã chuyến đi trước khi tạo geofence');
      return;
    }
    try {
      await api.post(`/tracking/trips/${tripId}/geofences`, values);
      fenceForm.resetFields();
      await loadTrip(tripId);
      message.success('Đã thêm vùng geofence');
    } catch (error) {
      message.error(errorText(error));
    }
  };

  return (
    <Space direction="vertical" size="large" className="w-full">
      <Title level={3}>Theo dõi hành trình GPS</Title>
      <Card>
        <Space.Compact className="w-full">
          <Input value={tripId} onChange={(event) => setTripId(event.target.value)}
            onPressEnter={() => void loadTrip(tripId)} placeholder="Mã chuyến đi (UUID)" />
          <Button type="primary" loading={loading} onClick={() => void loadTrip(tripId)}>Tải hành trình</Button>
        </Space.Compact>
      </Card>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card title="Bản đồ realtime và playback">
            <MapContainer center={mapCenter} zoom={13} scrollWheelZoom className="h-[480px] w-full rounded-lg">
              <FollowVehicle center={mapCenter} />
              <TileLayer attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {route.length > 1 && <Polyline positions={route} pathOptions={{ color: '#1677ff', weight: 4 }} />}
              {activePoint && <CircleMarker center={mapCenter} radius={9}
                pathOptions={{ color: activePoint.offRoute ? '#cf1322' : '#1677ff' }}>
                <Tooltip permanent>{activePoint.speedKmh ?? 0} km/h</Tooltip>
              </CircleMarker>}
              {geofences.map((fence) => <Circle key={fence.id}
                center={[fence.latitude, fence.longitude]} radius={fence.radiusM}
                pathOptions={{ color: '#52c41a', fillOpacity: 0.12 }}>
                <Tooltip>{fence.name} · {fence.radiusM} m</Tooltip>
              </Circle>)}
            </MapContainer>
            <div className="mt-4 flex items-center gap-3">
              <Button disabled={!points.length} onClick={() => setPlaying((value) => !value)}>
                {playing ? 'Tạm dừng' : 'Phát lại lộ trình'}
              </Button>
              <Text type="secondary">{points.length} điểm GPS · {activePoint
                ? new Date(activePoint.recordedAt).toLocaleString('vi-VN') : 'Chưa có vị trí'}</Text>
            </div>
          </Card>
          <Card className="mt-4" title="Cấu hình vùng geofence">
            <Form form={fenceForm} layout="vertical" onFinish={addGeofence}>
              <Row gutter={12}>
                <Col xs={24} md={6}><Form.Item name="name" label="Tên vùng" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col xs={12} md={5}><Form.Item name="latitude" label="Vĩ độ" rules={[{ required: true }]}><InputNumber className="w-full" min={-90} max={90} step={0.0001} /></Form.Item></Col>
                <Col xs={12} md={5}><Form.Item name="longitude" label="Kinh độ" rules={[{ required: true }]}><InputNumber className="w-full" min={-180} max={180} step={0.0001} /></Form.Item></Col>
                <Col xs={12} md={5}><Form.Item name="radiusM" label="Bán kính (m)" rules={[{ required: true }]}><InputNumber className="w-full" min={1} /></Form.Item></Col>
                <Col xs={12} md={3} className="flex items-end"><Button htmlType="submit" type="primary">Thêm</Button></Col>
              </Row>
            </Form>
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="Cảnh báo lệch tuyến">
            {alerts.length === 0 ? <Alert type="success" showIcon message="Chưa có cảnh báo" /> :
              <Table size="small" rowKey="id" pagination={{ pageSize: 5 }} dataSource={alerts}
                columns={[
                  { title: 'Chuyến', dataIndex: 'tripId', key: 'tripId', render: (id: string) => <Text code>{id.slice(0, 8)}</Text> },
                  { title: 'Thời điểm', dataIndex: 'createdAt', key: 'createdAt', render: (value: string) => new Date(value).toLocaleString('vi-VN') },
                  { title: 'Trạng thái', dataIndex: 'message', key: 'message', render: (value: string) => <Tag color="red">{value}</Tag> },
                ]} />}
          </Card>
          <Card title="Gửi GPS thử nghiệm" className="mt-4">
            <Text type="secondary">Thiết bị gửi JSON đến MQTT topic yms/gps/{'{deviceId}'}; dữ liệu được chuyển tiếp qua Kafka. Bản đồ cập nhật qua WebSocket.</Text>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
