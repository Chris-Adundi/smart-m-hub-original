import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient, authService } from "@/App";
import { toast } from "sonner";
import { Plus, BookOpen, Users, ClipboardList, Award, TrendingUp, Download, Eye } from "lucide-react";
import jsPDF from "jspdf";

const CBE_GRADES = [
  { value: "EE", label: "EE - Exceeding Expectations", min: 80 },
  { value: "ME", label: "ME - Meeting Expectations", min: 60 },
  { value: "AE", label: "AE - Approaching Expectations", min: 40 },
  { value: "BE", label: "BE - Below Expectations", min: 0 },
];

const calculateCBEGrade = (marks) => {
  if (marks >= 80) return "EE";
  if (marks >= 60) return "ME";
  if (marks >= 40) return "AE";
  return "BE";
};

const gradeColor = (grade) => {
  if (grade === "EE") return "bg-green-100 text-green-800";
  if (grade === "ME") return "bg-blue-100 text-blue-800";
  if (grade === "AE") return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
};

const TeacherPortal = () => {
  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [selectedClass, setSelectedClass] = useState("all");
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentResults, setStudentResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = authService.getUser();

  const [resultForm, setResultForm] = useState({
    exam_id: "", student_id: "", subject: "", marks: "", grade: "", teacher_comments: ""
  });

  const [attendanceForm, setAttendanceForm] = useState({
    student_id: "", date: new Date().toISOString().split('T')[0], status: "present", remarks: ""
  });

  useEffect(() => { fetchTeacherData(); }, []);

  const fetchTeacherData = async () => {
    try {
      const [studentsRes, examsRes, attendanceRes] = await Promise.all([
        apiClient.get("/students"),
        apiClient.get("/exams"),
        apiClient.get("/attendance?approval_status=all"),
      ]);
      setStudents(studentsRes.data);
      setExams(examsRes.data);
      setAttendance(attendanceRes.data);
    } catch (error) {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const myClasses = [...new Set(students.map(s => s.class_name || s.year_of_study).filter(Boolean))];

  const handleSubmitResult = async (e) => {
    e.preventDefault();
    try {
      const res = await apiClient.post("/results", resultForm);
      toast.success(res.data.approval_status === "pending"
        ? "Result submitted for admin approval"
        : "Result recorded");
      setResultsDialogOpen(false);
      setResultForm({ exam_id: "", student_id: "", subject: "", marks: "", grade: "", teacher_comments: "" });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to record result");
    }
  };

  const handleMarkAttendance = async (e) => {
    e.preventDefault();
    try {
      const res = await apiClient.post("/attendance", {
        entity_type: "student", entity_id: attendanceForm.student_id,
        date: attendanceForm.date, status: attendanceForm.status, remarks: attendanceForm.remarks
      });
      toast.success(res.data.approval_status === "pending"
        ? "Attendance submitted for admin approval"
        : "Attendance marked");
      setAttendanceDialogOpen(false);
      fetchTeacherData();
    } catch (error) {
      toast.error("Failed to mark attendance");
    }
  };

  const viewStudentProgress = async (student) => {
    setSelectedStudent(student);
    try {
      const res = await apiClient.get(`/results/${student.id}`);
      setStudentResults(res.data);
    } catch (error) {
      setStudentResults([]);
    }
    setProgressDialogOpen(true);
  };

  const generateClassReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Class Performance Report (CBE)", 20, 20);
    doc.setFontSize(12);
    doc.text(`Teacher: ${user?.full_name}`, 20, 35);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 45);
    doc.text(`Grading: EE | ME | AE | BE`, 20, 55);
    doc.save(`class-report-${Date.now()}.pdf`);
    toast.success("Report downloaded");
  };

  const filteredStudents = selectedClass && selectedClass !== "all"
    ? students.filter(s => (s.class_name || s.year_of_study) === selectedClass)
    : students;

  const todayAttendance = attendance.filter(a =>
    a.date === new Date().toISOString().split('T')[0]
  ).length;

  return (
    <div className="space-y-6" data-testid="teacher-portal">
      <div className="bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border border-emerald-500/20 rounded-2xl p-8">
        <h2 className="text-4xl font-bold text-white">Teacher Portal</h2>
        <p className="text-emerald-300/70 mt-2 text-lg">Welcome back, {user?.full_name}</p>
        <p className="text-emerald-400/50 text-sm mt-1">CBE Grading: EE (Exceeding) | ME (Meeting) | AE (Approaching) | BE (Below)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-emerald-500 bg-[#1A2332] border-[#1E293B]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-400">My Classes</CardTitle>
              <BookOpen className="w-5 h-5 text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent><div className="text-3xl font-bold text-white">{myClasses.length}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500 bg-[#1A2332] border-[#1E293B]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-400">Total Students</CardTitle>
              <Users className="w-5 h-5 text-blue-400" />
            </div>
          </CardHeader>
          <CardContent><div className="text-3xl font-bold text-white">{students.length}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500 bg-[#1A2332] border-[#1E293B]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-400">Today's Attendance</CardTitle>
              <ClipboardList className="w-5 h-5 text-purple-400" />
            </div>
          </CardHeader>
          <CardContent><div className="text-3xl font-bold text-white">{todayAttendance}</div></CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500 bg-[#1A2332] border-[#1E293B]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-400">Active Exams</CardTitle>
              <Award className="w-5 h-5 text-orange-400" />
            </div>
          </CardHeader>
          <CardContent><div className="text-3xl font-bold text-white">{exams.length}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="students" className="space-y-6">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="students">My Students</TabsTrigger>
          <TabsTrigger value="results">Record Results</TabsTrigger>
          <TabsTrigger value="attendance">Mark Attendance</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* Students Tab */}
        <TabsContent value="students">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle>Class Students</CardTitle>
                <div className="flex gap-3">
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="All Classes" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {myClasses.map(cls => <SelectItem key={cls} value={cls}>{cls}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button onClick={generateClassReport} variant="outline">
                    <Download className="w-4 h-4 mr-2" /> Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-12 text-slate-500">No students found</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredStudents.map(student => (
                    <div key={student.id} className="p-5 border-2 border-slate-200 rounded-xl hover:border-emerald-400 hover:shadow-md transition-all bg-gradient-to-br from-white to-slate-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-slate-900">{student.full_name}</h3>
                          <p className="text-sm text-slate-500 mt-1">{student.admission_number}</p>
                          <Badge className="mt-2 bg-emerald-100 text-emerald-700 border-emerald-300">
                            {student.class_name || student.year_of_study}
                          </Badge>
                        </div>
                        <TrendingUp className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-200 flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1" data-testid="view-progress-btn"
                          onClick={() => viewStudentProgress(student)}>
                          <Eye className="w-4 h-4 mr-1" /> View Progress
                        </Button>
                        <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700">Contact Parent</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results Tab - CBE */}
        <TabsContent value="results">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Record Exam Results (CBE)</CardTitle>
                  <p className="text-sm text-slate-500 mt-1">Use CBE grading: EE, ME, AE, BE</p>
                </div>
                <Dialog open={resultsDialogOpen} onOpenChange={setResultsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700" data-testid="add-result-btn">
                      <Plus className="w-4 h-4 mr-2" /> Add Result
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Record Student Result (CBE)</DialogTitle></DialogHeader>
                    <form onSubmit={handleSubmitResult} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Exam *</Label>
                        <Select value={resultForm.exam_id} onValueChange={(v) => setResultForm({...resultForm, exam_id: v})}>
                          <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
                          <SelectContent>
                            {exams.map(e => <SelectItem key={e.id} value={e.id}>{e.name} - {e.class_name || e.year_of_study}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Student *</Label>
                        <Select value={resultForm.student_id} onValueChange={(v) => setResultForm({...resultForm, student_id: v})}>
                          <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                          <SelectContent>
                            {students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name} - {s.admission_number}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Subject *</Label>
                        <Input value={resultForm.subject}
                          onChange={(e) => setResultForm({...resultForm, subject: e.target.value})} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Marks (out of 100) *</Label>
                        <Input type="number" min="0" max="100" value={resultForm.marks}
                          onChange={(e) => {
                            const m = e.target.value;
                            setResultForm({...resultForm, marks: m, grade: m ? calculateCBEGrade(parseFloat(m)) : ""});
                          }} required />
                      </div>
                      <div className="space-y-2">
                        <Label>CBE Grade</Label>
                        <div className="flex items-center gap-2">
                          <Input value={resultForm.grade} readOnly className="bg-slate-100 flex-1" />
                          {resultForm.grade && (
                            <Badge className={gradeColor(resultForm.grade)}>{resultForm.grade}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">EE (80+) | ME (60-79) | AE (40-59) | BE (0-39)</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Teacher Comments</Label>
                        <Textarea value={resultForm.teacher_comments} rows={2}
                          onChange={(e) => setResultForm({...resultForm, teacher_comments: e.target.value})}
                          placeholder="Comments on student performance..." />
                      </div>
                      <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">
                        Submit for Approval
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                <h3 className="font-semibold text-lg text-blue-800 mb-2">CBE Grading System</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {CBE_GRADES.map(g => (
                    <div key={g.value} className="text-center p-3 bg-white rounded-lg shadow-sm">
                      <Badge className={`${gradeColor(g.value)} text-lg px-3 py-1`}>{g.value}</Badge>
                      <p className="text-xs text-slate-600 mt-2">{g.label.split(' - ')[1]}</p>
                      <p className="text-xs text-slate-400">{g.min}%+</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Mark Student Attendance</CardTitle>
                <Dialog open={attendanceDialogOpen} onOpenChange={setAttendanceDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-purple-600 hover:bg-purple-700" data-testid="mark-attendance-btn">
                      <Plus className="w-4 h-4 mr-2" /> Mark Attendance
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Mark Student Attendance</DialogTitle></DialogHeader>
                    <form onSubmit={handleMarkAttendance} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Date *</Label>
                        <Input type="date" value={attendanceForm.date}
                          onChange={(e) => setAttendanceForm({...attendanceForm, date: e.target.value})} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Student *</Label>
                        <Select value={attendanceForm.student_id}
                          onValueChange={(v) => setAttendanceForm({...attendanceForm, student_id: v})}>
                          <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                          <SelectContent>
                            {students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name} - {s.admission_number}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Status *</Label>
                        <Select value={attendanceForm.status}
                          onValueChange={(v) => setAttendanceForm({...attendanceForm, status: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="present">Present</SelectItem>
                            <SelectItem value="absent">Absent</SelectItem>
                            <SelectItem value="late">Late</SelectItem>
                            <SelectItem value="excused">Excused</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Remarks</Label>
                        <Input value={attendanceForm.remarks}
                          onChange={(e) => setAttendanceForm({...attendanceForm, remarks: e.target.value})} placeholder="Optional" />
                      </div>
                      <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">Submit for Approval</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {attendance.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <ClipboardList className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                  <p className="text-lg font-medium">No attendance records yet</p>
                </div>
              ) : (
                <div className="overflow-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Remarks</TableHead>
                        <TableHead>Approval</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendance.slice(0, 20).map(a => (
                        <TableRow key={a.id}>
                          <TableCell>{a.date}</TableCell>
                          <TableCell>
                            <Badge className={a.status === "present" ? "bg-green-100 text-green-800" : a.status === "absent" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}>
                              {a.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{a.remarks || "-"}</TableCell>
                          <TableCell>
                            <Badge className={a.approval_status === "approved" ? "bg-green-100 text-green-800" : a.approval_status === "rejected" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}>
                              {a.approval_status}
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

        {/* Performance Tab */}
        <TabsContent value="performance">
          <Card>
            <CardHeader><CardTitle>Class Performance Analytics (CBE)</CardTitle></CardHeader>
            <CardContent>
              <div className="text-center py-12 text-slate-500">
                <TrendingUp className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                <p className="text-lg font-medium">Performance analytics coming soon</p>
                <p className="text-sm mt-2">Track class progress using CBE grading (EE, ME, AE, BE)</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Student Progress Dialog */}
      <Dialog open={progressDialogOpen} onOpenChange={setProgressDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Student Progress - {selectedStudent?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedStudent && (
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm"><span className="font-medium">Admission:</span> {selectedStudent.admission_number}</p>
                <p className="text-sm"><span className="font-medium">Class:</span> {selectedStudent.class_name || selectedStudent.year_of_study}</p>
              </div>
            )}
            {studentResults.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Award className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                <p>No results recorded yet</p>
              </div>
            ) : (
              <div className="overflow-auto rounded-lg border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Subject</TableHead>
                      <TableHead>Marks</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Comments</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentResults.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.subject}</TableCell>
                        <TableCell>{r.marks}/{r.max_marks}</TableCell>
                        <TableCell><Badge className={gradeColor(r.grade)}>{r.grade}</Badge></TableCell>
                        <TableCell>{r.teacher_comments || "-"}</TableCell>
                        <TableCell>
                          <Badge className={r.approval_status === "approved" ? "bg-green-100 text-green-800" : r.approval_status === "rejected" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}>
                            {r.approval_status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherPortal;
