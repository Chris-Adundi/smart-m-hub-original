import { useEffect, useState } from "react";
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

  const user = authService.getUser();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await apiClient.get("/portal/my-data");
      setData(res?.data || {});
    } catch (err) {
      console.error(err);
      toast.error("Failed to load student portal data");
      setData({});
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- SAFE DATA ---------------- */
  const student = data?.student ?? null;
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
                  <TableBody>
                    {payments.map((p, i) => (
                      <TableRow key={p?.id || i}>
                        <TableCell>{safeDate(p?.created_at)}</TableCell>
                        <TableCell>KES {safeNum(p?.amount)}</TableCell>
                        <TableCell>{p?.payment_method || "-"}</TableCell>
                        <TableCell>{p?.status || "-"}</TableCell>
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