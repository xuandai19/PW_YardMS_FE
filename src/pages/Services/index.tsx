import { useCallback, useEffect, useState } from 'react';
import { Button, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, message } from 'antd';
import { api } from '../../services/api';

const SERVICE_TYPES = [
  { value: 'YARD', label: 'Lưu bãi' },
  { value: 'HANDLING', label: 'Bốc xếp' },
  { value: 'MAINTENANCE', label: 'Bảo trì' },
  { value: 'FUEL', label: 'Nhiên liệu' },
  { value: 'OTHER', label: 'Khác' },
];

export default function ServicesPage() {
  const [data, setData] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>();
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    try {
      const response = await api.get('/services');
      setData(response.data.data);
    } catch (error: any) {
      message.error(error.response?.data?.message ?? 'Không thể tải danh sách dịch vụ');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openForm = (service?: any) => {
    setEditing(service);
    form.resetFields();
    form.setFieldsValue(service ? { ...service } : { unit: 'HOUR' });
    setOpen(true);
  };

  const save = async (values: any) => {
    const payload = {
      code: editing?.code ?? values.code.trim(),
      name: values.name.trim(),
      serviceType: values.serviceType,
      unit: values.unit?.trim() || 'HOUR',
      hourlyRate: values.hourlyRate,
      expectedDurationMinutes: values.expectedDurationMinutes ?? 60,
      active: editing?.active ?? true,
    };
    try {
      if (editing) await api.put(`/services/${editing.id}`, payload);
      else await api.post('/services', payload);
      setOpen(false);
      form.resetFields();
      await load();
      message.success(editing ? 'Đã cập nhật dịch vụ' : 'Đã thêm dịch vụ');
    } catch (error: any) {
      message.error(error.response?.data?.message ?? 'Không thể lưu dịch vụ');
    }
  };

  const changeActive = async (service: any, active: boolean) => {
    try {
      await api.put(`/services/${service.id}`, {
        code: service.code,
        name: service.name,
        serviceType: service.serviceType,
        unit: service.unit,
        hourlyRate: service.hourlyRate,
        expectedDurationMinutes: service.expectedDurationMinutes ?? 60,
        active,
      });
      await load();
    } catch (error: any) {
      message.error(error.response?.data?.message ?? 'Không thể cập nhật trạng thái dịch vụ');
    }
  };

  const showPriceHistory = async (serviceId: string) => {
    try {
      const response = await api.get(`/services/${serviceId}/price-history`);
      Modal.info({ title: 'Lịch sử giá', content: <pre>{JSON.stringify(response.data.data, null, 2)}</pre> });
    } catch (error: any) {
      message.error(error.response?.data?.message ?? 'Không thể tải lịch sử giá');
    }
  };

  return <>
    <div className="flex justify-between mb-4">
      <h2 className="text-xl font-semibold">Quản lý dịch vụ</h2>
      <Button type="primary" onClick={() => openForm()}>Thêm dịch vụ</Button>
    </div>
    <Table rowKey="id" dataSource={data} columns={[
      { title: 'Mã', dataIndex: 'code' },
      { title: 'Tên', dataIndex: 'name' },
      { title: 'Loại', dataIndex: 'serviceType', render: (type: string) => SERVICE_TYPES.find((item) => item.value === type)?.label ?? type },
      { title: 'Đơn giá', dataIndex: 'hourlyRate' },
      { title: 'Thời lượng dự kiến (phút)', dataIndex: 'expectedDurationMinutes' },
      { title: 'Đang hoạt động', dataIndex: 'active', render: (active: boolean, row: any) => <Switch checked={active} onChange={(value) => void changeActive(row, value)} /> },
      { title: 'Thao tác', render: (_: any, row: any) => <Space><Button onClick={() => openForm(row)}>Sửa</Button><Button onClick={() => void showPriceHistory(row.id)}>Lịch sử giá</Button></Space> },
    ]} />
    <Modal open={open} footer={null} onCancel={() => setOpen(false)} title={editing ? 'Sửa dịch vụ' : 'Thêm dịch vụ'} destroyOnClose>
      <Form form={form} layout="vertical" onFinish={save}>
        <Form.Item name="code" label="Mã dịch vụ" rules={[{ required: true, whitespace: true, message: 'Nhập mã dịch vụ' }]}><Input disabled={!!editing} /></Form.Item>
        <Form.Item name="name" label="Tên dịch vụ" rules={[{ required: true, whitespace: true, message: 'Nhập tên dịch vụ' }]}><Input /></Form.Item>
        <Form.Item name="serviceType" label="Loại dịch vụ" rules={[{ required: true, message: 'Chọn loại dịch vụ' }]}>
          <Select options={SERVICE_TYPES} placeholder="Chọn loại dịch vụ" />
        </Form.Item>
        <Form.Item name="unit" label="Đơn vị"><Input placeholder="Mặc định: HOUR" /></Form.Item>
        <Form.Item name="hourlyRate" label="Đơn giá/giờ" rules={[{ required: true, message: 'Nhập đơn giá' }]}><InputNumber min={0} className="w-full" /></Form.Item>
        <Form.Item name="expectedDurationMinutes" label="Thời lượng dự kiến (phút)" rules={[{ required: true, type: 'number', min: 1, message: 'Nhập số phút lớn hơn 0' }]}><InputNumber min={1} className="w-full" /></Form.Item>
        <Button type="primary" htmlType="submit">Lưu</Button>
      </Form>
    </Modal>
  </>;
}
