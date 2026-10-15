import { CameraOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Form, Input, InputNumber, message, Row, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';

type Goods = {
  id: string;
  tripId: string;
  itemCode: string;
  description?: string;
  quantity: number;
  unit: string;
  receivedQuantity: number;
  status: string;
  qrValue: string;
};
type Discrepancy = {
  id: string;
  goodsId: string;
  expectedQuantity: number;
  scannedQuantity: number;
  message: string;
  createdAt: string;
  resolved: boolean;
};
type GoodsQr = { goods: Goods; imageBase64: string };
const { Title, Text } = Typography;

function errorText(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) return error.response?.data?.message ?? 'Thao tác thất bại';
  return error instanceof Error ? error.message : 'Thao tác thất bại';
}

export default function GoodsPage() {
  const [goods, setGoods] = useState<Goods[]>([]);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [tripId, setTripId] = useState('');
  const [qrValue, setQrValue] = useState('');
  const [scannedQuantity, setScannedQuantity] = useState<number>(0);
  const [scanActive, setScanActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    try {
      const response = await api.get('/goods/discrepancies');
      setDiscrepancies(response.data.data);
      if (tripId) {
        const items = await api.get('/goods', { params: { tripId } });
        setGoods(items.data.data);
      }
    } catch (error) {
      message.error(errorText(error));
    }
  }, [tripId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!scanActive) return undefined;
    const scanner = new Html5QrcodeScanner('goods-qr-reader', { fps: 10, qrbox: { width: 220, height: 220 } }, false);
    scanner.render((decoded) => {
      setQrValue(decoded);
      setScanActive(false);
      void scanner.clear();
      message.success('Đã đọc mã QR hàng hóa');
    }, () => undefined);
    return () => {
      void scanner.clear().catch((error: unknown) => message.error(errorText(error)));
    };
  }, [scanActive]);

  const createBatch = async (values: { tripId: string; itemCode: string; description?: string; quantity: number; unit: string }) => {
    setSaving(true);
    try {
      const response = await api.post('/goods/batch', {
        tripId: values.tripId,
        items: [{ itemCode: values.itemCode, description: values.description, quantity: values.quantity, unit: values.unit }],
      });
      const qrItems = response.data.data as GoodsQr[];
      setTripId(values.tripId);
      setGoods((previous) => [...previous, ...qrItems.map((item) => item.goods)]);
      setQrImages((previous) => ({
        ...previous,
        ...Object.fromEntries(qrItems.map((item) => [item.goods.id, item.imageBase64])),
      }));
      message.success(`Đã tạo ${qrItems.length} mã QR duy nhất`);
      form.resetFields(['itemCode', 'description', 'quantity', 'unit']);
    } catch (error) {
      message.error(errorText(error));
    } finally {
      setSaving(false);
    }
  };

  const reconcile = async () => {
    const item = goods.find((candidate) => candidate.qrValue === qrValue);
    if (!item) {
      message.error('Không tìm thấy mặt hàng trong danh sách chuyến đi');
      return;
    }
    try {
      const response = await api.post(`/goods/${item.id}/reconcile`, { qrValue, scannedQuantity });
      const result = response.data.data as { mismatch: boolean };
      message[result.mismatch ? 'warning' : 'success'](result.mismatch
        ? 'Đã lưu sai lệch và tạo cảnh báo'
        : 'Số lượng đối chiếu chính xác');
      setQrValue('');
      await load();
    } catch (error) {
      message.error(errorText(error));
    }
  };

  const goodsColumns: ColumnsType<Goods> = [
    { title: 'Mã hàng', dataIndex: 'itemCode', key: 'itemCode' },
    { title: 'Mô tả', dataIndex: 'description', key: 'description' },
    { title: 'Số lượng dự kiến', key: 'quantity', render: (_, row) => `${row.quantity} ${row.unit}` },
    { title: 'Đã nhận', key: 'received', render: (_, row) => `${row.receivedQuantity} ${row.unit}` },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status',
      render: (value: string) => <Tag color={value === 'RECEIVED' ? 'green' : value === 'DISCREPANCY' ? 'red' : 'blue'}>{value}</Tag> },
    { title: 'QR', dataIndex: 'qrValue', key: 'qr', render: (value: string) => <Text code ellipsis>{value}</Text> },
  ];
  const discrepancyColumns: ColumnsType<Discrepancy> = [
    { title: 'Mã hàng', dataIndex: 'goodsId', key: 'goodsId', render: (id: string) => <Text code>{id.slice(0, 8)}</Text> },
    { title: 'Dự kiến / đã quét', key: 'quantities', render: (_, row) => `${row.expectedQuantity} / ${row.scannedQuantity}` },
    { title: 'Cảnh báo', dataIndex: 'message', key: 'message' },
    { title: 'Thời điểm', dataIndex: 'createdAt', key: 'createdAt', render: (value: string) => new Date(value).toLocaleString('vi-VN') },
    { title: 'Trạng thái', dataIndex: 'resolved', key: 'resolved', render: (value: boolean) =>
      <Tag color={value ? 'green' : 'red'}>{value ? 'Đã xử lý' : 'Chưa xử lý'}</Tag> },
  ];

  return (
    <Space direction="vertical" size="large" className="w-full">
      <Title level={3}>Hàng hóa và đối chiếu QR</Title>
      <Card title="Tạo mã QR hàng hóa">
        <Form form={form} layout="vertical" onFinish={createBatch}>
          <Row gutter={16}>
            <Col xs={24} md={8}><Form.Item name="tripId" label="Mã chuyến đi" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="itemCode" label="Mã hàng" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="description" label="Mô tả"><Input /></Form.Item></Col>
            <Col xs={12} md={8}><Form.Item name="quantity" label="Số lượng dự kiến" rules={[{ required: true }]}><InputNumber min={0.0001} className="w-full" /></Form.Item></Col>
            <Col xs={12} md={8}><Form.Item name="unit" label="Đơn vị" rules={[{ required: true }]}><Input placeholder="thùng, kg..." /></Form.Item></Col>
            <Col xs={24} md={8} className="flex items-end"><Button type="primary" htmlType="submit" loading={saving} icon={<PlusOutlined />}>Tạo QR</Button></Col>
          </Row>
        </Form>
      </Card>
      <Card title="Quét QR và đối chiếu số lượng">
        <Row gutter={16} align="middle">
          <Col xs={24} md={12}>
            <Space direction="vertical" className="w-full">
              <Input value={qrValue} onChange={(event) => setQrValue(event.target.value)} placeholder="Quét hoặc nhập mã QR hàng" />
              <InputNumber value={scannedQuantity} onChange={(value) => setScannedQuantity(value ?? 0)} min={0} className="w-full" addonBefore="Số lượng thực nhận" />
              <Space>
                <Button type="primary" onClick={() => void reconcile()} disabled={!qrValue}>Đối chiếu</Button>
                <Button icon={<CameraOutlined />} onClick={() => setScanActive((active) => !active)}>
                  {scanActive ? 'Đóng camera' : 'Quét bằng camera'}
                </Button>
              </Space>
            </Space>
          </Col>
          <Col xs={24} md={12}>
            <div id="goods-qr-reader" />
            {scanActive && <Alert className="mt-2" type="info" message="Cho phép camera và hướng vào mã QR hàng hóa" />}
          </Col>
        </Row>
      </Card>
      <Card title="Danh sách hàng hóa và QR">
        <Space.Compact className="mb-4 w-full">
          <Input value={tripId} onChange={(event) => setTripId(event.target.value)} placeholder="Mã chuyến đi để tải hàng hóa" />
          <Button type="primary" onClick={() => void load()}>Tải</Button>
        </Space.Compact>
        <Table rowKey="id" columns={goodsColumns} dataSource={goods} pagination={{ pageSize: 8 }} expandable={{
          expandedRowRender: (row) => qrImages[row.id]
            ? <img alt={`QR ${row.itemCode}`} className="h-40 w-40" src={`data:image/png;base64,${qrImages[row.id]}`} />
            : <Text type="secondary">Đang tải ảnh QR…</Text>,
          onExpand: (expanded, row) => {
            if (expanded && !qrImages[row.id]) {
              void api.get(`/goods/${row.id}/qr`).then((response) => {
                setQrImages((previous) => ({ ...previous, [row.id]: response.data.data.imageBase64 }));
              }).catch((error: unknown) => message.error(errorText(error)));
            }
          },
        }} />
      </Card>
      <Card title="Báo cáo sai lệch số lượng">
        <Table rowKey="id" columns={discrepancyColumns} dataSource={discrepancies} pagination={{ pageSize: 8 }} />
      </Card>
    </Space>
  );
}
