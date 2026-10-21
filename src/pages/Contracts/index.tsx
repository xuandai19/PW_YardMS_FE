import { useEffect, useState } from 'react';
import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Table, Tag, Upload, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { api } from '../../services/api';

export default function ContractsPage() {
  const [data, setData] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const load = async () => {
    try {
      const [contracts, partnerResponse] = await Promise.all([api.get('/contracts'), api.get('/partners')]);
      setData(contracts.data.data);
      setPartners(partnerResponse.data.data);
    } catch (error: any) { message.error(error.response?.data?.message ?? 'Không thể tải hợp đồng và đối tác'); }
  };
  useEffect(() => { void load(); }, []);
  const save = async (values: any) => {
    try {
      const payload = { ...values, startDate: values.startDate.format('YYYY-MM-DD'), endDate: values.endDate.format('YYYY-MM-DD'), partnerCId: values.partnerCId || null };
      await api.post('/contracts', payload);
      message.success('Đã tạo hợp đồng');
      setOpen(false);
      form.resetFields();
      await load();
    } catch (error: any) { message.error(error.response?.data?.message ?? 'Không thể tạo hợp đồng'); }
  };
  const upload = async (contractId: string, file: File) => {
    const body = new FormData();
    body.append('file', file);
    try {
      await api.post(`/contracts/${contractId}/upload`, body);
      message.success('Đã tải tệp hợp đồng');
      await load();
    } catch (error: any) { message.error(error.response?.data?.message ?? 'Không thể tải tệp hợp đồng'); }
    return false;
  };
  return <>
    <div className="flex justify-between mb-4"><h2 className="text-xl font-semibold">Hợp đồng</h2><Button type="primary" onClick={() => { form.resetFields(); setOpen(true); }}>Thêm hợp đồng</Button></div>
    <Table rowKey="id" dataSource={data} columns={[
      { title: 'Số hợp đồng', dataIndex: 'contractNo' }, { title: 'Loại', dataIndex: 'contractType' },
      { title: 'Bắt đầu', dataIndex: 'startDate' }, { title: 'Kết thúc', dataIndex: 'endDate' },
      { title: 'Trạng thái', dataIndex: 'status', render: (status: string) => <Tag color={status === 'ACTIVE' ? 'green' : 'red'}>{status}</Tag> },
      { title: 'Tệp', dataIndex: 'fileUrl', render: (fileUrl: string | null, row: any) => <Upload accept="application/pdf" showUploadList={false} beforeUpload={(file) => upload(row.id, file)}><Button icon={<UploadOutlined />}>{fileUrl ? 'Thay tệp' : 'Tải PDF'}</Button></Upload> },
    ]} />
    <Modal open={open} footer={null} onCancel={() => setOpen(false)} title="Tạo hợp đồng" destroyOnClose>
      <Form form={form} layout="vertical" onFinish={save} initialValues={{ contractValue: 0 }}>
        <Form.Item name="contractNo" label="Số hợp đồng" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="contractType" label="Loại hợp đồng" rules={[{ required: true }]}><Select onChange={(value) => { if (value !== 'A-C') form.setFieldValue('partnerCId', undefined); }} options={[{ value: 'A-B', label: 'A-B' }, { value: 'A-C', label: 'A-C' }]} /></Form.Item>
        <Form.Item name="partnerAId" label="Partner A" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={partners.filter((p) => p.partnerType === 'A').map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))} /></Form.Item>
        <Form.Item noStyle shouldUpdate={(prev, next) => prev.contractType !== next.contractType}>{({ getFieldValue }) => getFieldValue('contractType') === 'A-C' ? <Form.Item name="partnerCId" label="Partner C" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={partners.filter((p) => p.partnerType === 'C').map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))} /></Form.Item> : null}</Form.Item>
        <Form.Item name="startDate" label="Ngày bắt đầu" rules={[{ required: true }]}><DatePicker className="w-full" /></Form.Item>
        <Form.Item name="endDate" label="Ngày kết thúc" rules={[{ required: true }]}><DatePicker className="w-full" /></Form.Item>
        <Form.Item name="contractValue" label="Giá trị" rules={[{ required: true }]}><InputNumber min={0} className="w-full" /></Form.Item>
        <Button type="primary" htmlType="submit">Lưu</Button>
      </Form>
    </Modal>
  </>;
}
