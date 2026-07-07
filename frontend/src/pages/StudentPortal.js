import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import jsPDF from "jspdf";

import {
  User,
  BookOpen,
  CreditCard,
  Download,
  TrendingUp,
  Printer,
} from "lucide-react";

/* ---------------- SAFE HELPERS ---------------- */
const safeNum = (v) => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

const safeDate = (d) => {
  try {
    return d ? new Date(d).toLocaleDateString() : "-";
  } catch {
    return "-";
  }
};

/* ---------------- GRADING ---------------- */
const gradeColor = (g) => {
  if (g === "EE")
    return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (g === "ME")
    return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  if (g === "AE")
    return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";

  return "bg-red-500/10 text-red-400 border-red-500/20";
};

const StudentPortal = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState("");

  const user = authService.getUser();

  const fetchData = useCallback(async () => {
    try {
      const params = selectedStudentId
        ? { selected_student_id: selectedStudentId }
        : {};
      const res = await apiClient.get("/portal/my-data", { params });
      setData(res?.data || {});
    } catch (err) {
      console.error(err);
      toast.error("Failed to load student portal data");
      setData({});
    } finally {
      setLoading(false);
    }
  }, [selectedStudentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---------------- SAFE DATA ---------------- */
  const student = data?.student ?? null;
  const children = Array.isArray(data?.children) ? data.children : [];
  const results = Array.isArray(data?.results) ? data.results : [];
  const payments = Array.isArray(data?.payments) ? data.payments : [];
  const announcements = Array.isArray(data?.announcements)
    ? data.announcements
    : [];
  const attendance = Array.isArray(data?.attendance)
    ? data.attendance
    : [];

  const feeBalance = safeNum(data?.fee_balance);

  /* ---------------- PDF FEES ---------------- */
  const generateFeeStatement = () => {
    if (!student) return toast.error("No student data");

    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Fee Statement", 20, 20);

    doc.setFontSize(12);
    doc.text(`Name: ${student.full_name || "-"}`, 20, 35);
    doc.text(`Class: ${student.class_name || "-"}`, 20, 45);
    doc.text(`Balance: KES ${feeBalance}`, 20, 60);

    let y = 80;

    payments.forEach((p, i) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      doc.text(
        `${i + 1}. KES ${safeNum(p?.amount)} - ${
          p?.payment_method || "-"
        } - ${safeDate(p?.created_at)}`,
        20,
        y
      );

      y += 8;
    });

    doc.save("fee-statement.pdf");
    toast.success("Downloaded fee statement");
  };

  const receiptHtml = (payment) => `
    <html>
      <head>
        <title>${payment?.receipt_number || "Receipt"}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
          .header { display: flex; align-items: center; gap: 16px; border-bottom: 1px solid #d1d5db; padding-bottom: 16px; }
          img { width: 72px; height: 72px; object-fit: contain; }
          h1 { margin: 0; font-size: 22px; }
          table { width: 100%; border-collapse: collapse; margin-top: 18px; }
          td, th { border: 1px solid #d1d5db; padding: 10px; text-align: left; }
          .footer { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
          .line { border-bottom: 1px solid #111827; height: 32px; }
        </style>
      </head>
      <body>
        <div class="header">
          ${payment?.school_logo ? `<img src="${payment.school_logo}" />` : ""}
          <div>
            <h1>SMART M HUB - SCHOOL PAYMENT RECEIPT</h1>
            <p>${payment?.school_name || ""} | ${payment?.school_code || ""}</p>
          </div>
        </div>
        <table>
          <tbody>
            <tr><th>Receipt Number</th><td>${payment?.receipt_number || "-"}</td></tr>
            <tr><th>Receipt Date</th><td>${safeDate(payment?.created_at)}</td></tr>
            <tr><th>Student Name</th><td>${payment?.student_name || student?.full_name || "-"}</td></tr>
            <tr><th>Admission Number</th><td>${payment?.admission_number || student?.admission_number || "-"}</td></tr>
            <tr><th>Received From</th><td>${payment?.received_from || student?.guardian_name || "-"}</td></tr>
            <tr><th>Payment Method</th><td>${payment?.payment_method || "-"}</td></tr>
            <tr><th>Reference</th><td>${payment?.bank_reference || payment?.cheque_number || payment?.phone_number || "-"}</td></tr>
            <tr><th>Item</th><td>${payment?.payment_type || "Fees"}</td></tr>
            <tr><th>Total Paid</th><td>KES ${safeNum(payment?.amount).toLocaleString()}</td></tr>
            <tr><th>Outstanding Balance</th><td>KES ${feeBalance.toLocaleString()}</td></tr>
          </tbody>
        </table>
        <div class="footer">
          <div><p>Received By</p><div class="line"></div></div>
          <div><p>Approved By</p><div class="line"></div></div>
        </div>
      </body>
    </html>`;

  const printReceipt = (payment) => {
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) return toast.error("Popup blocked");
    popup.document.write(receiptHtml(payment));
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const downloadReceipt = (payment) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("SMART M HUB - SCHOOL PAYMENT RECEIPT", 15, 18);
    doc.setFontSize(11);
    const lines = [
      `School: ${payment?.school_name || "-"}`,
      `School Code: ${payment?.school_code || "-"}`,
      `Receipt Number: ${payment?.receipt_number || "-"}`,
      `Receipt Date: ${safeDate(payment?.created_at)}`,
      `Student: ${payment?.student_name || student?.full_name || "-"}`,
      `Admission Number: ${payment?.admission_number || student?.admission_number || "-"}`,
      `Received From: ${payment?.received_from || student?.guardian_name || "-"}`,
      `Payment Method: ${payment?.payment_method || "-"}`,
      `Reference: ${payment?.bank_reference || payment?.cheque_number || payment?.phone_number || "-"}`,
      `Item: ${payment?.payment_type || "Fees"}`,
      `Total Paid: KES ${safeNum(payment?.amount).toLocaleString()}`,
      `Outstanding Balance: KES ${feeBalance.toLocaleString()}`,
    ];
    lines.forEach((line, index) => doc.text(line, 15, 34 + index * 9));
    doc.save(`${payment?.receipt_number || "receipt"}.pdf`);
  };

  /* ---------------- PDF RESULTS ---------------- */
  const generateReportCard = () => {
    if (!student) return toast.error("No student data");

    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Report Card", 20, 20);

    doc.setFontSize(12);
    doc.text(`Name: ${student.full_name || "-"}`, 20, 35);
    doc.text(`Class: ${student.class_name || "-"}`, 20, 45);

    let y = 65;

    results.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      doc.text(
        `${r?.subject || "-"}: ${safeNum(r?.marks)}/${safeNum(
          r?.max_marks
        )} - ${r?.grade || "-"}`,
        20,
        y
      );

      y += 8;
    });

    doc.save("report-card.pdf");
    toast.success("Downloaded report card");
  };

  /* ---------------- LOADING ---------------- */
  if (loading) {
    return (
      <div className="p-6 text-slate-400">
        Loading student portal...
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="bg-[#1A2332] border border-[#1E293B] p-6 rounded-xl">
        <h1 className="text-2xl font-bold text-white">
          Student Portal
        </h1>

        <p className="text-slate-400 mt-1">
          Welcome {user?.full_name || "Student"}
        </p>

        {student && (
          <div className="flex gap-2 mt-4 flex-wrap">
            <Badge>
              <User className="w-3 h-3 mr-1" />
              {student.full_name}
            </Badge>

            <Badge>
              <BookOpen className="w-3 h-3 mr-1" />
              {student.class_name}
            </Badge>

            <Badge>{student.admission_number}</Badge>
          </div>
        )}

        {children.length > 1 && (
          <div className="mt-4">
            <p className="text-xs text-slate-400 mb-2">Child</p>
            <select
              className="bg-[#0F172A] border border-[#1E293B] text-white rounded-lg px-3 py-2"
              value={selectedStudentId || student?.id || ""}
              onChange={(e) => setSelectedStudentId(e.target.value)}
            >
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.full_name} - {child.admission_number}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <Card className="bg-[#1A2332] border-[#1E293B]">
          <CardContent className="p-4">
            <p className="text-slate-400 text-sm">Fee Balance</p>
            <p className="text-white text-xl font-bold">
              KES {feeBalance}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#1A2332] border-[#1E293B]">
          <CardContent className="p-4">
            <p className="text-slate-400 text-sm">Results</p>
            <p className="text-white text-xl font-bold">
              {results.length}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#1A2332] border-[#1E293B]">
          <CardContent className="p-4">
            <p className="text-slate-400 text-sm">Announcements</p>
            <p className="text-white text-xl font-bold">
              {announcements.length}
            </p>
          </CardContent>
        </Card>

      </div>

      {/* TABS */}
      <Tabs defaultValue="results">

        <TabsList className="bg-[#0F1A2A] border border-[#1E293B]">
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
        </TabsList>

        {/* RESULTS */}
        <TabsContent value="results">
          <Card className="bg-[#1A2332] border-[#1E293B]">
            <CardHeader>
              <CardTitle className="text-white flex gap-2 items-center">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Results
              </CardTitle>

              <Button onClick={generateReportCard} className="mt-3">
                <Download className="w-4 h-4 mr-2" />
                Download Report
              </Button>
            </CardHeader>

            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Grade</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={r?.id || i}>
                      <TableCell>{r?.subject || "-"}</TableCell>
                      <TableCell>
                        {safeNum(r?.marks)}/{safeNum(r?.max_marks)}
                      </TableCell>
                      <TableCell>
                        <Badge className={gradeColor(r?.grade)}>
                          {r?.grade || "-"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>

              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FEES */}
        <TabsContent value="fees">
          <Card className="bg-[#1A2332] border-[#1E293B]">
            <CardHeader>
              <CardTitle className="text-white flex gap-2 items-center">
                <CreditCard className="w-4 h-4 text-green-400" />
                Fees
              </CardTitle>

              <Button onClick={generateFeeStatement}>
                <Download className="w-4 h-4 mr-2" />
                Statement
              </Button>
            </CardHeader>

            <CardContent>
              {payments.length === 0 ? (
                <p className="text-slate-400">No payments found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Receipt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p, i) => (
                      <TableRow key={p?.id || i}>
                        <TableCell>{safeDate(p?.created_at)}</TableCell>
                        <TableCell>KES {safeNum(p?.amount)}</TableCell>
                        <TableCell>{p?.payment_method || "-"}</TableCell>
                        <TableCell>{p?.status || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => downloadReceipt(p)}>
                              <Download className="w-3 h-3 mr-1" />
                              PDF
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => printReceipt(p)}>
                              <Printer className="w-3 h-3 mr-1" />
                              Print
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>

          </Card>
        </TabsContent>

        {/* ATTENDANCE */}
        <TabsContent value="attendance">
          <Card className="bg-[#1A2332] border-[#1E293B] p-6 text-slate-400">
            {attendance.length === 0
              ? "No attendance data available"
              : "Attendance loaded"}
          </Card>
        </TabsContent>

        {/* ANNOUNCEMENTS */}
        <TabsContent value="announcements">
          <Card className="bg-[#1A2332] border-[#1E293B] p-6">
            {announcements.length === 0 ? (
              <p className="text-slate-400">No announcements</p>
            ) : (
              announcements.map((a, i) => (
                <div
                  key={a?.id || i}
                  className="mb-3 border-b border-[#1E293B] pb-2"
                >
                  <p className="text-white font-medium">{a?.title}</p>
                  <p className="text-slate-400 text-sm">
                    {a?.content}
                  </p>
                </div>
              ))
            )}
          </Card>
        </TabsContent>

      </Tabs>

    </div>
  );
};

export default StudentPortal;
