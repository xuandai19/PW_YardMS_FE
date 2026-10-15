import { Empty, Typography } from 'antd';
import { useLocation } from 'react-router-dom';

export function FoundationPlaceholderPage() {
  const location = useLocation();
  return (
    <div className="py-16">
      <Typography.Title level={3}>{location.pathname.slice(1).toUpperCase()}</Typography.Title>
      <Empty description="Module chưa triển khai trong Foundation sprint" />
    </div>
  );
}
