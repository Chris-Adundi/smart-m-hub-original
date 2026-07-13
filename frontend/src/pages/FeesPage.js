import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiClient, authService, formatApiError } from "@/App";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";

const money = (value) => Number(value || 0).toLocaleString();
const thisYear = new Date().getFullYear().toString();

const initialPayment = {
  student_id: "",
  amount: "",
  payment_type: "fees",
  payment_method: "mpesa",
  term: "",
  academic_year: thisYear,
  received_from: "",
  transaction_reference: "",
  phone_number: "",
  bank_reference: "",
  cheque_number: "",
  total_amount_due: "",
  outstanding_balance: "",
};

const FeesPage = () => {
  const user = authService.getUser() || {};
  const isAdmin = user.role === "school_admin" || user.role === "super_admin";
  const [students, setStudents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [feeProfile, setFeeProfile] = useState(null);
  const [paymentForm, setPaymentForm] = useState(initialPayment);

  const normalize = (payload, key) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.[key])) return payload[key];
    return [];
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [studentsRes, paymentsRes] = await Promise.all([
        apiClient.get("/students?approval_status=approved"),
        apiClient.get("/payments?approval_status=all"),
      ]);
      setStudents(normalize(studentsRes?.data, "students"));
      setPayments(normalize(paymentsRes?.data, "payments"));
    } catch (error) {
      toast.error(formatApiError(error, "Failed to load student fees"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredStudents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return students;
    return students.filter((student) =>
      [student.full_name, student.admission_number, student.class_name, student.education_level]
        .some((value) => String(value || "").toLowerCase().includes(needle))
    );
  }, [students, query]);

  const paymentSummaryByStudent = useMemo(() => {
    const map = {};
    payments.forEach((payment) => {
      const id = payment.student_id;
      if (!id) return;
      if (!map[id]) map[id] = { paid: 0, pending: 0, count: 0 };
      map[id].count += 1;
      if (payment.approval_status === "approved") {
        map[id].paid += Number(payment.amount || 0);
      }
      if (payment.approval_status === "pending") {
        map[id].pending += 1;
      }
    });
    return map;
  }, [payments]);

  const openStudent = async (student) => {
    setSelectedStudent(student);
    setProfileOpen(true);
    setFeeProfile(null);
    try {
      const response = await apiClient.get(`/students/${student.id}/fee-profile`);
      setFeeProfile(response?.data || null);
    } catch (error) {
      toast.error(formatApiError(error, "Failed to load fee profile"));
    }
  };

  const startPayment = (student = null) => {
    setPaymentForm({
      ...initialPayment,
      student_id: student?.id || "",
      received_from: student?.guardian_name || "",
    });
    setPaymentOpen(true);
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    try {
      await apiClient.post("/payments/initiate", {
        ...paymentForm,
        amount: Number(paymentForm.amount || 0),
        total_amount_due: paymentForm.total_amount_due ? Number(paymentForm.total_amount_due) : null,
        outstanding_balance: paymentForm.outstanding_balance ? Number(paymentForm.outstanding_balance) : null,
      });
      toast.success(isAdmin ? "Payment recorded and receipt published" : "Payment recorded and sent to school admin for approval");
      setPaymentOpen(false);
      await fetchData();
      if (selectedStudent) await openStudent(selectedStudent);
    } catch (error) {
      toast.error(formatApiError(error, "Failed to record payment"));
    }
  };

  const approveReceipt = async (payment) => {
    try {
      await apiClient.patch(`/admin/approve/payment/${payment.id}`, { action: "approved" });
      toast.success("Receipt approved and published to student portal");
      await fetchData();
      if (selectedStudent) await openStudent(selectedStudent);
    } catch (error) {
      toast.error(formatApiError(error, "Failed to approve receipt"));
    }
  };

  const rejectReceipt = async (payment) => {
    try {
      await apiClient.patch(`/admin/approve/payment/${payment.id}`, { action: "rejected" });
      toast.success("Receipt rejected");
      await fetchData();
      if (selectedStudent) await openStudent(selectedStudent);
    } catch (error) {
      toast.error(formatApiError(error, "Failed to reject receipt"));
    }
  };

  const profilePayments = Array.isArray(feeProfile?.payments) ? feeProfile.payments : [];
  const summary = feeProfile?.summary || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">Student Fees</h2>
          <p className="text-slate-400 mt-1">All students, balances, receipts and approval-ready payment records</p>
        </div>

        <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => startPayment()}>
              <Plus className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Student Payment</DialogTitle>
            </DialogHeader>
            <form onSubmit={submitPayment} className="space-y-4">
              <div className="space-y-2">
                <Label>Student</Label>
                <Select value={paymentForm.student_id} onValueChange={(value) => setPaymentForm({ ...paymentForm, student_id: value })}>
                  <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.full_name} - {student.admission_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Amount Paid</Label>
                  <Input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Received From</Label>
                  <Input value={paymentForm.received_from} onChange={(e) => setPaymentForm({ ...paymentForm, received_from: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Academic Year</Label>
                  <Input value={paymentForm.academic_year} onChange={(e) => setPaymentForm({ ...paymentForm, academic_year: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Term</Label>
                  <Input value={paymentForm.term} onChange={(e) => setPaymentForm({ ...paymentForm, term: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Total Amount Due</Label>
                  <Input type="number" value={paymentForm.total_amount_due} onChange={(e) => setPaymentForm({ ...paymentForm, total_amount_due: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Outstanding Balance</Label>
                  <Input type="number" value={paymentForm.outstanding_balance} onChange={(e) => setPaymentForm({ ...paymentForm, outstanding_balance: e.target.value })} />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={paymentForm.payment_method} onValueChange={(value) => setPaymentForm({ ...paymentForm, payment_method: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mpesa">M-Pesa</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Payment Item</Label>
                  <Select value={paymentForm.payment_type} onValueChange={(value) => setPaymentForm({ ...paymentForm, payment_type: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fees">School Fees</SelectItem>
                      <SelectItem value="exam_fee">Exam Fee</SelectItem>
                      <SelectItem value="transport">Transport</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Transaction / Reference Number</Label>
                <Input value={paymentForm.transaction_reference} onChange={(e) => setPaymentForm({ ...paymentForm, transaction_reference: e.target.value })} />
              </div>

              <Button type="submit" className="w-full">Save Payment</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Search className="w-4 h-4 text-slate-400" />
            <Input placeholder="Search student, admission number, class or level" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Admission</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Approved Paid</TableHead>
                <TableHead>Pending Receipts</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : filteredStudents.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">No students found</TableCell></TableRow>
              ) : (
                filteredStudents.map((student) => {
                  const summaryRow = paymentSummaryByStudent[student.id] || {};
                  return (
                    <TableRow key={student.id} className="cursor-pointer" onClick={() => openStudent(student)}>
                      <TableCell>{student.full_name}</TableCell>
                      <TableCell>{student.admission_number}</TableCell>
                      <TableCell>{student.class_name || "-"}</TableCell>
                      <TableCell>{student.education_level || "-"}</TableCell>
                      <TableCell>KES {money(summaryRow.paid)}</TableCell>
                      <TableCell>{summaryRow.pending || 0}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); startPayment(student); }}>
                          Record
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedStudent?.full_name || "Student Fee Profile"}</DialogTitle>
          </DialogHeader>

          {selectedStudent && (
            <div className="space-y-5">
              <div className="grid md:grid-cols-4 gap-3">
                <Card><CardContent>Class: {selectedStudent.class_name || "-"}</CardContent></Card>
                <Card><CardContent>Level: {selectedStudent.education_level || "-"}</CardContent></Card>
                <Card><CardContent>Paid: KES {money(summary.total_paid)}</CardContent></Card>
                <Card><CardContent>Balance: KES {money(summary.balance)}</CardContent></Card>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => startPayment(selectedStudent)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Record Payment
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Year</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Student Portal</TableHead>
                    {isAdmin && <TableHead>Review</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profilePayments.length === 0 ? (
                    <TableRow><TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8">No payments found</TableCell></TableRow>
                  ) : (
                    profilePayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{payment.year || "-"}</TableCell>
                        <TableCell>{payment.term || "-"}</TableCell>
                        <TableCell>{payment.receipt_number || "-"}</TableCell>
                        <TableCell>KES {money(payment.amount)}</TableCell>
                        <TableCell>KES {money(payment.outstanding_balance)}</TableCell>
                        <TableCell><Badge>{payment.approval_status || payment.status}</Badge></TableCell>
                        <TableCell>{payment.visible_to_student ? "Available" : "Waiting approval"}</TableCell>
                        {isAdmin && (
                          <TableCell>
                            {payment.approval_status === "pending" ? (
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => approveReceipt(payment)}>Approve</Button>
                                <Button size="sm" variant="destructive" onClick={() => rejectReceipt(payment)}>Reject</Button>
                              </div>
                            ) : "-"}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FeesPage;
