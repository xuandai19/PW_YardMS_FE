import { useEffect, useState } from 'react';
import { Alert, Button, DatePicker, Empty, Form, Input, InputNumber, Modal, Select, Space, Table, Tabs, Tag, Upload, message } from 'antd';
import axios from 'axios';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

function apiError(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string }>(error)) return error.response?.data?.message ?? fallback;
  return error instanceof Error ? error.message : fallback;
}

type PartnerOption = { id: string; code: string; name: string; partnerType: string };
type ContractOption = {
  id: string;
  contractNo: string;
  contractType: string;
  partnerAId: string;
  partnerCId?: string;
  startDate: string;
  endDate: string;
  status: string;
};

type Debt = {
  id: string;
  partnerId: string;
  invoiceId: string;
  principalAmount: number;
  paidAmount: number;
  interestAccrued: number;
  interestPaid: number;
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
  deliveryStatus?: string;
  deliveryError?: string;
};

type ServiceOrder = {
  id: string;
  vehicleId: string;
  plateNumber: string;
  serviceId: string;
  serviceName: string;
  totalAmount: number;
  quantity: number;
  unitPrice: number;
  status: string;
};

type InvoiceLine = { serviceOrderId: string; plateNumber: string; serviceCode: string; serviceName: string; quantity: number; unitPrice: number; lineAmount: number };

type InterestEntry = {
  id: string;
  accrualDate: string;
  outstandingPrincipal: number;
  ratePerDayPercent: number;
  amount: number;
};

export default function FinancePage() {
  const { user } = useAuth();
  const canManageFinance = !!user?.roles.some(role => ['ADMIN', 'MANAGER'].includes(role));
  const [debts, setDebts] = useState<Debt[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [issueableOrders, setIssueableOrders] = useState<ServiceOrder[]>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [issueOpen, setIssueOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice>();
  const [paymentProof, setPaymentProof] = useState<File>();
  const [interestOpen, setInterestOpen] = useState(false);
  const [interestHistoryOpen, setInterestHistoryOpen] = useState(false);
  const [debtPartnerFilter, setDebtPartnerFilter] = useState('');
  const [invoicePartnerFilter, setInvoicePartnerFilter] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('ALL');
  const [invoiceDetail, setInvoiceDetail] = useState<Invoice>();
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([]);
  const [interestHistory, setInterestHistory] = useState<InterestEntry[]>([]);
  const [selectedDebtId, setSelectedDebtId] = useState<string>();
  const [issueForm] = Form.useForm();
  const [paymentForm] = Form.useForm();
  const [interestForm] = Form.useForm();

  const load = async () => {
    const [debtResponse, invoiceResponse, partnerResponse, contractResponse] = await Promise.all([
      api.get('/finance/debts'),
      api.get('/finance/invoices'),
      api.get('/partners'),
      api.get('/contracts'),
    ]);
    setDebts(debtResponse.data.data);
    setInvoices(invoiceResponse.data.data);
    setPartners(partnerResponse.data.data);
    setContracts(contractResponse.data.data);
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
    } catch (error) {
      message.error(apiError(error, 'Không thể phát hành hóa đơn'));
    }
  };

  const loadIssueableOrders = async (partnerId?: string, contractId?: string) => {
    if (!partnerId) {
      setIssueableOrders([]);
      return;
    }
    try {
      const response = await api.get('/finance/issueable-orders', {
        params: { partnerId, ...(contractId ? { contractId } : {}) },
      });
      setIssueableOrders(response.data.data);
    } catch (error) {
      setIssueableOrders([]);
      message.error(apiError(error, 'Không thể tải đơn dịch vụ đủ điều kiện lập hóa đơn'));
    }
  };

  const onIssueValuesChange = (changed: Record<string, unknown>, values: { partnerId?: string; contractId?: string }) => {
    if ('partnerId' in changed) {
      issueForm.setFieldValue('contractId', undefined);
      issueForm.setFieldValue('serviceOrderIds', []);
      void loadIssueableOrders(values.partnerId);
    } else if ('contractId' in changed) {
      issueForm.setFieldValue('serviceOrderIds', []);
      void loadIssueableOrders(values.partnerId, values.contractId);
    }
  };

  const outstandingForInvoice = (invoice: Invoice) => {
    const debt = debts.find(item => item.invoiceId === invoice.id);
    if (!debt) return Math.max(0, invoice.totalAmount);
    return Math.max(0, debt.principalAmount - debt.paidAmount
      + debt.interestAccrued - debt.interestPaid);
  };

  const recordPayment = async (values: { referenceNo?: string; note?: string }) => {
    if (!paymentInvoice) return;
    const amountDue = outstandingForInvoice(paymentInvoice);
    if (amountDue <= 0) {
      message.info('Hóa đơn này đã được thanh toán đủ.');
      return;
    }
    try {
      const data = new FormData();
      data.append('amount', amountDue.toFixed(4));
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
    } catch (error) {
      message.error(apiError(error, 'Không thể ghi nhận thanh toán'));
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
    } catch (error) {
      message.error(apiError(error, 'Không thể tải PDF hóa đơn'));
    }
  };

  const showInvoiceDetail = async (invoice: Invoice) => {
    try {
      const response = await api.get(`/finance/invoices/${invoice.id}/items`);
      setInvoiceLines(response.data.data);
      setInvoiceDetail(invoice);
    } catch (error) {
      message.error(apiError(error, 'Không thể tải các khoản trong hóa đơn'));
    }
  };

  const submitEInvoice = async (id: string) => {
    try {
      await api.post(`/finance/invoices/${id}/e-invoice`);
      message.success('Đã gửi hóa đơn đến nhà cung cấp hóa đơn điện tử');
      await load();
    } catch (error) {
      message.error(apiError(error, 'Không thể gửi hóa đơn điện tử; kiểm tra cấu hình nhà cung cấp'));
    }
  };

  const configureInterest = async (values: { partnerId: string; ratePerDayPercent: number; graceDays: number; active: boolean }) => {
    try {
      const { partnerId, ...configuration } = values;
      await api.put(`/finance/interest-config/${partnerId}`, configuration);
      message.success('Đã lưu cấu hình lãi công nợ');
      setInterestOpen(false);
      interestForm.resetFields();
    } catch (error) {
      message.error(apiError(error, 'Không thể lưu cấu hình lãi'));
    }
  };

  const showInterestHistory = async (debtId: string) => {
    try {
      const response = await api.get(`/finance/debts/${debtId}/interest`);
      setInterestHistory(response.data.data);
      setSelectedDebtId(debtId);
      setInterestHistoryOpen(true);
    } catch (error) {
      message.error(apiError(error, 'Không thể tải lịch sử tính lãi'));
    }
  };

  const accrueInterestNow = async () => {
    try {
      const response = await api.post('/finance/interest/accrue');
      message.success(`Đã ghi nhận lãi cho ${response.data.data} khoản nợ.`);
      await load();
      if (selectedDebtId) {
        const history = await api.get(`/finance/debts/${selectedDebtId}/interest`);
        setInterestHistory(history.data.data);
      }
    } catch (error) {
      message.error(apiError(error, 'Không thể tính lãi công nợ'));
    }
  };

  const partnerName = (partnerId: string) => {
    const partner = partners.find(item => item.id === partnerId);
    return partner ? `${partner.code} - ${partner.name}` : partnerId;
  };
  const eligibleContracts = (partnerId?: string) => contracts.filter(contract =>
    contract.status === 'ACTIVE'
    && contract.startDate <= new Date().toISOString().slice(0, 10)
    && contract.endDate >= new Date().toISOString().slice(0, 10)
    && (contract.partnerAId === partnerId || contract.partnerCId === partnerId));
  const filteredDebts = debts.filter(debt => partnerName(debt.partnerId).toLowerCase().includes(debtPartnerFilter.toLowerCase()));
  const filteredInvoices = invoices.filter(invoice =>
    partnerName(invoice.partnerId).toLowerCase().includes(invoicePartnerFilter.toLowerCase())
    && (invoiceStatusFilter === 'ALL' || (invoiceStatusFilter === 'PAID'
      ? invoice.status === 'PAID' : ['UNPAID', 'OVERDUE'].includes(invoice.status))));
  const debtColumns = [
    { title: 'Đối tác', dataIndex: 'partnerId', key: 'partnerId', render: (id: string) => partnerName(id) },
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
    { title: 'Đối tác', dataIndex: 'partnerId', key: 'partnerId', render: (id: string) => partnerName(id) },
    { title: 'Ngày phát hành', dataIndex: 'issueDate', key: 'issueDate' },
    { title: 'Hạn thanh toán', dataIndex: 'dueDate', key: 'dueDate' },
    { title: 'Tổng', dataIndex: 'totalAmount', key: 'totalAmount', render: (value: number) => value.toLocaleString('vi-VN') },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (status: string) => <Tag color={status === 'PAID' ? 'green' : status === 'OVERDUE' ? 'red' : 'blue'}>{status}</Tag> },
    { title: 'Gửi email', dataIndex: 'deliveryStatus', key: 'deliveryStatus', render: (status?: string, invoice?: Invoice) => (
      <Tag title={invoice?.deliveryError} color={status === 'SENT' ? 'green' : status === 'FAILED' ? 'red' : 'default'}>
        {status === 'SENT' ? 'Đã gửi' : status === 'FAILED' ? 'Gửi lỗi' : status === 'PENDING' ? 'Đang gửi' : 'Chưa gửi'}
      </Tag>
    ) },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_: unknown, invoice: Invoice) => (
        <Space>
          <Button onClick={() => void showInvoiceDetail(invoice)}>Xem khoản mục</Button>
          <Button onClick={() => void downloadInvoice(invoice.id)}>PDF</Button>
          {canManageFinance && <Button onClick={() => void submitEInvoice(invoice.id)}>Hóa đơn điện tử</Button>}
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
          {canManageFinance && <Button onClick={() => setInterestOpen(true)}>Cấu hình lãi</Button>}
          {canManageFinance && <Button type="primary" onClick={() => setIssueOpen(true)}>Phát hành hóa đơn</Button>}
        </Space>
      </div>
      <Tabs items={[
        { key: 'debts', label: 'Công nợ', children: <>
          <Input.Search className="mb-3 max-w-md" allowClear placeholder="Lọc theo mã hoặc tên đối tác"
            onChange={event => setDebtPartnerFilter(event.target.value)} />
          <Table rowKey="id" dataSource={filteredDebts} columns={debtColumns} />
        </> },
        { key: 'invoices', label: 'Hóa đơn', children: <>
          <Select className="mb-3 mr-3 w-52" value={invoiceStatusFilter} onChange={setInvoiceStatusFilter} options={[
            { value: 'ALL', label: 'Tất cả trạng thái' }, { value: 'PAID', label: 'Đã thanh toán' },
            { value: 'UNPAID', label: 'Chưa thanh toán' },
          ]} />
          <Input.Search className="mb-3 max-w-md" allowClear placeholder="Lọc theo mã hoặc tên đối tác"
            onChange={event => setInvoicePartnerFilter(event.target.value)} />
          <Table rowKey="id" dataSource={filteredInvoices} columns={invoiceColumns} />
        </> },
      ]} />
      <Modal open={issueOpen} title="Phát hành hóa đơn dịch vụ" footer={null} onCancel={() => setIssueOpen(false)}>
        <Form form={issueForm} layout="vertical" onFinish={issueInvoice} onValuesChange={onIssueValuesChange}>
          <Form.Item name="partnerId" label="Đối tác nhận hóa đơn" rules={[{ required: true, message: 'Chọn đối tác nhận hóa đơn' }]}>
            <Select showSearch optionFilterProp="label" options={partners.map((partner) => ({ value: partner.id, label: `${partner.code} - ${partner.name} (${partner.partnerType})` }))} placeholder="Chọn đối tác" />
          </Form.Item>
          <Form.Item name="contractId" label="Hợp đồng (bắt buộc nếu xuất cho đối tác C)">
            <Select allowClear showSearch optionFilterProp="label"
              options={eligibleContracts(issueForm.getFieldValue('partnerId')).map(contract => ({
                value: contract.id,
                label: `${contract.contractNo} (${contract.contractType})`,
              }))}
              placeholder="Chọn hợp đồng đang hiệu lực nếu cần" />
          </Form.Item>
          <Form.Item name="serviceOrderIds" label="Đơn dịch vụ đã hoàn thành, chưa xuất hóa đơn" rules={[{ required: true, message: 'Chọn ít nhất một đơn dịch vụ' }]}>
            <Select mode="multiple" options={issueableOrders.map(order => ({
              value: order.id,
              label: `${order.plateNumber} · ${order.serviceName} · ${order.totalAmount.toLocaleString('vi-VN')} đ`,
            }))} />
          </Form.Item>
          <Form.Item name="dueDate" label="Hạn thanh toán" rules={[{ required: true, message: 'Chọn hạn thanh toán' }]}>
            <DatePicker className="w-full" disabledDate={date => !date.isAfter(new Date(), 'day')} />
          </Form.Item>
          <Form.Item name="taxRatePercent" label="Thuế (%)" initialValue={0}>
            <InputNumber min={0} max={100} className="w-full" />
          </Form.Item>
          <Button type="primary" htmlType="submit">Phát hành</Button>
        </Form>
      </Modal>
      <Modal open={!!invoiceDetail} title={invoiceDetail ? `Chi tiết hóa đơn ${invoiceDetail.invoiceNo}` : 'Chi tiết hóa đơn'}
        footer={null} width={850} onCancel={() => setInvoiceDetail(undefined)}>
        {invoiceDetail && <>
          <Alert className="mb-4" type="info" showIcon message={`${partnerName(invoiceDetail.partnerId)} · phát hành ${invoiceDetail.issueDate} · hạn ${invoiceDetail.dueDate}`} />
          <Table rowKey="serviceOrderId" pagination={false} dataSource={invoiceLines} columns={[
            { title: 'Biển số xe', dataIndex: 'plateNumber' },
            { title: 'Dịch vụ', dataIndex: 'serviceName', render: (name: string, row: InvoiceLine) => `${name} (${row.serviceCode})` },
            { title: 'Số lượng', dataIndex: 'quantity' },
            { title: 'Đơn giá', dataIndex: 'unitPrice', render: (value: number) => `${value.toLocaleString('vi-VN')} đ` },
            { title: 'Thành tiền', dataIndex: 'lineAmount', render: (value: number) => `${value.toLocaleString('vi-VN')} đ` },
          ]} />
          <div className="mt-4 text-right font-semibold">Tổng hóa đơn: {invoiceDetail.totalAmount.toLocaleString('vi-VN')} đ</div>
        </>}
      </Modal>
      <Modal open={interestOpen} title="Cấu hình lãi quá hạn" footer={null} onCancel={() => setInterestOpen(false)}>
        <Form form={interestForm} layout="vertical" initialValues={{ graceDays: 0, active: true }} onFinish={configureInterest}>
          <Form.Item name="partnerId" label="Partner" rules={[{ required: true, message: "Select a partner" }]}><Select showSearch optionFilterProp="label" options={partners.map((partner) => ({ value: partner.id, label: `${partner.code} - ${partner.name}` }))} placeholder="Select partner" /></Form.Item>
          <Form.Item name="ratePerDayPercent" label="Lãi (%/ngày)" rules={[{ required: true }]}><InputNumber min={0} precision={5} className="w-full" /></Form.Item>
          <Form.Item name="graceDays" label="Số ngày ân hạn" rules={[{ required: true }]}><InputNumber min={0} precision={0} className="w-full" /></Form.Item>
          <Form.Item name="active" label="Đang áp dụng" valuePropName="checked" initialValue><Select options={[{ value: true, label: 'Có' }, { value: false, label: 'Không' }]} /></Form.Item>
          <Button type="primary" htmlType="submit">Lưu cấu hình</Button>
        </Form>
      </Modal>
      <Modal open={interestHistoryOpen} title="Lịch sử ghi nhận lãi" footer={null} onCancel={() => setInterestHistoryOpen(false)}>
        <Alert className="mb-3" type="info" showIcon message="Lãi chỉ phát sinh sau hạn thanh toán và thời gian ân hạn, khi đối tác đã có cấu hình lãi suất đang áp dụng." />
        {user?.roles.includes('ADMIN') && <Button className="mb-3" onClick={() => void accrueInterestNow()}>Tính lãi đến hôm nay</Button>}
        {interestHistory.length === 0 ? <Empty description="Chưa có khoản lãi nào được ghi nhận" /> : <Table rowKey="id" dataSource={interestHistory} pagination={false} columns={[
          { title: 'Ngày', dataIndex: 'accrualDate' },
          { title: 'Dư gốc', dataIndex: 'outstandingPrincipal', render: (value: number) => value.toLocaleString('vi-VN') },
          { title: 'Lãi %/ngày', dataIndex: 'ratePerDayPercent' },
          { title: 'Tiền lãi', dataIndex: 'amount', render: (value: number) => value.toLocaleString('vi-VN') },
        ]} />}
      </Modal>
      <Modal open={!!paymentInvoice} title="Ghi nhận chuyển khoản" footer={null} onCancel={() => setPaymentInvoice(undefined)}>
        <Form form={paymentForm} layout="vertical" onFinish={recordPayment}>
          {paymentInvoice && <Alert className="mb-4" type="info" showIcon message={`Thanh toán toàn bộ dư nợ: ${outstandingForInvoice(paymentInvoice).toLocaleString('vi-VN')} (gốc và lãi đã phát sinh).`} />}
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
