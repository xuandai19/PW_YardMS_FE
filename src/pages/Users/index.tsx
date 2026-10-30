import { useEffect, useState } from 'react';
import { Button, Checkbox, Form, Input, Modal, Select, Space, Switch, Table, Tag, message } from 'antd';
import { api } from '../../services/api';

export default function UsersPage() {
  const [data, setData] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>();
  const [form] = Form.useForm();
  const load = async () => {
    try {
      const [users, availableRoles, availablePermissions] = await Promise.all([
        api.get('/users'), api.get('/roles'), api.get('/rbac/permissions'),
      ]);
      setData(users.data.data);
      setRoles(availableRoles.data.data);
      setPermissions(availablePermissions.data.data);
    } catch (error: any) { message.error(error.response?.data?.message ?? 'Không thể tải người dùng và vai trò'); }
  };
  useEffect(() => { void load(); }, []);
  const openForm = (user?: any) => {
    setEditing(user);
    form.resetFields();
    if (user) form.setFieldsValue({ ...user, password: undefined });
    else form.setFieldsValue({ enabled: true, roles: [], permissions: [] });
    setOpen(true);
  };
  const save = async (values: any) => {
    const payload = { ...values, roles: values.roles ?? [] };
    if (!payload.password) delete payload.password;
    try {
      if (editing) await api.put(`/users/${editing.id}`, payload);
      else await api.post('/users', payload);
      setOpen(false);
      await load();
      message.success('Đã lưu người dùng');
    } catch (error: any) { message.error(error.response?.data?.message ?? 'Không thể lưu người dùng'); }
  };
  const remove = async (id: string) => {
    try { await api.delete(`/users/${id}`); await load(); message.success('Đã xóa người dùng'); }
    catch (error: any) { message.error(error.response?.data?.message ?? 'Không thể xóa người dùng'); }
  };
  return <>
    <div className="flex justify-between mb-4"><h2 className="text-xl font-semibold">Quản lý người dùng</h2><Button type="primary" onClick={() => openForm()}>Thêm user</Button></div>
    <Table rowKey="id" dataSource={data} columns={[
      { title: 'Username', dataIndex: 'username' },
      { title: 'Overrides', dataIndex: 'permissionOverrides', render: (items: Record<string, string>) => Object.entries(items ?? {}).map(([code, effect]) => <Tag key={code} color={effect === 'GRANT' ? 'green' : 'red'}>{effect}: {code}</Tag>) },
      { title: 'Vai trò', dataIndex: 'roles', render: (items: string[]) => items?.map((role) => <Tag key={role}>{role}</Tag>) },
      { title: 'Hoạt động', dataIndex: 'enabled', render: (enabled: boolean) => <Switch checked={enabled} disabled /> },
      { title: 'Thao tác', render: (_: any, row: any) => <Space><Button onClick={() => openForm(row)}>Sửa</Button><Button danger onClick={() => void remove(row.id)}>Xóa</Button></Space> },
    ]} />
    <Modal open={open} title={editing ? 'Sửa user' : 'Thêm user'} footer={null} onCancel={() => setOpen(false)} destroyOnClose>
      <Form form={form} layout="vertical" onFinish={save} onValuesChange={(changed, values) => {
        if (!('roles' in changed)) return;
        const selectedRoles = roles.filter(role => (values.roles ?? []).includes(role.code));
        form.setFieldValue('permissions', [...new Set(selectedRoles.flatMap(role => role.permissions ?? []))]);
      }}>
        <Form.Item name="username" label="Username" rules={[{ required: true }]}><Input disabled={!!editing} /></Form.Item>
        <Form.Item name="password" label={editing ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu'} rules={editing ? [] : [{ required: true, min: 8 }]}><Input.Password /></Form.Item>
        <Form.Item name="roles" label="Vai trò" rules={[{ required: true, message: 'Chọn ít nhất một vai trò' }]}><Select mode="multiple" options={roles.map((role) => ({ label: `${role.name} (${role.code})`, value: role.code }))} /></Form.Item>
        <Form.Item noStyle shouldUpdate={(previous, current) => previous.roles !== current.roles}>
          {({ getFieldValue }) => {
            const isAdmin = (getFieldValue('roles') ?? []).includes('ADMIN');
            return <Form.Item name="permissions" label="Permissions riêng cho tài khoản"
              extra={isAdmin ? 'Admin luôn có wildcard * và toàn bộ permissions; không thể bị giới hạn.' : 'Tick để cấp quyền hiệu lực. Bỏ tick quyền kế thừa sẽ lưu DENY; tick quyền ngoài role sẽ lưu GRANT.'}>
              <div className="max-h-64 overflow-y-auto rounded border p-3">
                <Checkbox.Group disabled={isAdmin} className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                  options={permissions.filter(permission => isAdmin || permission.code !== '*').map(permission => ({
                    value: permission.code,
                    label: `${permission.module} · ${permission.name} (${permission.code})`,
                  }))} />
              </div>
            </Form.Item>;
          }}
        </Form.Item>
        <Form.Item name="enabled" label="Đang hoạt động" valuePropName="checked"><Switch /></Form.Item>
        <Button type="primary" htmlType="submit">Lưu</Button>
      </Form>
    </Modal>
  </>;
}
