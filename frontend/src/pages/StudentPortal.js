import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient, authService } from "@/App";
import { Bell, CreditCard, Calendar, Download, Award, TrendingUp, User, BookOpen, MessageSquare } from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "sonner";

const gradeColor = (g) => {
  if (g === "EE") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
  if (g === "ME") return "bg-blue-500/15 text-blue-400 border-blue-500/20";
  if (g === "AE") return "bg-yellow-500/15 text-yellow-400 border-yellow-500/20";
  return "bg-red-500/15 text-red-400 border-red-500/20";
};

const StudentPortal = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const user = authService.getUser();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await apiClient.get("/portal/my-data");
      setData(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const student = data?.student;
  const results = data?.results || [];
  const payments = data?.payments || [];
  const announcements = data?.announcements || [];
  const attStats = data?.attendance_stats || {};
  const attendance = data?.attendance || [];

  const generateFeeStatement = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Smart-M Hub - Fee Statement", 20, 20);
    doc.setFontSize(12);
    doc.text(`Student: ${student?.full_name || "N/A"}`, 20, 35);
    doc.text(`Admission: ${student?.admission_number || "N/A"}`, 20, 45);
    doc.text(`Class: ${student?.class_name || "N/A"}`, 20, 55);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 65);
    doc.text(`Total Fees: KES ${(data?.total_fees || 0).toLocaleString()}`, 20, 80);
    doc.text(`Total Paid: KES ${(data?.total_paid || 0).toLocaleString()}`, 20, 90);
    doc.text(`Balance: KES ${(data?.fee_balance || 0).toLocaleString()}`, 20, 100);
    let y = 120;
    doc.setFontSize(14);
    doc.text("Payment History", 20, y); y += 10;
    doc.setFontSize(10);
    payments.forEach((p, i) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(`${i+1}. KES ${p.amount} - ${p.payment_method} - ${new Date(p.created_at).toLocaleDateString()} [${p.status}]`, 20, y);
      y += 7;
    });
    doc.save(`fee-statement-${Date.now()}.pdf`);
    toast.success("Fee statement downloaded");
  };

  const generateReportCard = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Student Progress Report (CBE)", 20, 20);
    doc.setFontSize(12);
    doc.text(`Student: ${student?.full_name || "N/A"}`, 20, 35);
    doc.text(`Class: ${student?.class_name || "N/A"}`, 20, 45);
    let y = 65;
    doc.setFontSize(14);
    doc.text("Subject Results", 20, y); y += 10;
    doc.setFontSize(10);
    results.forEach((r, i) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(`${r.subject}: ${r.marks}/${r.max_marks} - ${r.grade} ${r.teacher_comments ? `(${r.teacher_comments})` : ""}`, 20, y);
      y += 7;
    });
    doc.save(`report-card-${Date.now()}.pdf`);
    toast.success("Report card downloaded");
  };

  if (loading) return <div className="flex items-center justify-center min-h-[400px] text-slate-400">Loading...</div>;

  return (
    <div className="space-y-6" data-testid="student-portal">
      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-purple-700/20 border border-blue-500/20 rounded-2xl p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-4xl font-bold text-white mb-2">Student & Parent Portal</h2>
            <p className="text-blue-300/70 text-lg mb-4">Welcome, {user?.full_name}</p>
            {student && (
              <div className="flex gap-3 flex-wrap">
                <Badge className="bg-white/10 text-white border-white/20 px-4 py-2">
                  <User className="w-4 h-4 mr-2" /> {student.full_name}
                </Badge>
                <Badge className="bg-white/10 text-white border-white/20 px-4 py-2">
                  <BookOpen className="w-4 h-4 mr-2" /> {student.class_name || student.year_of_study}
                </Badge>
                <Badge className="bg-white/10 text-white border-white/20 px-4 py-2">
                  {student.admission_number}
                </Badge>
              </div>
            )}
          </div>
          <div className="hidden md:block">
            <div className="w-24 h-24 bg-blue-500/15 rounded-full flex items-center justify-center border-2 border-blue-500/20">
              <User className="w-12 h-12 text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-[#1A2332] border border-green-500/20 rounded-xl p-5" data-testid="stat-fee-balance">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-400">Fee Balance</p>
            <CreditCard className="w-4 h-4 text-green-400" />
          </div>
          <p className="text-2xl font-bold text-white">KES {(data?.fee_balance || 0).toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">Paid: KES {(data?.total_paid || 0).toLocaleString()}</p>
        </div>
        <div className="bg-[#1A2332] border border-purple-500/20 rounded-xl p-5" data-testid="stat-attendance">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-400">Attendance Rate</p>
            <Calendar className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-white">{attStats.rate || 0}%</p>
          <p className="text-xs text-slate-500 mt-1">{attStats.present || 0} present / {attStats.total_days || 0} days</p>
        </div>
        <div className="bg-[#1A2332] border border-amber-500/20 rounded-xl p-5" data-testid="stat-results">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-400">Subjects Graded</p>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-white">{results.length}</p>
          <p className="text-xs text-slate-500 mt-1">CBE grading system</p>
        </div>
        <div className="bg-[#1A2332] border border-blue-500/20 rounded-xl p-5" data-testid="stat-announcements">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-400">Announcements</p>
            <Bell className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white">{announcements.length}</p>
          <p className="text-xs text-slate-500 mt-1">School notices</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="results" className="space-y-6">
        <TabsList className="bg-[#0F1A2A] border border-[#1E293B]">
          <TabsTrigger value="results" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Academic Results</TabsTrigger>
          <TabsTrigger value="fees" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Fee Payments</TabsTrigger>
          <TabsTrigger value="attendance" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Attendance</TabsTrigger>
          <TabsTrigger value="announcements" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Announcements</TabsTrigger>
        </TabsList>

        {/* Results */}
        <TabsContent value="results">
          <Card className="bg-[#1A2332] border-[#1E293B]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white">
                  <TrendingUp className="w-5 h-5 text-emerald-400" /> Academic Performance (CBE)
                </CardTitle>
                <Button onClick={generateReportCard} className="bg-emerald-600 hover:bg-emerald-500" data-testid="download-report-btn">
                  <Download className="w-4 h-4 mr-2" /> Report Card
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Award className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                  <p>No results published yet</p>
                </div>
              ) : (
                <div className="overflow-auto rounded-lg border border-[#1E293B]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#1E293B]">
                        <TableHead className="text-slate-400">Subject</TableHead>
                        <TableHead className="text-slate-400">Exam</TableHead>
                        <TableHead className="text-slate-400">Marks</TableHead>
                        <TableHead className="text-slate-400">Grade</TableHead>
                        <TableHead className="text-slate-400">Teacher Comments</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map(r => (
                        <TableRow key={r.id} className="border-[#1E293B]" data-testid="result-row">
                          <TableCell className="font-medium text-white">{r.subject}</TableCell>
                          <TableCell className="text-slate-400">{r.exam_name || "-"} {r.term ? `(${r.term})` : ""}</TableCell>
                          <TableCell className="text-white">{r.marks}/{r.max_marks}</TableCell>
                          <TableCell><Badge className={gradeColor(r.grade)}>{r.grade}</Badge></TableCell>
                          <TableCell className="text-slate-400">
                            {r.teacher_comments ? (
                              <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {r.teacher_comments}</span>
                            ) : "-"}
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

        {/* Fees */}
        <TabsContent value="fees">
          <Card className="bg-[#1A2332] border-[#1E293B]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white">
                  <CreditCard className="w-5 h-5 text-green-400" /> Fee Records
                </CardTitle>
                <Button onClick={generateFeeStatement} className="bg-green-600 hover:bg-green-500" data-testid="download-statement-btn">
                  <Download className="w-4 h-4 mr-2" /> Statement
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Fee summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-5 bg-green-500/10 rounded-xl border border-green-500/20">
                  <p className="text-sm text-slate-400 mb-1">Total Paid</p>
                  <p className="text-2xl font-bold text-green-400">KES {(data?.total_paid || 0).toLocaleString()}</p>
                </div>
                <div className="p-5 bg-amber-500/10 rounded-xl border border-amber-500/20">
                  <p className="text-sm text-slate-400 mb-1">Total Fees</p>
                  <p className="text-2xl font-bold text-amber-400">KES {(data?.total_fees || 0).toLocaleString()}</p>
                </div>
                <div className="p-5 bg-red-500/10 rounded-xl border border-red-500/20">
                  <p className="text-sm text-slate-400 mb-1">Balance Due</p>
                  <p className="text-2xl font-bold text-red-400">KES {(data?.fee_balance || 0).toLocaleString()}</p>
                </div>
              </div>
              {payments.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No payment records</div>
              ) : (
                <div className="overflow-auto rounded-lg border border-[#1E293B]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#1E293B]">
                        <TableHead className="text-slate-400">Date</TableHead>
                        <TableHead className="text-slate-400">Receipt</TableHead>
                        <TableHead className="text-slate-400">Amount</TableHead>
                        <TableHead className="text-slate-400">Method</TableHead>
                        <TableHead className="text-slate-400">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map(p => (
                        <TableRow key={p.id} className="border-[#1E293B]" data-testid="payment-row">
                          <TableCell className="text-slate-300">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="font-medium text-white">{p.receipt_number}</TableCell>
                          <TableCell className="font-bold text-green-400">KES {p.amount?.toLocaleString()}</TableCell>
                          <TableCell className="text-slate-400 capitalize">{p.payment_method?.replace("_", " ")}</TableCell>
                          <TableCell>
                            <Badge className={p.status === "completed" ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400"}>
                              {p.status}
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

        {/* Attendance */}
        <TabsContent value="attendance">
          <Card className="bg-[#1A2332] border-[#1E293B]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Calendar className="w-5 h-5 text-purple-400" /> Attendance Records
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20 text-center">
                  <p className="text-2xl font-bold text-green-400">{attStats.present || 0}</p>
                  <p className="text-xs text-slate-400 mt-1">Present</p>
                </div>
                <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20 text-center">
                  <p className="text-2xl font-bold text-red-400">{attStats.absent || 0}</p>
                  <p className="text-xs text-slate-400 mt-1">Absent</p>
                </div>
                <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20 text-center">
                  <p className="text-2xl font-bold text-amber-400">{attStats.late || 0}</p>
                  <p className="text-xs text-slate-400 mt-1">Late</p>
                </div>
                <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20 text-center">
                  <p className="text-2xl font-bold text-blue-400">{attStats.rate || 0}%</p>
                  <p className="text-xs text-slate-400 mt-1">Rate</p>
                </div>
              </div>
              {attendance.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No attendance records</div>
              ) : (
                <div className="overflow-auto rounded-lg border border-[#1E293B]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#1E293B]">
                        <TableHead className="text-slate-400">Date</TableHead>
                        <TableHead className="text-slate-400">Status</TableHead>
                        <TableHead className="text-slate-400">Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendance.slice(0, 30).map(a => (
                        <TableRow key={a.id} className="border-[#1E293B]">
                          <TableCell className="text-white">{a.date}</TableCell>
                          <TableCell>
                            <Badge className={a.status === "present" ? "bg-green-500/15 text-green-400" : a.status === "absent" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"}>
                              {a.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-400">{a.remarks || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Announcements */}
        <TabsContent value="announcements">
          <Card className="bg-[#1A2332] border-[#1E293B]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Bell className="w-5 h-5 text-blue-400" /> School Announcements
              </CardTitle>
            </CardHeader>
            <CardContent>
              {announcements.length === 0 ? (
                <div className="text-center py-12 text-slate-500">No announcements</div>
              ) : (
                <div className="space-y-3">
                  {announcements.map(a => (
                    <div key={a.id} className="p-4 bg-[#0F1A2A] border border-[#1E293B] rounded-lg" data-testid="announcement-item">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-white">{a.title}</h3>
                        <Badge className={a.priority === "urgent" ? "bg-red-500/15 text-red-400" : "bg-blue-500/15 text-blue-400"}>
                          {a.priority}
                        </Badge>
                      </div>
                      <p className="text-slate-400 text-sm whitespace-pre-wrap">{a.content}</p>
                      <p className="text-xs text-slate-600 mt-2">{new Date(a.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentPortal;
