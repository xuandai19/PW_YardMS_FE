import { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Table, message } from 'antd';
import { api } from '../../services/api';

export default function PartnersPage() {
  const [data, setData] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>();
  const [form] = Form.useForm();
  const load = async () => { try { setData((await api.get('/partners')).data.data); } catch (e: any) { message.error(e.response?.data?.message ?? 'Không thể tải đối tác'); } };
  useEffect(() => { void load(); }, []);
  const openForm = (partner?: any) => { setEditing(partner); form.resetFields(); if (partner) form.setFieldsValue(partner); setOpen(true); };
  const save = async (values: any) => {
    try {
      if (editing) await api.put(`/partners/${editing.id}`, { ...editing, ...values });
      else await api.post('/partners', values);
      setOpen(false); await load(); message.success('Đã lưu đối tác');
    } catch (e: any) { message.error(e.response?.data?.message ?? 'Không thể lưu đối tác'); }
  };
  const remove = async (id: string) => { try { await api.delete(`/partners/${id}`); await load(); message.success('Đã xóa đối tác'); } catch (e: any) { message.error(e.response?.data?.message ?? 'Không thể xóa đối tác'); } };
  return <>
    <div className="flex justify-between mb-4"><h2 className="text-xl font-semibold">Đối tác A / C</h2><Button type="primary" onClick={() => openForm()}>Thêm đối tác</Button></div>
    <Table rowKey="id" dataSource={data} columns={[
      { title: 'Mã', dataIndex: 'code' }, { title: 'Tên', dataIndex: 'name' }, { title: 'Loại', dataIndex: 'partnerType' }, { title: 'Quốc gia', dataIndex: 'countryCode' }, { title: 'MST', dataIndex: 'taxCode' },
      { title: 'Thao tác', render: (_: any, row: any) => <Space><Button onClick={() => openForm(row)}>Sửa</Button><Button danger onClick={() => void remove(row.id)}>Xóa</Button></Space> },
    ]} />
    <Modal open={open} footer={null} onCancel={() => setOpen(false)} title={editing ? 'Sửa đối tác' : 'Thêm đối tác'} destroyOnClose>
      <Form form={form} layout="vertical" onFinish={save}>
        <Form.Item name="code" label="Mã" rules={[{ required: true }]}><Input disabled={!!editing} /></Form.Item>
        <Form.Item name="name" label="Tên" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="partnerType" label="Loại" rules={[{ required: true }]}><Select options={[{ label: 'A', value: 'A' }, { label: 'C', value: 'C' }]} /></Form.Item>
        <Form.Item name="countryCode" label="Quốc gia" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="taxCode" label="Mã số thuế"><Input /></Form.Item>
        <Button type="primary" htmlType="submit">Lưu</Button>
      </Form>
    </Modal>
  </>;
}
