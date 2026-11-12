import { useState } from 'react';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/dashboard';

  const submit = async (values: { username: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
      await login(values);
      const raw = localStorage.getItem('yms_user');
      const currentUser = raw ? JSON.parse(raw) as { roles: string[]; permissions: string[] } : { roles: [], permissions: [] };
      const roles = currentUser.roles;
      const permissions = currentUser.permissions;
      const target = roles.includes('ADMIN') ? '/dashboard'
        : permissions.some(permission => ['VEHICLE_OPERATE', 'GATE_OPERATE', 'SERVICE_DISPATCH', 'YARD_READ', 'YARD_WRITE'].includes(permission)) ? '/operations'
          : permissions.includes('FINANCE_READ') || permissions.includes('FINANCE_WRITE') ? '/finance'
            : permissions.includes('TRACKING_READ') || permissions.includes('TRACKING_WRITE') ? '/tracking'
              : permissions.includes('REPORT_READ') ? '/reports'
                : permissions.includes('GOODS_READ') || permissions.includes('GOODS_WRITE') ? '/goods'
                  : permissions.includes('PARTNER_READ') || permissions.includes('PARTNER_WRITE') ? '/partners'
                    : '/dashboard';
      navigate(from === '/dashboard' ? target : from, { replace: true });
    } catch {
      setError('Tên đăng nhập hoặc mật khẩu không hợp lệ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-md" bordered={false}>
        <div className="mb-6">
          <Typography.Title level={2}>YMS Admin</Typography.Title>
          <Typography.Paragraph type="secondary">Foundation authentication</Typography.Paragraph>
        </div>
        {error && <Alert className="mb-4" type="error" message={error} showIcon />}
        <Form layout="vertical" onFinish={submit}>
          <Form.Item label="Username" name="username" rules={[{ required: true, message: 'Nhập username' }]}>
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item label="Password" name="password" rules={[{ required: true, message: 'Nhập password' }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>Đăng nhập</Button>
        </Form>
      </Card>
    </div>
  );
}
