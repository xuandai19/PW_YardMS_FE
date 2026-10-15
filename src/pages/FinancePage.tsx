import { useEffect, useState } from 'react';
import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Table, Tabs, Tag, Upload, message } from 'antd';
import { api } from '../services/api';

type Debt = {
  id: string;
  partnerId: string;
  invoiceId: string;
  principalAmount: number;
  paidAmount: number;
  interestAccrued: number;
  dueDate: string;
  status: string;
};

type Invoice = {
  id: string;
  invoiceNo: string;
  partnerId: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  status: string;
};

type ServiceOrder = {
  id: string;
  vehicleId: string;
  serviceId: string;
  totalAmount: number;
  status: string;
};

type InterestEntry = {
  id: string;
  accrualDate: string;
  outstandingPrincipal: number;
  ratePerDayPercent: number;
  amount: number;
};

export default function FinancePage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [issueOpen, setIssueOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice>();
  const [paymentProof, setPaymentProof] = useState<File>();
  const [interestOpen, setInterestOpen] = useState(false);
  const [interestHistoryOpen, setInterestHistoryOpen] = useState(false);
  const [debtPartnerFilter, setDebtPartnerFilter] = useState('');
  const [invoicePartnerFilter, setInvoicePartnerFilter] = useState('');
  const [interestHistory, setInterestHistory] = useState<InterestEntry[]>([]);
  const [issueForm] = Form.useForm();
  const [paymentForm] = Form.useForm();
  const [interestForm] = Form.useForm();

  const load = async () => {
    const [debtResponse, invoiceResponse, orderResponse] = await Promise.all([
      api.get('/finance/debts'),
      api.get('/finance/invoices'),
      api.get('/service-orders'),
    ]);
    setDebts(debtResponse.data.data);
    setInvoices(invoiceResponse.data.data);
    setOrders(orderResponse.data.data);
  };

  useEffect(() => {
    void load().catch(() => message.error('Không thể tải dữ liệu tài chính'));
  }, []);

  const issueInvoice = async (values: { partnerId: string; contractId?: string; serviceOrderIds: string[]; dueDate: { format: (format: string) => string }; taxRatePercent?: number }) => {
    try {
      await api.post('/finance/invoices', {
        ...values,
        dueDate: values.dueDate.format('YYYY-MM-DD'),
        taxRatePercent: values.taxRatePercent ?? 0,
      });
      message.success('Đã phát hành hóa đơn');
      setIssueOpen(false);
      issueForm.resetFields();
      await load();
    } catch {
      message.error('Không thể phát hành hóa đơn');
    }
  };

  const recordPayment = async (values: { amount: number; referenceNo?: string; note?: string }) => {
    if (!paymentInvoice) return;
    try {
      const data = new FormData();
      data.append('amount', String(values.amount));
      data.append('paidAt', new Date().toISOString());
      if (values.referenceNo) data.append('referenceNo', values.referenceNo);
      if (values.note) data.append('note', values.note);
      if (paymentProof) data.append('proof', paymentProof);
      await api.post(`/finance/invoices/${paymentInvoice.id}/payments`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success('Đã ghi nhận thanh toán');
      setPaymentInvoice(undefined);
      setPaymentProof(undefined);
      paymentForm.resetFields();
      await load();
    } catch {
      message.error('Không thể ghi nhận thanh toán');
    }
  };

  const downloadInvoice = async (id: string) => {
    try {
      const response = await api.get(`/finance/invoices/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error('Không thể tải PDF hóa đơn');
    }
  };

  const submitEInvoice = async (id: string) => {
    try {
      await api.post(`/finance/invoices/${id}/e-invoice`);
      message.success('Đã gửi hóa đơn đến nhà cung cấp hóa đơn điện tử');
      await load();
    } catch {
      message.error('Không thể gửi hóa đơn điện tử; kiểm tra cấu hình nhà cung cấp');
    }
  };

  const configureInterest = async (values: { partnerId: string; ratePerDayPercent: number; graceDays: number; active: boolean }) => {
    try {
      const { partnerId, ...configuration } = values;
      await api.put(`/finance/interest-config/${partnerId}`, configuration);
      message.success('Đã lưu cấu hình lãi công nợ');
      setInterestOpen(false);
      interestForm.resetFields();
    } catch {
      message.error('Không thể lưu cấu hình lãi');
    }
  };

  const showInterestHistory = async (debtId: string) => {
    try {
      const response = await api.get(`/finance/debts/${debtId}/interest`);
      setInterestHistory(response.data.data);
      setInterestHistoryOpen(true);
    } catch {
      message.error('Không thể tải lịch sử tính lãi');
    }
  };

  const issueableOrders = orders.filter(order => order.status === 'COMPLETED');
  const filteredDebts = debts.filter(debt => debt.partnerId.toLowerCase().includes(debtPartnerFilter.toLowerCase()));
  const filteredInvoices = invoices.filter(invoice => invoice.partnerId.toLowerCase().includes(invoicePartnerFilter.toLowerCase()));
  const debtColumns = [
    { title: 'Đối tác', dataIndex: 'partnerId', key: 'partnerId' },
    { title: 'Hóa đơn', dataIndex: 'invoiceId', key: 'invoiceId' },
    { title: 'Gốc', dataIndex: 'principalAmount', key: 'principalAmount', render: (value: number) => value.toLocaleString('vi-VN') },
    { title: 'Đã trả', dataIndex: 'paidAmount', key: 'paidAmount', render: (value: number) => value.toLocaleString('vi-VN') },
    { title: 'Lãi', dataIndex: 'interestAccrued', key: 'interestAccrued', render: (value: number) => value.toLocaleString('vi-VN') },
    { title: 'Đến hạn', dataIndex: 'dueDate', key: 'dueDate' },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (status: string) => <Tag color={status === 'PAID' ? 'green' : 'orange'}>{status}</Tag> },
    { title: 'Lịch sử lãi', key: 'history', render: (_: unknown, debt: Debt) => <Button onClick={() => void showInterestHistory(debt.id)}>Xem</Button> },
  ];
  const invoiceColumns = [
    { title: 'Số hóa đơn', dataIndex: 'invoiceNo', key: 'invoiceNo' },
    { title: 'Đối tác', dataIndex: 'partnerId', key: 'partnerId' },
    { title: 'Ngày phát hành', dataIndex: 'issueDate', key: 'issueDate' },
    { title: 'Hạn thanh toán', dataIndex: 'dueDate', key: 'dueDate' },
    { title: 'Tổng', dataIndex: 'totalAmount', key: 'totalAmount', render: (value: number) => value.toLocaleString('vi-VN') },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (status: string) => <Tag color={status === 'PAID' ? 'green' : status === 'OVERDUE' ? 'red' : 'blue'}>{status}</Tag> },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_: unknown, invoice: Invoice) => (
        <Space>
          <Button onClick={() => void downloadInvoice(invoice.id)}>PDF</Button>
          <Button onClick={() => void submitEInvoice(invoice.id)}>Hóa đơn điện tử</Button>
          {invoice.status !== 'CANCELLED' && (
            <Button type="primary" onClick={() => setPaymentInvoice(invoice)}>Ghi thanh toán</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Công nợ và hóa đơn</h2>
        <Space>
          <Button onClick={() => setInterestOpen(true)}>Cấu hình lãi</Button>
          <Button type="primary" onClick={() => setIssueOpen(true)}>Phát hành hóa đơn</Button>
        </Space>
      </div>
      <Tabs items={[
        { key: 'debts', label: 'Công nợ', children: <>
          <Input.Search className="mb-3 max-w-md" allowClear placeholder="Lọc theo UUID đối tác"
            onChange={event => setDebtPartnerFilter(event.target.value)} />
          <Table rowKey="id" dataSource={filteredDebts} columns={debtColumns} />
        </> },
        { key: 'invoices', label: 'Hóa đơn', children: <>
          <Input.Search className="mb-3 max-w-md" allowClear placeholder="Lọc theo UUID đối tác"
            onChange={event => setInvoicePartnerFilter(event.target.value)} />
          <Table rowKey="id" dataSource={filteredInvoices} columns={invoiceColumns} />
        </> },
      ]} />
      <Modal open={issueOpen} title="Phát hành hóa đơn dịch vụ" footer={null} onCancel={() => setIssueOpen(false)}>
        <Form form={issueForm} layout="vertical" onFinish={issueInvoice}>
          <Form.Item name="partnerId" label="UUID đối tác nhận hóa đơn (A/C)" rules={[{ required: true }]}>
            <Input placeholder="UUID đối tác" />
          </Form.Item>
          <Form.Item name="contractId" label="Hợp đồng A–C (nếu xuất cho C)">
            <Input placeholder="UUID hợp đồng, nếu cần" />
          </Form.Item>
          <Form.Item name="serviceOrderIds" label="Đơn dịch vụ đã hoàn thành" rules={[{ required: true }]}>
            <Select mode="multiple" options={issueableOrders.map(order => ({
              value: order.id,
              label: `${order.id} · xe ${order.vehicleId} · ${order.totalAmount.toLocaleString('vi-VN')}`,
            }))} />
          </Form.Item>
          <Form.Item name="dueDate" label="Hạn thanh toán" rules={[{ required: true }]}>
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item name="taxRatePercent" label="Thuế (%)" initialValue={0}>
            <InputNumber min={0} max={100} className="w-full" />
          </Form.Item>
          <Button type="primary" htmlType="submit">Phát hành</Button>
        </Form>
      </Modal>
      <Modal open={interestOpen} title="Cấu hình lãi quá hạn" footer={null} onCancel={() => setInterestOpen(false)}>
        <Form form={interestForm} layout="vertical" initialValues={{ graceDays: 0, active: true }} onFinish={configureInterest}>
          <Form.Item name="partnerId" label="UUID đối tác" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="ratePerDayPercent" label="Lãi (%/ngày)" rules={[{ required: true }]}><InputNumber min={0} precision={5} className="w-full" /></Form.Item>
          <Form.Item name="graceDays" label="Số ngày ân hạn" rules={[{ required: true }]}><InputNumber min={0} precision={0} className="w-full" /></Form.Item>
          <Form.Item name="active" label="Đang áp dụng" valuePropName="checked" initialValue><Select options={[{ value: true, label: 'Có' }, { value: false, label: 'Không' }]} /></Form.Item>
          <Button type="primary" htmlType="submit">Lưu cấu hình</Button>
        </Form>
      </Modal>
      <Modal open={interestHistoryOpen} title="Lịch sử ghi nhận lãi" footer={null} onCancel={() => setInterestHistoryOpen(false)}>
        <Table rowKey="id" dataSource={interestHistory} pagination={false} columns={[
          { title: 'Ngày', dataIndex: 'accrualDate' },
          { title: 'Dư gốc', dataIndex: 'outstandingPrincipal', render: (value: number) => value.toLocaleString('vi-VN') },
          { title: 'Lãi %/ngày', dataIndex: 'ratePerDayPercent' },
          { title: 'Tiền lãi', dataIndex: 'amount', render: (value: number) => value.toLocaleString('vi-VN') },
        ]} />
      </Modal>
      <Modal open={!!paymentInvoice} title="Ghi nhận chuyển khoản" footer={null} onCancel={() => setPaymentInvoice(undefined)}>
        <Form form={paymentForm} layout="vertical" onFinish={recordPayment}>
          <Form.Item name="amount" label="Số tiền" rules={[{ required: true }]}>
            <InputNumber min={0.0001} className="w-full" />
          </Form.Item>
          <Form.Item name="referenceNo" label="Mã giao dịch"><Input /></Form.Item>
          <Form.Item name="note" label="Ghi chú"><Input.TextArea /></Form.Item>
          <Form.Item label="Chứng từ (PDF/JPEG/PNG, tối đa 10 MB)">
            <Upload maxCount={1} beforeUpload={file => { setPaymentProof(file); return false; }} onRemove={() => setPaymentProof(undefined)} accept=".pdf,.jpg,.jpeg,.png">
              <Button>Chọn chứng từ</Button>
            </Upload>
          </Form.Item>
          <Button type="primary" htmlType="submit">Lưu thanh toán</Button>
        </Form>
      </Modal>
    </div>
  );
}
