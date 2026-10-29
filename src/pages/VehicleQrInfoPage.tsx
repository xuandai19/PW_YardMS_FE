import { useEffect, useState } from 'react';
import { Alert, Card, Descriptions, Spin, Typography } from 'antd';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { api } from '../services/api';

type VehicleQrInfo = {
  plateNumber: string;
  driverName: string;
  driverPhone?: string;
  carrierCompany?: string;
  vehicleType?: string;
  plannedArrival: string;
  destinationYard: string;
};

export default function VehicleQrInfoPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [info, setInfo] = useState<VehicleQrInfo>();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Mã QR không hợp lệ hoặc không có token.');
      return;
    }
    let active = true;
    void api.get('/yard-logs/qr-info', { params: { token } })
      .then(response => { if (active) setInfo(response.data.data); })
      .catch((reason: unknown) => {
        if (!active) return;
        const message = axios.isAxiosError<{ message?: string }>(reason)
          ? reason.response?.data?.message : undefined;
        setError(message ?? 'Không thể tải thông tin xe. Mã QR có thể đã hết hạn.');
      });
    return () => { active = false; };
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-xl shadow-md">
        <Typography.Title level={3}>Thông tin xe đăng ký vào bãi</Typography.Title>
        <Typography.Paragraph type="secondary">
          Thông tin này được mở từ mã QR có chữ ký và thời hạn sử dụng.
        </Typography.Paragraph>
        {error ? <Alert type="error" showIcon message={error} /> : !info ? <Spin /> : (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="Biển số">{info.plateNumber}</Descriptions.Item>
            <Descriptions.Item label="Tài xế">{info.driverName}</Descriptions.Item>
            {info.driverPhone && <Descriptions.Item label="Điện thoại">{info.driverPhone}</Descriptions.Item>}
            {info.carrierCompany && <Descriptions.Item label="Đơn vị vận chuyển">{info.carrierCompany}</Descriptions.Item>}
            {info.vehicleType && <Descriptions.Item label="Loại xe">{info.vehicleType}</Descriptions.Item>}
            <Descriptions.Item label="Dự kiến đến">{new Date(info.plannedArrival).toLocaleString('vi-VN')}</Descriptions.Item>
            <Descriptions.Item label="Bãi đăng ký đến">{info.destinationYard}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>
    </main>
  );
}
