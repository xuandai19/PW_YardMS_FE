import { Client } from '@stomp/stompjs';
import { Alert, Button, Card, Col, message, Row, Select, Space, Table, Tag, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
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
type TripOption = {
  id: string; tripCode?: string; tripName?: string; origin: string; destination: string;
  originLatitude?: number; originLongitude?: number;
  destinationYardId?: string; destinationLatitude?: number; destinationLongitude?: number;
};
type YardOption = { id: string; name: string; address: string; latitude?: number; longitude?: number };
type RouteEstimate = { coordinates: [number, number][]; distanceMeters: number; durationSeconds: number };
const { Title, Text } = Typography;

function errorText(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) return error.response?.data?.message ?? 'Thao tác thất bại';
  return error instanceof Error ? error.message : 'Thao tác thất bại';
}

function FitRouteBounds({ coordinates }: { coordinates: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coordinates.length > 1) {
      map.fitBounds(coordinates, { padding: [36, 36], maxZoom: 13 });
    } else if (coordinates.length === 1) {
      map.setView(coordinates[0], 13, { animate: true });
    }
  }, [coordinates, map]);
  return null;
}

function CoordinatePicker({ onPick }: { onPick: (position: [number, number]) => void }) {
  useMapEvents({ click: event => onPick([event.latlng.lat, event.latlng.lng]) });
  return null;
}

export default function TrackingPage() {
  const [tripId, setTripId] = useState('');
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [yards, setYards] = useState<YardOption[]>([]);
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [routeEstimate, setRouteEstimate] = useState<RouteEstimate>();
  const [routeError, setRouteError] = useState('');
  const [routeRequestedTripId, setRouteRequestedTripId] = useState('');
  const [routeRequestSeq, setRouteRequestSeq] = useState(0);
  const [routing, setRouting] = useState(false);
  const [alerts, setAlerts] = useState<RouteAlert[]>([]);
  const [playIndex, setPlayIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pickTarget, setPickTarget] = useState<'origin' | 'destination'>();
  const [pickedPosition, setPickedPosition] = useState<[number, number]>();
  const [savingCoordinates, setSavingCoordinates] = useState(false);

  useEffect(() => {
    void Promise.all([api.get('/trips'), api.get('/yards')]).then(([tripResponse, yardResponse]) => {
      setTrips(tripResponse.data.data);
      setYards(yardResponse.data.data);
    }).catch((error: unknown) => message.error(errorText(error)));
  }, []);

  const loadTrip = useCallback(async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    try {
      const history = await api.get(`/tracking/trips/${id}/history`);
      setPoints(history.data.data);
      void api.get(`/tracking/trips/${id}/geofences`)
        .then(response => setGeofences(response.data.data))
        .catch(() => setGeofences([]));
      setPlayIndex(0);
      setRouteRequestedTripId(id);
      setRouteRequestSeq(sequence => sequence + 1);
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
  const selectedTrip = trips.find((trip) => trip.id === tripId);
  const selectedYard = selectedTrip && (yards.find(yard => yard.id === selectedTrip.destinationYardId)
    ?? yards.find(yard => yard.name.trim().toLowerCase() === selectedTrip.destination.trim().toLowerCase()));
  const originPosition = selectedTrip?.originLatitude != null && selectedTrip.originLongitude != null
    ? [selectedTrip.originLatitude, selectedTrip.originLongitude] as [number, number] : undefined;
  const destinationPosition = selectedTrip?.destinationLatitude != null && selectedTrip.destinationLongitude != null
    ? [selectedTrip.destinationLatitude, selectedTrip.destinationLongitude] as [number, number]
    : selectedYard?.latitude != null && selectedYard.longitude != null
      ? [selectedYard.latitude, selectedYard.longitude] as [number, number] : undefined;
  const mapRouteCoordinates = useMemo<[number, number][]>(() => routeEstimate?.coordinates
    ?? [originPosition, destinationPosition].filter((point): point is [number, number] => !!point),
  [routeEstimate, originPosition?.[0], originPosition?.[1], destinationPosition?.[0], destinationPosition?.[1]]);
  const mapCenter = useMemo<[number, number]>(() => activePoint
    ? [activePoint.latitude, activePoint.longitude]
    : originPosition
      ? originPosition
      : destinationPosition
        ? destinationPosition
      : [10.7769, 106.7009], [activePoint, selectedTrip]);

  const savePickedPosition = async () => {
    if (!selectedTrip || !pickedPosition || !pickTarget) return;
    setSavingCoordinates(true);
    try {
      const body = pickTarget === 'origin'
        ? { originLatitude: pickedPosition[0], originLongitude: pickedPosition[1] }
        : { destinationLatitude: pickedPosition[0], destinationLongitude: pickedPosition[1] };
      const response = await api.patch(`/trips/${selectedTrip.id}/coordinates`, body);
      setTrips(current => current.map(trip => trip.id === selectedTrip.id ? response.data.data : trip));
      setPickTarget(undefined);
      setPickedPosition(undefined);
      message.success('Đã lưu tọa độ chuyến xe. Đang tải lại tuyến đường.');
      await loadTrip(selectedTrip.id);
    } catch (error) {
      message.error(errorText(error));
    } finally {
      setSavingCoordinates(false);
    }
  };

  useEffect(() => {
    if (routeRequestedTripId !== tripId || !selectedTrip) return undefined;
    if (!originPosition || !destinationPosition) {
      setRouteEstimate(undefined);
      setRouting(false);
      setRouteError('Chưa có đủ tọa độ điểm xuất phát và bãi đích. Hãy lấy GPS điểm xuất phát khi đăng ký xe và nhập tọa độ cho bãi.');
      return undefined;
    }
    const controller = new AbortController();
    setRouting(true);
    setRouteError('');
    setRouteEstimate(undefined);
    const routerBase = import.meta.env.VITE_OSRM_ROUTER_URL || 'https://router.project-osrm.org/route/v1/driving';
    const coordinates = `${originPosition[1]},${originPosition[0]};${destinationPosition[1]},${destinationPosition[0]}`;
    void fetch(`${routerBase}/${coordinates}?overview=full&geometries=geojson`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(`Định tuyến trả về HTTP ${response.status}`);
        return response.json() as Promise<{
          code: string;
          routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
        }>;
      })
      .then(result => {
        const route = result.routes?.[0];
        if (result.code !== 'Ok' || !route || route.geometry.coordinates.length < 2) {
          throw new Error('Không tìm thấy đường bộ giữa điểm xuất phát và bãi đã chọn.');
        }
        setRouteEstimate({
          coordinates: route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude]),
          distanceMeters: route.distance,
          durationSeconds: route.duration,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setRouteError(error instanceof Error ? error.message : 'Không tải được tuyến đường bộ.');
      })
      .finally(() => { if (!controller.signal.aborted) setRouting(false); });
    return () => controller.abort();
  }, [routeRequestedTripId, routeRequestSeq, tripId, selectedTrip, originPosition?.[0], originPosition?.[1], destinationPosition?.[0], destinationPosition?.[1]]);

  return (
    <Space direction="vertical" size="large" className="w-full">
      <Title level={3}>Theo dõi hành trình GPS</Title>
      <Card>
        <Space.Compact className="w-full">
          <Select className="min-w-0 flex-1" value={tripId || undefined} onChange={(id) => {
            setTripId(id);
            setPoints([]);
            setGeofences([]);
            setRouteEstimate(undefined);
            setRouteError('');
            setRouteRequestedTripId('');
            setPlayIndex(0);
            setPlaying(false);
          }} showSearch optionFilterProp="label"
            options={trips.map((trip) => ({ value: trip.id, label: `${trip.tripName ?? `${trip.origin} → ${trip.destination}`} · ${trip.tripCode ?? trip.id}` }))}
            notFoundContent="Chưa có chuyến đi. Hãy đăng ký xe trước."
            placeholder="Chọn chuyến đi" />
          <Button type="primary" disabled={!tripId || loading || routing} loading={loading || routing} onClick={() => void loadTrip(tripId)}>Tải hành trình</Button>
        </Space.Compact>
      </Card>
      {routeRequestedTripId === tripId && selectedTrip && (routeError
        ? <Alert type="warning" showIcon message={routeError} />
        : routing ? <Alert type="info" showIcon message="Đang tải tuyến đường bộ từ điểm xuất phát tới bãi đích…" />
          : routeEstimate && <Alert type="success" showIcon
            message={`Tuyến đường bộ: ${(routeEstimate.distanceMeters / 1000).toFixed(1)} km · khoảng ${Math.round(routeEstimate.durationSeconds / 60)} phút`}
            description="Đường màu cam là tuyến đường bộ dự kiến; đường màu xanh là hành trình GPS thực tế đã ghi nhận." />)}
      {trips.length === 0 ? <Alert type="warning" showIcon message="Chưa có chuyến đi để theo dõi"
        description="Hãy đăng ký xe ở mục Vận hành bãi → Thông báo xe trước. Hệ thống sẽ tạo chuyến sau khi xác nhận đăng ký." /> : selectedTrip && <Alert type="info" showIcon
        message={`Điểm xuất phát đã đăng ký: ${selectedTrip.origin}`}
        description={`Điểm đầu: ${originPosition ? `${originPosition[0].toFixed(6)}, ${originPosition[1].toFixed(6)}` : 'chưa có tọa độ GPS'} · Bãi đến: ${selectedYard?.name ?? selectedTrip.destination}${destinationPosition
          ? ` (${destinationPosition[0].toFixed(6)}, ${destinationPosition[1].toFixed(6)})` : ' (chưa có tọa độ bãi)'} · Đường đi thực tế cập nhật khi xe gửi GPS.`} />}
      {selectedTrip && <Card size="small" title="Bổ sung tọa độ cho chuyến xe">
        <Space wrap>
          <Button onClick={() => { setPickTarget('origin'); setPickedPosition(undefined); }}>Chọn điểm xuất phát trên bản đồ</Button>
          <Button onClick={() => { setPickTarget('destination'); setPickedPosition(undefined); }}>Chọn vị trí bãi đến trên bản đồ</Button>
          {pickTarget && <Text type="secondary">Bấm vào bản đồ bên dưới để đặt {pickTarget === 'origin' ? 'điểm xuất phát' : 'bãi đến'}{pickedPosition ? `: ${pickedPosition[0].toFixed(6)}, ${pickedPosition[1].toFixed(6)}` : ''}.</Text>}
          {pickTarget && <Button type="primary" disabled={!pickedPosition} loading={savingCoordinates} onClick={() => void savePickedPosition()}>Lưu tọa độ</Button>}
          {pickTarget && <Button onClick={() => { setPickTarget(undefined); setPickedPosition(undefined); }}>Hủy</Button>}
        </Space>
        <div className="mt-2"><Text type="secondary">Có thể chọn một điểm đại diện trong khu vực. Tọa độ được lưu cho chuyến này và dùng để tính tuyến đường.</Text></div>
      </Card>}
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card title="Bản đồ realtime và playback">
            <MapContainer center={mapCenter} zoom={13} scrollWheelZoom className="h-[480px] w-full rounded-lg">
              {pickTarget && <CoordinatePicker onPick={setPickedPosition} />}
              <FitRouteBounds coordinates={mapRouteCoordinates} />
              <TileLayer attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {routeEstimate && <Polyline positions={routeEstimate.coordinates}
                pathOptions={{ color: '#fa8c16', weight: 5, opacity: 0.9 }} />}
              {routeError && mapRouteCoordinates.length > 1 && <Polyline positions={mapRouteCoordinates}
                pathOptions={{ color: '#faad14', weight: 4, opacity: 0.8, dashArray: '8 8' }} />}
              {route.length > 1 && <Polyline positions={route} pathOptions={{ color: '#1677ff', weight: 4 }} />}
              {originPosition && <CircleMarker
                center={originPosition} radius={8}
                pathOptions={{ color: '#389e0d', fillColor: '#95de64', fillOpacity: 0.9 }}>
                <Tooltip permanent>Điểm xuất phát</Tooltip>
              </CircleMarker>}
              {destinationPosition && <CircleMarker
                center={destinationPosition} radius={8}
                pathOptions={{ color: '#cf1322', fillColor: '#ff7875', fillOpacity: 0.9 }}>
                <Tooltip permanent>Bãi đến: {selectedYard?.name ?? selectedTrip?.destination}</Tooltip>
              </CircleMarker>}
              {pickedPosition && <CircleMarker center={pickedPosition} radius={10}
                pathOptions={{ color: '#722ed1', fillColor: '#b37feb', fillOpacity: 0.9 }}>
                <Tooltip permanent>Điểm vừa chọn</Tooltip>
              </CircleMarker>}
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
