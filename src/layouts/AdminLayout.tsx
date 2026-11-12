import { Breadcrumb, Button, Layout, Menu, Space, Typography } from 'antd';
import { AppstoreOutlined, CarOutlined, LogoutOutlined, SettingOutlined, DashboardOutlined, UserOutlined, SafetyOutlined, FileTextOutlined, ToolOutlined, EnvironmentOutlined, QrcodeOutlined, CheckCircleOutlined, DollarOutlined, BarChartOutlined } from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: <Link to="/dashboard">Dashboard</Link> },
  { key: '/operations', icon: <CarOutlined />, label: <Link to="/operations">Vận hành</Link> },
  { key: '/tracking', icon: <EnvironmentOutlined />, label: <Link to="/tracking">Theo dõi GPS</Link> },
  { key: '/goods', icon: <QrcodeOutlined />, label: <Link to="/goods">Hàng hóa QR</Link> },
  { key: '/confirmations', icon: <CheckCircleOutlined />, label: <Link to="/confirmations">Xác nhận tài xế</Link> },
  { key: '/finance', icon: <DollarOutlined />, label: <Link to="/finance">Công nợ & hóa đơn</Link> },
  { key: '/reports', icon: <BarChartOutlined />, label: <Link to="/reports">Báo cáo</Link> },
  { key: '/users', icon: <UserOutlined />, label: <Link to="/users">Users</Link> },
  { key: '/roles', icon: <SafetyOutlined />, label: <Link to="/roles">Roles & Permissions</Link> },
  { key: '/partners', icon: <AppstoreOutlined />, label: <Link to="/partners">Đối tác A/C</Link> },
  { key: '/contracts', icon: <FileTextOutlined />, label: <Link to="/contracts">Hợp đồng</Link> },
  { key: '/services', icon: <ToolOutlined />, label: <Link to="/services">Dịch vụ</Link> },
  { key: '/settings', icon: <SettingOutlined />, label: <Link to="/settings">Cấu hình</Link> },
];

const menuPermissions: Record<string, string[]> = {
  '/dashboard': ['REPORT_READ', 'REPORT_WRITE'],
  '/operations': ['VEHICLE_OPERATE', 'GATE_OPERATE', 'SERVICE_DISPATCH', 'YARD_READ', 'YARD_WRITE'],
  '/tracking': ['TRACKING_READ', 'TRACKING_WRITE'],
  '/goods': ['GOODS_READ', 'GOODS_WRITE'],
  '/confirmations': ['CONFIRMATION_READ', 'CONFIRMATION_WRITE'],
  '/finance': ['FINANCE_READ', 'FINANCE_WRITE'],
  '/reports': ['REPORT_READ', 'REPORT_WRITE'],
  '/users': ['USER_READ', 'USER_WRITE'],
  '/roles': ['USER_READ', 'USER_WRITE'],
  '/partners': ['PARTNER_READ', 'PARTNER_WRITE'],
  '/contracts': ['CONTRACT_READ', 'CONTRACT_WRITE'],
  '/services': ['SERVICE_READ', 'SERVICE_WRITE'],
};

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const visibleMenuItems = menuItems.filter(item => {
    if (user?.roles.includes('ADMIN')) return true;
    if (item.key === '/users' || item.key === '/roles' || item.key === '/settings') return false;
    return (menuPermissions[item.key] ?? []).some(permission => user?.permissions.includes(permission));
  });

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <Layout className="min-h-screen">
      <Sider breakpoint="lg" collapsedWidth="0">
        <div className="px-5 py-5 text-lg font-semibold text-white">YMS Admin</div>
        <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} items={visibleMenuItems} />
      </Sider>
      <Layout>
        <Header className="flex items-center justify-between bg-white px-6 shadow-sm">
          <Typography.Title level={4} className="!mb-0">Yard Management System</Typography.Title>
          <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>Đăng xuất</Button>
        </Header>
        <Content className="m-4 rounded-xl bg-white p-6 shadow-sm">
          <Space direction="vertical" size="large" className="w-full">
            <Breadcrumb
              items={location.pathname.split('/').filter(Boolean).map((segment, index, all) => ({
                title: segment.charAt(0).toUpperCase() + segment.slice(1),
                href: `/${all.slice(0, index + 1).join('/')}`,
              }))}
            />
            <Outlet />
          </Space>
        </Content>
      </Layout>
    </Layout>
  );
}
