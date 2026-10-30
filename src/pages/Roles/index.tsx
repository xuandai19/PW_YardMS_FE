import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Space, Table, Tag, message } from 'antd';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

type Permission = { id: string; code: string; name: string; module: string };
type Role = { id: string; code: string; name: string; permissions: string[] };

export default function RolesPage() {
  const { user } = useAuth();
  const isAdmin = !!user?.roles.includes('ADMIN');
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void Promise.all([api.get('/roles'), api.get('/rbac/permissions')]).then(([roleResponse, permissionResponse]) => {
      setRoles(roleResponse.data.data);
      setPermissions(permissionResponse.data.data);
      setDraft(Object.fromEntries(roleResponse.data.data.map((role: Role) => [role.code, role.permissions])));
    }).catch(error => message.error(error.response?.data?.message ?? 'Không thể tải vai trò và permissions'));
  }, []);

  const dirty = roles.some(role => JSON.stringify([...(draft[role.code] ?? [])].sort())
    !== JSON.stringify([...role.permissions].sort()));

  const save = async () => {
    setSaving(true);
    try {
      const changedRoles = roles.filter(role => role.code !== 'ADMIN' &&
        JSON.stringify([...(draft[role.code] ?? [])].sort()) !== JSON.stringify([...role.permissions].sort()));
      for (const role of changedRoles) {
        try {
          await api.put(`/roles/${role.id}/permissions`, { permissionCodes: draft[role.code] ?? [] });
        } catch (error: any) {
          const detail = error.response?.data?.message ?? 'Lỗi máy chủ khi lưu permission';
          throw new Error(`${role.name} (${role.code}): ${detail}`);
        }
      }
      message.success('Đã lưu ma trận permissions cho các vai trò');
      const response = await api.get('/roles');
      setRoles(response.data.data);
      setDraft(Object.fromEntries(response.data.data.map((role: Role) => [role.code, role.permissions])));
    } catch (error: any) {
      message.error(error.message ?? error.response?.data?.message ?? 'Không thể lưu ma trận permissions');
    } finally { setSaving(false); }
  };

  const columns = useMemo(() => [
    { title: 'Module', dataIndex: 'module', key: 'module', filters: [...new Set(permissions.map(item => item.module))].map(value => ({ text: value, value })), onFilter: (value: boolean | React.Key, record: Permission) => record.module === value },
    { title: 'Permission', dataIndex: 'name', key: 'name', render: (name: string, permission: Permission) => <Space direction="vertical" size={0}><span>{name}</span><Tag>{permission.code}</Tag></Space> },
    ...['STAFF', 'MANAGER', 'ADMIN'].map(code => ({
      title: code,
      key: code,
      align: 'center' as const,
      render: (_: unknown, permission: Permission) => {
        const role = roles.find(item => item.code === code);
        const checked = code === 'ADMIN' ? true : (draft[code] ?? role?.permissions ?? []).includes(permission.code);
        return <Checkbox disabled={!isAdmin || code === 'ADMIN'} checked={checked}
          onChange={event => setDraft(current => {
            const selected = new Set(current[code] ?? role?.permissions ?? []);
            if (event.target.checked) selected.add(permission.code);
            else selected.delete(permission.code);
            return { ...current, [code]: [...selected] };
          })} />;
      },
    })),
  ], [draft, isAdmin, permissions, roles]);

  return <Space direction="vertical" size="middle" className="w-full">
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-semibold">Ma trận Roles & Permissions</h2>
      {isAdmin && <Button type="primary" disabled={!dirty} loading={saving} onClick={() => void save()}>Lưu ma trận</Button>}
    </div>
    <Alert type="info" showIcon message="Role permissions là quyền mặc định được kế thừa. Quyền riêng của từng tài khoản có thể cấp thêm hoặc từ chối quyền kế thừa tại màn hình Users." />
    {!isAdmin && <Alert type="warning" showIcon message="Chỉ Admin mới được thay đổi ma trận quyền của vai trò." />}
    <Table rowKey="code" dataSource={permissions.filter(permission => permission.code !== '*')} columns={columns} pagination={{ pageSize: 25 }} />
    <div><Tag color="green">Admin *</Tag> Admin luôn có wildcard và mọi quyền; không thể giới hạn từ ma trận.</div>
  </Space>;
}
