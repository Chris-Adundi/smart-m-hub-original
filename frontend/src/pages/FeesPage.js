import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { apiClient } from "@/App";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import jsPDF from "jspdf";
import { uploadManagedFile } from "@/utils/uploads";

const FeesPage = () => {
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    phone_number: "",
    amount: "",
    payment_type: "fees",
    payment_method: "mpesa",
    bank_reference: "",
    cheque_number: "",
    student_id: "",
    receipt_url: "",
    term: "",
    received_from: "",
    transaction_reference: "",
    total_amount_due: "",
    outstanding_balance: "",
  });

  // ----------------------------
  // FIX: STABLE CALLBACK
  // ----------------------------

  const normalizePayments = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.payments)) return data.payments;
    return [];
  };

  const fetchPayments = useCallback(async () => {
    try {
      const response = await apiClient.get("/payments");
      const safe = normalizePayments(response?.data);

      setPayments(safe);
    } catch (error) {
      setPayments([]);
      toast.error("Failed to fetch payments");
    } finally {
      setLoading(false);
    }
  }, []);

  // ----------------------------
  // EFFECT FIX
  // ----------------------------

  useEffect(() => {
    fetchPayments();
    apiClient
      .get("/students?approval_status=approved")
      .then((response) => {
        const data = response?.data;
        setStudents(Array.isArray(data) ? data : data?.data || data?.students || []);
      })
      .catch(() => setStudents([]));
  }, [fetchPayments]);

  // ----------------------------
  // FORM HANDLER
  // ----------------------------

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await apiClient.post("/payments/initiate", {
        ...formData,
        amount: Number(formData.amount || 0),
        total_amount_due: formData.total_amount_due ? Number(formData.total_amount_due) : null,
        outstanding_balance: formData.outstanding_balance ? Number(formData.outstanding_balance) : null,
      });

      toast.success("Payment recorded successfully");

      setDialogOpen(false);

      setFormData({
        phone_number: "",
        amount: "",
        payment_type: "fees",
        payment_method: "mpesa",
        bank_reference: "",
        cheque_number: "",
        student_id: "",
        receipt_url: "",
        term: "",
        received_from: "",
        transaction_reference: "",
        total_amount_due: "",
        outstanding_balance: "",
      });

      fetchPayments();
    } catch (error) {
      toast.error(
        error?.response?.data?.detail || "Failed to record payment"
      );
    }
  };

  const handleReceiptUpload = async (file) => {
    if (!file) return;
    try {
      const url = await uploadManagedFile(file, "receipt");
      setFormData((prev) => ({ ...prev, receipt_url: url }));
      toast.success("Receipt uploaded");
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || "Receipt upload failed");
    }
  };

  // ----------------------------
  // SAFE DATA (MEMO FIX)
  // ----------------------------

  const safePayments = useMemo(() => {
    return Array.isArray(payments) ? payments : [];
  }, [payments]);

  const totalCollected = useMemo(() => {
    return safePayments
      .filter((p) => p?.status === "completed")
      .reduce((sum, p) => sum + Number(p?.amount || 0), 0);
  }, [safePayments]);

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

  const downloadReceipt = (payment) => {
    const student = students.find((s) => s.id === payment?.student_id) || {};
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("SMART M HUB - SCHOOL PAYMENT RECEIPT", 15, 18);
    doc.setFontSize(11);
    [
      `Receipt Number: ${payment?.receipt_number || "-"}`,
      `Receipt Date: ${payment?.created_at ? new Date(payment.created_at).toLocaleDateString() : "-"}`,
      `Student Name: ${student.full_name || payment?.student_name || "-"}`,
      `Admission Number: ${student.admission_number || payment?.admission_number || "-"}`,
      `Received From: ${student.guardian_name || payment?.received_from || "-"}`,
      `Payment Method: ${payment?.payment_method || "-"}`,
      `Reference: ${payment?.bank_reference || payment?.cheque_number || payment?.phone_number || "-"}`,
      `Item: ${payment?.payment_type || "Fees"}`,
      `Total Paid: KES ${Number(payment?.amount || 0).toLocaleString()}`,
      `Received By: ${payment?.submitted_by || "-"}`,
      `Approved By: ${payment?.approved_by || "-"}`,
    ].forEach((line, index) => doc.text(line, 15, 36 + index * 9));
    doc.save(`${payment?.receipt_number || "receipt"}.pdf`);
  };

  // ----------------------------
  // LOADING STATE
  // ----------------------------

  if (loading) {
    return (
      <div className="p-6 text-slate-400">
        Loading payments...
      </div>
    );
  }

  // ----------------------------
  // UI
  // ----------------------------

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">
            Fees & Payments
          </h2>
          <p className="text-slate-400 mt-1">
            Manage fee collection and track payments
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
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
                <Label>Student</Label>
                <Select
                  value={formData.student_id}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      student_id: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>

                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.full_name} - {student.admission_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Amount (KES)</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      amount: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Term</Label>
                  <Input value={formData.term} onChange={(e) => setFormData({ ...formData, term: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Received From</Label>
                  <Input value={formData.received_from} onChange={(e) => setFormData({ ...formData, received_from: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Transaction / Reference Number</Label>
                <Input value={formData.transaction_reference} onChange={(e) => setFormData({ ...formData, transaction_reference: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Total Amount Due</Label>
                  <Input type="number" value={formData.total_amount_due} onChange={(e) => setFormData({ ...formData, total_amount_due: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Outstanding Balance</Label>
                  <Input type="number" value={formData.outstanding_balance} onChange={(e) => setFormData({ ...formData, outstanding_balance: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>

                <Select
                  value={formData.payment_method}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      payment_method: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="bank_transfer">
                      Bank Transfer
                    </SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Payment Type</Label>

                <Select
                  value={formData.payment_type}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      payment_type: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="fees">School Fees</SelectItem>
                    <SelectItem value="exam_fee">Exam Fee</SelectItem>
                    <SelectItem value="transport">
                      Transport
                    </SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Receipt Attachment</Label>
                <Input type="file" accept="image/*,.pdf" onChange={(e) => handleReceiptUpload(e.target.files?.[0])} />
                {formData.receipt_url && <p className="text-xs text-emerald-400">Receipt uploaded</p>}
              </div>

              <Button type="submit" className="w-full">
                Record Payment
              </Button>

            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* TABLE */}
      <Card>
        <CardHeader>
          <CardTitle>
            Payments (Total: {totalCollected})
          </CardTitle>
        </CardHeader>

        <CardContent>
          {safePayments.length === 0 ? (
            <div className="text-slate-400 text-center py-10">
              No payments found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attachment</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {safePayments.map((p, i) => (
                  <TableRow key={p.id || i}>
                    <TableCell>{p.amount}</TableCell>
                    <TableCell>{p.receipt_number || "-"}</TableCell>
                    <TableCell>{p.payment_method}</TableCell>

                    <TableCell>
                      <Badge className={getStatusColor(p.status)}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.receipt_url ? (
                        <a className="text-emerald-400 underline" href={p.receipt_url} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => downloadReceipt(p)}>
                        Download Receipt
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

    </div>
  );
};

export default FeesPage;
