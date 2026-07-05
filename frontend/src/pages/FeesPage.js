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
    cheque_number: "",
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
      });

      fetchPayments();
    } catch (error) {
      toast.error(
        error?.response?.data?.detail || "Failed to record payment"
      );
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
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {safePayments.map((p, i) => (
                  <TableRow key={p.id || i}>
                    <TableCell>{p.amount}</TableCell>
                    <TableCell>{p.payment_method}</TableCell>

                    <TableCell>
                      <Badge className={getStatusColor(p.status)}>
                        {p.status}
                      </Badge>
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
