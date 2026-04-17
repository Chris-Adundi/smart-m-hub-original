import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient, authService } from "@/App";
import { toast } from "sonner";
import {
  Plus, TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight,
  Wallet, Receipt, PieChart
} from "lucide-react";

const FinancePortal = () => {
  const [payments, setPayments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [txnDialogOpen, setTxnDialogOpen] = useState(false);
  const user = authService.getUser();

  const [txnForm, setTxnForm] = useState({
    transaction_type: "income", category: "", amount: "", description: "", date: ""
  });

  const incomeCategories = ["Donations", "Government Grants", "Events", "Fundraising", "Other Income"];
  const expenditureCategories = ["Salaries", "Utilities", "Supplies", "Maintenance", "Transport", "Food", "Equipment", "Other Expense"];

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [paymentsRes, txnRes, summaryRes] = await Promise.all([
        apiClient.get("/payments?approval_status=all"),
        apiClient.get("/finance/transactions"),
        apiClient.get("/finance/summary"),
      ]);
      setPayments(paymentsRes.data);
      setTransactions(txnRes.data);
      setSummary(summaryRes.data);
    } catch (error) {
      toast.error("Failed to fetch finance data");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post("/finance/transactions", txnForm);
      toast.success("Transaction recorded");
      setTxnDialogOpen(false);
      setTxnForm({ transaction_type: "income", category: "", amount: "", description: "", date: "" });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to record transaction");
    }
  };

  const totalCollected = payments.filter(p => p.status === "completed").reduce((s, p) => s + p.amount, 0);
  const pendingPayments = payments.filter(p => p.approval_status === "pending").length;

  if (loading) return <div className="text-center py-12 text-slate-400">Loading...</div>;

  return (
    <div className="space-y-6" data-testid="finance-portal">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold text-white">Finance Portal</h2>
          <p className="text-slate-400 mt-1">Income, expenditure & fee tracking</p>
        </div>
        <Dialog open={txnDialogOpen} onOpenChange={setTxnDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-500" data-testid="add-transaction-btn">
              <Plus className="w-4 h-4 mr-2" /> Add Transaction
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Transaction</DialogTitle></DialogHeader>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select value={txnForm.transaction_type} onValueChange={(v) => setTxnForm({...txnForm, transaction_type: v, category: ""})}>
                  <SelectTrigger data-testid="txn-type-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expenditure">Expenditure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={txnForm.category} onValueChange={(v) => setTxnForm({...txnForm, category: v})}>
                  <SelectTrigger data-testid="txn-category-select"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {(txnForm.transaction_type === "income" ? incomeCategories : expenditureCategories).map(c =>
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount (KES) *</Label>
                <Input data-testid="txn-amount-input" type="number" min="0" value={txnForm.amount}
                  onChange={(e) => setTxnForm({...txnForm, amount: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea data-testid="txn-description-input" value={txnForm.description} rows={2}
                  onChange={(e) => setTxnForm({...txnForm, description: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={txnForm.date}
                  onChange={(e) => setTxnForm({...txnForm, date: e.target.value})} />
              </div>
              <Button type="submit" data-testid="submit-txn-btn" className="w-full bg-emerald-600 hover:bg-emerald-500">
                {txnForm.transaction_type === "income" ? "Record Income" : "Record Expenditure"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-[#1A2332] border border-emerald-500/20 rounded-xl p-5" data-testid="summary-total-income">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">Total Income</p>
            <div className="bg-emerald-500/15 p-2 rounded-lg"><ArrowUpRight className="w-4 h-4 text-emerald-400" /></div>
          </div>
          <p className="text-2xl font-bold text-emerald-400">KES {(summary?.total_income || 0).toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">Fees + Other income</p>
        </div>
        <div className="bg-[#1A2332] border border-red-500/20 rounded-xl p-5" data-testid="summary-total-expenditure">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">Total Expenditure</p>
            <div className="bg-red-500/15 p-2 rounded-lg"><ArrowDownRight className="w-4 h-4 text-red-400" /></div>
          </div>
          <p className="text-2xl font-bold text-red-400">KES {(summary?.total_expenditure || 0).toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">{summary?.transaction_count || 0} transactions</p>
        </div>
        <div className="bg-[#1A2332] border border-blue-500/20 rounded-xl p-5" data-testid="summary-balance">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">Running Balance</p>
            <div className="bg-blue-500/15 p-2 rounded-lg"><Wallet className="w-4 h-4 text-blue-400" /></div>
          </div>
          <p className="text-2xl font-bold text-blue-400">KES {(summary?.running_balance || 0).toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">Income - Expenditure</p>
        </div>
        <div className="bg-[#1A2332] border border-amber-500/20 rounded-xl p-5" data-testid="summary-fee-income">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">Fee Collections</p>
            <div className="bg-amber-500/15 p-2 rounded-lg"><Receipt className="w-4 h-4 text-amber-400" /></div>
          </div>
          <p className="text-2xl font-bold text-amber-400">KES {(summary?.total_fee_income || 0).toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">{summary?.payment_count || 0} payments</p>
        </div>
      </div>

      <Tabs defaultValue="transactions" className="space-y-5">
        <TabsList className="bg-[#0F1A2A] border border-[#1E293B]">
          <TabsTrigger value="transactions" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Income & Expenditure</TabsTrigger>
          <TabsTrigger value="payments" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Fee Payments ({payments.length})</TabsTrigger>
        </TabsList>

        {/* Transactions */}
        <TabsContent value="transactions">
          <Card className="bg-[#1A2332] border-[#1E293B]">
            <CardHeader>
              <CardTitle className="text-white">Transaction Ledger</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <PieChart className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                  <p>No transactions recorded yet</p>
                  <p className="text-sm mt-1">Add income or expenditure to start tracking</p>
                </div>
              ) : (
                <div className="overflow-auto rounded-lg border border-[#1E293B]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#1E293B]">
                        <TableHead className="text-slate-400">Date</TableHead>
                        <TableHead className="text-slate-400">Type</TableHead>
                        <TableHead className="text-slate-400">Category</TableHead>
                        <TableHead className="text-slate-400">Description</TableHead>
                        <TableHead className="text-slate-400">Amount</TableHead>
                        <TableHead className="text-slate-400">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map(t => (
                        <TableRow key={t.id} className="border-[#1E293B]" data-testid="transaction-row">
                          <TableCell className="text-slate-300">{new Date(t.date || t.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {t.transaction_type === "income"
                              ? <Badge className="bg-emerald-500/15 text-emerald-400"><TrendingUp className="w-3 h-3 mr-1" />Income</Badge>
                              : <Badge className="bg-red-500/15 text-red-400"><TrendingDown className="w-3 h-3 mr-1" />Expense</Badge>
                            }
                          </TableCell>
                          <TableCell className="text-white">{t.category}</TableCell>
                          <TableCell className="text-slate-400">{t.description}</TableCell>
                          <TableCell className={`font-bold ${t.transaction_type === "income" ? "text-emerald-400" : "text-red-400"}`}>
                            {t.transaction_type === "income" ? "+" : "-"} KES {t.amount?.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge className={t.approval_status === "approved" ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400"}>
                              {t.approval_status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments */}
        <TabsContent value="payments">
          <Card className="bg-[#1A2332] border-[#1E293B]">
            <CardHeader>
              <CardTitle className="text-white">Fee Payment Records</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No payments recorded</div>
              ) : (
                <div className="overflow-auto rounded-lg border border-[#1E293B]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#1E293B]">
                        <TableHead className="text-slate-400">Receipt</TableHead>
                        <TableHead className="text-slate-400">Amount</TableHead>
                        <TableHead className="text-slate-400">Method</TableHead>
                        <TableHead className="text-slate-400">Type</TableHead>
                        <TableHead className="text-slate-400">Status</TableHead>
                        <TableHead className="text-slate-400">Approval</TableHead>
                        <TableHead className="text-slate-400">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map(p => (
                        <TableRow key={p.id} className="border-[#1E293B]" data-testid="payment-row">
                          <TableCell className="font-medium text-white">{p.receipt_number}</TableCell>
                          <TableCell className="font-bold text-emerald-400">KES {p.amount?.toLocaleString()}</TableCell>
                          <TableCell className="text-slate-400 capitalize">{p.payment_method?.replace("_", " ")}</TableCell>
                          <TableCell className="text-slate-400 capitalize">{p.payment_type}</TableCell>
                          <TableCell>
                            <Badge className={p.status === "completed" ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400"}>
                              {p.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={p.approval_status === "approved" ? "bg-green-500/15 text-green-400" : p.approval_status === "rejected" ? "bg-red-500/15 text-red-400" : "bg-yellow-500/15 text-yellow-400"}>
                              {p.approval_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-400">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinancePortal;
