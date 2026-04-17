import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/App";
import { toast } from "sonner";
import { Plus, Download, FileText } from "lucide-react";
import jsPDF from "jspdf";

const FeesPage = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    phone_number: "",
    amount: "",
    payment_type: "fees",
    payment_method: "mpesa",
    bank_reference: "",
    cheque_number: ""
  });

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await apiClient.get("/payments");
      setPayments(response.data);
    } catch (error) {
      toast.error("Failed to fetch payments");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post("/payments/initiate", formData);
      toast.success("Payment recorded successfully");
      setDialogOpen(false);
      setTimeout(() => fetchPayments(), 1000);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to record payment");
    }
  };

  const generateReceipt = (payment) => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text("Smart Hub", 20, 20);
    doc.setFontSize(16);
    doc.text("Payment Receipt", 20, 35);
    
    doc.setFontSize(12);
    doc.text(`Receipt No: ${payment.receipt_number}`, 20, 50);
    doc.text(`Date: ${new Date(payment.created_at).toLocaleDateString()}`, 20, 60);
    doc.text(`Amount: KES ${payment.amount}`, 20, 70);
    doc.text(`Payment Method: ${payment.payment_method.toUpperCase()}`, 20, 80);
    doc.text(`Payment Type: ${payment.payment_type}`, 20, 90);
    doc.text(`Status: ${payment.status.toUpperCase()}`, 20, 100);
    
    if (payment.mpesa_receipt) {
      doc.text(`M-Pesa Receipt: ${payment.mpesa_receipt}`, 20, 110);
    }
    if (payment.bank_reference) {
      doc.text(`Bank Reference: ${payment.bank_reference}`, 20, 110);
    }
    if (payment.cheque_number) {
      doc.text(`Cheque Number: ${payment.cheque_number}`, 20, 110);
    }
    
    doc.setFontSize(10);
    doc.text("Thank you for your payment!", 20, 130);
    
    doc.save(`receipt-${payment.receipt_number}.pdf`);
    toast.success("Receipt downloaded");
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const totalCollected = payments
    .filter(p => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Fees & Payments</h2>
          <p className="text-slate-400 mt-1">Manage fee collection and track payments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="initiate-payment-btn">
              <Plus className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Amount (KES) *</Label>
                <Input
                  data-testid="payment-amount-input"
                  type="number"
                  placeholder="5000"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Method *</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                >
                  <SelectTrigger data-testid="payment-method-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {formData.payment_method === "mpesa" && (
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input
                    data-testid="payment-phone-input"
                    placeholder="254712345678"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  />
                </div>
              )}
              
              {formData.payment_method === "bank_transfer" && (
                <div className="space-y-2">
                  <Label>Bank Reference Number</Label>
                  <Input
                    placeholder="Enter bank reference"
                    value={formData.bank_reference}
                    onChange={(e) => setFormData({ ...formData, bank_reference: e.target.value })}
                  />
                </div>
              )}
              
              {formData.payment_method === "cheque" && (
                <div className="space-y-2">
                  <Label>Cheque Number</Label>
                  <Input
                    placeholder="Enter cheque number"
                    value={formData.cheque_number}
                    onChange={(e) => setFormData({ ...formData, cheque_number: e.target.value })}
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Payment Type *</Label>
                <Select
                  value={formData.payment_type}
                  onValueChange={(value) => setFormData({ ...formData, payment_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fees">School Fees</SelectItem>
                    <SelectItem value="installation">Installation Fee</SelectItem>
                    <SelectItem value="monthly_subscription">Monthly Subscription</SelectItem>
                    <SelectItem value="exam_fee">Exam Fee</SelectItem>
                    <SelectItem value="transport">Transport Fee</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button data-testid="submit-payment-btn" type="submit" className="w-full">
                Record Payment
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Total Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">KES {totalCollected.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {payments.filter(p => p.status === "pending").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">M-Pesa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {payments.filter(p => p.payment_method === "mpesa").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {payments.filter(p => {
                const paymentDate = new Date(p.created_at);
                const now = new Date();
                return paymentDate.getMonth() === now.getMonth() && 
                       paymentDate.getFullYear() === now.getFullYear();
              }).length}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-lg border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead>Receipt No.</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      No payments found
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((payment) => (
                    <TableRow key={payment.id} data-testid="payment-row">
                      <TableCell className="font-medium">{payment.receipt_number}</TableCell>
                      <TableCell className="font-semibold">KES {payment.amount}</TableCell>
                      <TableCell className="capitalize">{payment.payment_method?.replace('_', ' ')}</TableCell>
                      <TableCell className="capitalize">{payment.payment_type}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(payment.status)}>
                          {payment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(payment.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => generateReceipt(payment)}
                          data-testid="download-receipt-btn"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FeesPage;
