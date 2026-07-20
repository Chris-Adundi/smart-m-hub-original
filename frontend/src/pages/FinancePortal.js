import { useEffect, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { apiClient, authService } from "@/App";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { uploadManagedFile } from "@/utils/uploads";
import { classLevelsForSchool } from "@/utils/schoolClasses";

// =========================
// SAFE NUMBER FORMATTER
// =========================
const money = (val) => {
  const num = Number(val ?? 0);
  return isNaN(num) ? 0 : num;
};

const FinancePortal = () => {
  const user = authService.getUser() || {};

  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [feeStructures, setFeeStructures] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [txnDialogOpen, setTxnDialogOpen] = useState(false);
  const [feeDialogOpen, setFeeDialogOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [feeProfile, setFeeProfile] = useState(null);
  const [schoolProfile, setSchoolProfile] = useState(() => authService.getUser()?.school_branding || {});

  const [txnForm, setTxnForm] = useState({
    transaction_type: "income",
    category: "",
    custom_category: "",
    amount: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
  });

  const [feeForm, setFeeForm] = useState({
    class_name: "",
    term: "",
    academic_year: new Date().getFullYear().toString(),
    amount: "",
    description: "",
    document_url: "",
  });

  const incomeCategories = [
    "Donations",
    "Government Grants",
    "Events",
    "Fundraising",
    "Other Income",
  ];

  const expenditureCategories = [
    "Salaries",
    "Utilities",
    "Supplies",
    "Maintenance",
    "Transport",
    "Food",
    "Equipment",
    "Other Expense",
  ];

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);

        const [paymentsRes, txnRes, summaryRes, feesRes, studentsRes, schoolRes] = await Promise.all([
          apiClient.get("/payments?approval_status=all").catch(() => ({ data: [] })),
          apiClient.get("/finance/transactions").catch(() => ({ data: [] })),
          apiClient.get("/finance/summary").catch(() => ({ data: {} })),
          apiClient.get("/finance/fee-structures").catch(() => ({ data: [] })),
          apiClient.get("/students?approval_status=approved").catch(() => ({ data: [] })),
          apiClient.get("/school/profile").catch(() => ({ data: null })),
        ]);

        if (!mounted) return;

        setPayments(
        Array.isArray(paymentsRes?.data)
          ? paymentsRes.data
          : paymentsRes?.data?.data ||
            paymentsRes?.data?.payments ||
            paymentsRes?.data?.results ||
            []
      );
        setTransactions(
        Array.isArray(txnRes?.data)
          ? txnRes.data
          : txnRes?.data?.data ||
            txnRes?.data?.transactions ||
            txnRes?.data?.results ||
            []
        );
        setSummary(summaryRes?.data || {});
        setFeeStructures(
          Array.isArray(feesRes?.data)
            ? feesRes.data
            : feesRes?.data?.data ||
              feesRes?.data?.fee_structures ||
              []
        );
        setStudents(
          Array.isArray(studentsRes?.data)
            ? studentsRes.data
            : studentsRes?.data?.data ||
              studentsRes?.data?.students ||
              []
        );
        setSchoolProfile(schoolRes?.data?.data || authService.getUser()?.school_branding || {});
      } catch (error) {
        toast.error("Failed to fetch finance data");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => (mounted = false);
  }, []);

  const handleAddTransaction = async (e) => {
    e.preventDefault();

    try {
      const { custom_category, ...cleanTxnForm } = txnForm;
      await apiClient.post("/finance/transactions", {
        ...cleanTxnForm,
        category: txnForm.category === "other" ? custom_category : txnForm.category,
        amount: Number(txnForm.amount || 0),
      });

      toast.success("Transaction recorded successfully");
      setTxnDialogOpen(false);

      setTxnForm({
        transaction_type: "income",
        category: "",
        custom_category: "",
        amount: "",
        description: "",
        date: new Date().toISOString().split("T")[0],
      });

      const res = await apiClient.get("/finance/transactions");
      setTransactions(
        Array.isArray(res?.data)
          ? res.data
          : res?.data?.data ||
            res?.data?.transactions ||
            []
      );
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to record transaction");
    }
  };

  const handleFeeDocumentUpload = async (file) => {
    if (!file) return;
    try {
      const url = await uploadManagedFile(file, "document");
      setFeeForm((prev) => ({ ...prev, document_url: url }));
      toast.success("Fee document uploaded");
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || "Document upload failed");
    }
  };

  const handleAddFeeStructure = async (e) => {
    e.preventDefault();

    try {
      await apiClient.post("/finance/fee-structures", {
        ...feeForm,
        amount: Number(feeForm.amount || 0),
      });

      toast.success("Fee structure saved");
      setFeeDialogOpen(false);

      setFeeForm({
        class_name: "",
        term: "",
        academic_year: new Date().getFullYear().toString(),
        amount: "",
        description: "",
        document_url: "",
      });

      const res = await apiClient.get("/finance/fee-structures");
      setFeeStructures(Array.isArray(res?.data) ? res.data : res?.data?.data || []);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to save fee structure");
    }
  };

  const updateFeeStatus = async (studentId, status) => {
    try {
      await apiClient.patch("/finance/fee-status", {
        student_id: studentId,
        status,
        note: "Set by finance portal",
      });
      toast.success("Fee status submitted for admin approval");
      setStudents((prev) =>
        prev.map((student) =>
          student.id === studentId
            ? { ...student, fee_status: status, fee_status_approval_status: "pending" }
            : student
        )
      );
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to update fee status");
    }
  };

  const openStudentProfile = async (student) => {
    setSelectedStudent(student);
    setProfileOpen(true);
    setFeeProfile(null);

    try {
      const res = await apiClient.get(`/students/${student.id}/fee-profile`);
      setFeeProfile(res?.data || null);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to load student fee profile");
    }
  };

  const feeStatusClass = (status) => {
    if (status === "cleared") return "text-emerald-300 bg-emerald-500/10";
    if (status === "warning") return "text-yellow-300 bg-yellow-500/10";
    if (status === "send_home") return "text-red-300 bg-red-500/10";
    return "text-slate-300 bg-slate-500/10";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 text-slate-400">
        Loading finance data...
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="finance-portal">

      {/* HEADER */}
      <div className="bg-[#1A2332] border border-[#1E293B] rounded-2xl p-8">
        <h2 className="text-3xl font-bold text-white">Finance Portal</h2>
        <p className="text-slate-400 mt-1">
          Welcome back, {user?.full_name || "User"}
        </p>
      </div>

      {/* ACTION */}
      <div className="flex justify-end gap-3">
        <Dialog open={feeDialogOpen} onOpenChange={setFeeDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Fee Structure
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Fee Structure</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleAddFeeStructure} className="space-y-4">
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={feeForm.class_name} onValueChange={(value) => setFeeForm({ ...feeForm, class_name: value })}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {classLevelsForSchool(schoolProfile).map((level) => (
                      <div key={level.label}>
                        <div className="px-2 py-1 text-xs font-semibold text-slate-500">{level.label}</div>
                        {level.classes.map((className) => (
                          <SelectItem key={className} value={className}>{className}</SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Term</Label>
                  <Input value={feeForm.term} onChange={(e) => setFeeForm({ ...feeForm, term: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Academic Year</Label>
                  <Input value={feeForm.academic_year} onChange={(e) => setFeeForm({ ...feeForm, academic_year: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Amount (KES)</Label>
                <Input type="number" value={feeForm.amount} onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })} required />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={feeForm.description} onChange={(e) => setFeeForm({ ...feeForm, description: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label>Fee Document</Label>
                <Input type="file" accept="image/*,.pdf" onChange={(e) => handleFeeDocumentUpload(e.target.files?.[0])} />
                {feeForm.document_url && <p className="text-xs text-emerald-400">Document uploaded</p>}
              </div>

              <Button type="submit" className="w-full">
                Save Fee Structure
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog open={txnDialogOpen} onOpenChange={setTxnDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Transaction
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Transaction</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleAddTransaction} className="space-y-4">

              {/* TYPE */}
              <div className="space-y-2">
                <Label htmlFor="transaction_type">Transaction Type</Label>

                <Select
                  value={txnForm.transaction_type}
                  onValueChange={(v) =>
                    setTxnForm({
                      ...txnForm,
                      transaction_type: v,
                      category: "",
                      custom_category: "",
                    })
                  }
                >
                  <SelectTrigger id="transaction_type" name="transaction_type">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expenditure">Expenditure</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* CATEGORY */}
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>

                <Select
                  value={txnForm.category}
                  onValueChange={(v) => setTxnForm({ ...txnForm, category: v, custom_category: "" })}
                >
                  <SelectTrigger id="category" name="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>

                  <SelectContent>
                    {(txnForm.transaction_type === "income"
                      ? incomeCategories
                      : expenditureCategories
                    ).map((c) => (
                      <SelectItem key={c} value={c.toLowerCase().startsWith("other") ? "other" : c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {txnForm.category === "other" && (
                  <Input
                    placeholder="Type category"
                    value={txnForm.custom_category || ""}
                    onChange={(e) => setTxnForm({ ...txnForm, custom_category: e.target.value })}
                    required
                  />
                )}
              </div>

              {/* AMOUNT */}
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (KES)</Label>

                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  value={txnForm.amount}
                  onChange={(e) =>
                    setTxnForm({ ...txnForm, amount: e.target.value })
                  }
                />
              </div>

              {/* DESCRIPTION */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>

                <Textarea
                  id="description"
                  name="description"
                  value={txnForm.description}
                  onChange={(e) =>
                    setTxnForm({ ...txnForm, description: e.target.value })
                  }
                />
              </div>

              {/* DATE */}
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>

                <Input
                  id="date"
                  name="date"
                  type="date"
                  value={txnForm.date}
                  onChange={(e) =>
                    setTxnForm({ ...txnForm, date: e.target.value })
                  }
                />
              </div>

              <Button type="submit" className="w-full">
                Save Transaction
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card><CardContent>Total Income: KES {money(summary?.total_income).toLocaleString()}</CardContent></Card>
        <Card><CardContent>Total Expenditure: KES {money(summary?.total_expenditure).toLocaleString()}</CardContent></Card>
        <Card><CardContent>Balance: KES {money(summary?.running_balance).toLocaleString()}</CardContent></Card>
        <Card><CardContent>Student Fees: KES {money(summary?.total_fee_income).toLocaleString()}</CardContent></Card>
      </div>

      {/* TABLES */}
      <Tabs defaultValue="transactions">

        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="fee_structures">Fee Structures</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {transactions.map((t, i) => (
                <TableRow key={t?.id || i}>
                  <TableCell>{t?.date ? new Date(t.date).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>{t?.transaction_type}</TableCell>
                  <TableCell>{t?.category}</TableCell>
                  <TableCell>{money(t?.amount).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="students">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Admission</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Fee Status</TableHead>
                <TableHead>Set Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id} className="cursor-pointer" onClick={() => openStudentProfile(student)}>
                  <TableCell>{student.full_name}</TableCell>
                  <TableCell>{student.admission_number}</TableCell>
                  <TableCell>{student.class_name || "N/A"}</TableCell>
                  <TableCell>{student.education_level || "N/A"}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${feeStatusClass(student.fee_status)}`}>
                      {student.fee_status || "not set"}
                      {student.fee_status_approval_status === "pending" ? " - pending approval" : ""}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); updateFeeStatus(student.id, "cleared"); }}>
                        Cleared
                      </Button>
                      <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); updateFeeStatus(student.id, "warning"); }}>
                        Warning
                      </Button>
                      <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); updateFeeStatus(student.id, "send_home"); }}>
                        Send Home
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="payments">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attachment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p, i) => (
                <TableRow key={p?.id || i}>
                  <TableCell>{p?.receipt_number || "—"}</TableCell>
                  <TableCell>KES {money(p?.amount).toLocaleString()}</TableCell>
                  <TableCell>{p?.status || "pending"}</TableCell>
                  <TableCell>
                    {p?.receipt_url ? (
                      <a className="text-emerald-400 underline" href={p.receipt_url} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : "N/A"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="fee_structures">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Document</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feeStructures.map((fee, i) => (
                <TableRow key={fee?.id || i}>
                  <TableCell>{fee?.class_name}</TableCell>
                  <TableCell>{fee?.term || "N/A"}</TableCell>
                  <TableCell>{fee?.academic_year || "N/A"}</TableCell>
                  <TableCell>KES {money(fee?.amount).toLocaleString()}</TableCell>
                  <TableCell>
                    {fee?.document_url ? (
                      <a className="text-emerald-400 underline" href={fee.document_url} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : "N/A"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

      </Tabs>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedStudent?.full_name || "Student Fee Profile"}</DialogTitle>
          </DialogHeader>

          {selectedStudent && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-4 gap-3">
                <Card><CardContent>Admission: {selectedStudent.admission_number || "N/A"}</CardContent></Card>
                <Card><CardContent>Class: {selectedStudent.class_name || "N/A"}</CardContent></Card>
                <Card><CardContent>Paid: KES {money(feeProfile?.summary?.total_paid).toLocaleString()}</CardContent></Card>
                <Card><CardContent>Balance: KES {money(feeProfile?.summary?.balance).toLocaleString()}</CardContent></Card>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(feeProfile?.payments || []).length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8">No payment history found</TableCell></TableRow>
                  ) : (
                    feeProfile.payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{payment.year || "N/A"}</TableCell>
                        <TableCell>{payment.term || "N/A"}</TableCell>
                        <TableCell>{payment.receipt_number || "N/A"}</TableCell>
                        <TableCell>KES {money(payment.amount).toLocaleString()}</TableCell>
                        <TableCell>KES {money(payment.outstanding_balance).toLocaleString()}</TableCell>
                        <TableCell>{payment.approval_status || payment.status || "pending"}</TableCell>
                        <TableCell>{payment.visible_to_student ? "Available" : "Waiting approval"}</TableCell>
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

export default FinancePortal;
