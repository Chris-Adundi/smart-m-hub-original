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
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [txnDialogOpen, setTxnDialogOpen] = useState(false);

  const [txnForm, setTxnForm] = useState({
    transaction_type: "income",
    category: "",
    amount: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
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

        const [paymentsRes, txnRes, summaryRes] = await Promise.all([
          apiClient.get("/payments?approval_status=all").catch(() => ({ data: [] })),
          apiClient.get("/finance/transactions").catch(() => ({ data: [] })),
          apiClient.get("/finance/summary").catch(() => ({ data: {} })),
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
      await apiClient.post("/finance/transactions", {
        ...txnForm,
        amount: Number(txnForm.amount || 0),
      });

      toast.success("Transaction recorded successfully");
      setTxnDialogOpen(false);

      setTxnForm({
        transaction_type: "income",
        category: "",
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
      <div className="flex justify-end">
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
                  onValueChange={(v) => setTxnForm({ ...txnForm, category: v })}
                >
                  <SelectTrigger id="category" name="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>

                  <SelectContent>
                    {(txnForm.transaction_type === "income"
                      ? incomeCategories
                      : expenditureCategories
                    ).map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
        <Card><CardContent>Fees: KES {money(summary?.total_fee_income).toLocaleString()}</CardContent></Card>
      </div>

      {/* TABLES */}
      <Tabs defaultValue="transactions">

        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
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

        <TabsContent value="payments">
          <Table>
            <TableBody>
              {payments.map((p, i) => (
                <TableRow key={p?.id || i}>
                  <TableCell>{p?.receipt_number || "—"}</TableCell>
                  <TableCell>KES {money(p?.amount).toLocaleString()}</TableCell>
                  <TableCell>{p?.status || "pending"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

      </Tabs>

    </div>
  );
};

export default FinancePortal;
