import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

import { Badge } from "@/components/ui/badge";

import { apiClient, authService } from "@/App";
import { toast } from "sonner";

import {
  Plus,
  BookOpen,
  Users,
  ClipboardList,
  Award,
  TrendingUp,
  Download,
  Eye,
  Search,
} from "lucide-react";

/* =========================
   SAFE ARRAY HELPER
========================= */
const asArray = (data) => (Array.isArray(data) ? data : []);
const apiList = (payload, key) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (key && Array.isArray(payload?.[key])) return payload[key];
  return [];
};

/* =========================
   ROLE NORMALIZER
========================= */
const normalizeRole = (role) => {
  if (!role) return "";

  const r = String(role).toLowerCase();

  const map = {
    admin: "school_admin",
    schooladmin: "school_admin",
    school_admin: "school_admin",
    superadmin: "super_admin",
    super_admin: "super_admin",
    teacher: "teacher",
    finance: "finance",
    secretary: "secretary",
    student: "student",
  };

  return map[r] || r;
};

/* =========================
   GRADE HELPERS
========================= */
const calculateCBEGrade = (marks) => {
  if (marks >= 80) return "EE1";
  if (marks >= 60) return "ME1";
  if (marks >= 40) return "AE1";
  return "BE1";
};

/* =========================
   COMPONENT
========================= */
const TeacherPortal = () => {
  const rawUser = authService.getUser();

  const user = useMemo(() => {
    if (!rawUser) return null;
    return { ...rawUser, role: normalizeRole(rawUser.role) };
  }, [rawUser]);

  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");

  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentResults, setStudentResults] = useState([]);
  const [studentHistory, setStudentHistory] = useState([]);

  const [resultForm, setResultForm] = useState({
    exam_id: "",
    student_id: "",
    subject: "",
    marks: "",
    teacher_comments: "",
  });

  const [attendanceForm, setAttendanceForm] = useState({
    student_id: "",
    date: new Date().toISOString().split("T")[0],
    status: "present",
    remarks: "",
  });

  /* =========================
     SAFE FETCH
  ========================= */
  const fetchTeacherData = useCallback(async () => {
    try {
      setLoading(true);

      const [studentsRes, examsRes, attendanceRes] = await Promise.all([
        apiClient.get("/students").catch(() => ({ data: [] })),
        apiClient.get("/exams").catch(() => ({ data: [] })),
        apiClient.get("/attendance").catch(() => ({ data: [] })),
      ]);

      setStudents(apiList(studentsRes?.data, "students"));
      setExams(apiList(examsRes?.data, "exams"));
      setAttendance(apiList(attendanceRes?.data, "attendance"));
    } catch (err) {
      toast.error("Failed to load teacher data");
      setStudents([]);
      setExams([]);
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeacherData();
  }, [fetchTeacherData]);

  /* =========================
     SAFE DERIVED DATA
  ========================= */
  const filteredStudents = useMemo(() => {
    const list = asArray(students);
    const search = searchTerm.toLowerCase();

    return list.filter((s) => {
      const name = String(s?.full_name || "").toLowerCase();
      const admission = String(s?.admission_number || "").toLowerCase();

      return name.includes(search) || admission.includes(search);
    });
  }, [students, searchTerm]);

  const todayAttendance = useMemo(() => {
    const list = asArray(attendance);
    const today = new Date().toISOString().split("T")[0];

    return list.filter((a) => String(a?.date || "").startsWith(today)).length;
  }, [attendance]);

  /* =========================
     SUBMIT RESULT
  ========================= */
  const handleSubmitResult = async (e) => {
    e.preventDefault();

    try {
      const marks = Number(resultForm.marks || 0);

      await apiClient.post("/results", {
        ...resultForm,
        marks,
        grade: calculateCBEGrade(marks),
      });

      toast.success("Result submitted");

      setResultForm({
        exam_id: "",
        student_id: "",
        subject: "",
        marks: "",
        teacher_comments: "",
      });

      setResultsDialogOpen(false);
      fetchTeacherData();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to submit result");
    }
  };

  const openResultDialog = (student = null) => {
    setResultForm((prev) => ({
      ...prev,
      student_id: student?.id || "",
    }));
    setResultsDialogOpen(true);
  };

  const openAttendanceDialog = (student = null) => {
    setAttendanceForm((prev) => ({
      ...prev,
      student_id: student?.id || "",
    }));
    setAttendanceDialogOpen(true);
  };

  const openStudentProfile = async (student) => {
    setSelectedStudent(student);
    setStudentResults([]);
    setStudentHistory([]);
    setProfileDialogOpen(true);

    try {
      const [resultsRes, historyRes] = await Promise.all([
        apiClient.get(`/results/${student.id}`).catch(() => ({ data: [] })),
        apiClient.get(`/students/${student.id}/history`).catch(() => ({ data: [] })),
      ]);
      setStudentResults(apiList(resultsRes?.data, "results"));
      setStudentHistory(apiList(historyRes?.data, "history"));
    } catch {
      setStudentResults([]);
      setStudentHistory([]);
    }
  };

  /* =========================
     ATTENDANCE
  ========================= */
  const handleMarkAttendance = async (e) => {
    e.preventDefault();

    try {
      await apiClient.post("/attendance", {
        entity_type: "student",
        entity_id: attendanceForm.student_id,
        date: attendanceForm.date,
        status: attendanceForm.status,
        remarks: attendanceForm.remarks,
      });

      toast.success("Attendance recorded");

      setAttendanceForm({
        student_id: "",
        date: new Date().toISOString().split("T")[0],
        status: "present",
        remarks: "",
      });

      fetchTeacherData();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed attendance");
    }
  };

  /* =========================
     LOADING SAFE GUARD
  ========================= */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-white">
        Loading teacher portal...
      </div>
    );
  }

  /* =========================
     UI MINIMUM SAFE RENDER
  ========================= */
  return (
    <div className="space-y-6">

      <div>
        <h2 className="text-3xl font-bold text-white">
          Teacher Portal
        </h2>

        <p className="text-slate-400">
          Welcome back {user?.full_name || "Teacher"}
        </p>
      </div>

      {/* SAFE STATS (NO CRASHES) */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            Students: {asArray(students).length}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            Exams: {asArray(exams).length}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            Today Attendance: {todayAttendance}
          </CardContent>
        </Card>
      </div>

      {/* SAFE SEARCH */}
      <div className="flex gap-3">
        <Input
          placeholder="Search students..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Button onClick={() => openAttendanceDialog()}>
          <ClipboardList className="w-4 h-4 mr-2" />
          Attendance
        </Button>
        <Button onClick={() => openResultDialog()}>
          <Award className="w-4 h-4 mr-2" />
          Result
        </Button>
      </div>

      {/* SAFE LIST */}
      <Card>
        <CardHeader>
          <CardTitle>Students</CardTitle>
        </CardHeader>

        <CardContent>
          {filteredStudents.length === 0 ? (
            <div className="text-slate-400">No students found</div>
          ) : (
            filteredStudents.map((s, i) => (
              <div
                key={s.id || i}
                className="flex items-center justify-between gap-3 p-3 border-b border-slate-700"
              >
                <div>
                  <p className="text-white font-medium">{s.full_name}</p>
                  <p className="text-slate-400 text-sm">{s.admission_number} | {s.class_name || "No class"}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openStudentProfile(s)}>
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openAttendanceDialog(s)}>Attendance</Button>
                  <Button size="sm" onClick={() => openResultDialog(s)}>Result</Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={resultsDialogOpen} onOpenChange={setResultsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Assessment Result</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitResult} className="space-y-4">
            <div className="space-y-2">
              <Label>Student</Label>
              <Select value={resultForm.student_id} onValueChange={(value) => setResultForm({ ...resultForm, student_id: value })}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {asArray(students).map((student) => (
                    <SelectItem key={student.id} value={student.id}>{student.full_name} - {student.admission_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Exam</Label>
              <Select value={resultForm.exam_id} onValueChange={(value) => setResultForm({ ...resultForm, exam_id: value })}>
                <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
                <SelectContent>
                  {asArray(exams).map((exam) => (
                    <SelectItem key={exam.id} value={exam.id}>{exam.name} - {exam.term}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="Subject" value={resultForm.subject} onChange={(e) => setResultForm({ ...resultForm, subject: e.target.value })} required />
            <Input type="number" placeholder="Marks" value={resultForm.marks} onChange={(e) => setResultForm({ ...resultForm, marks: e.target.value })} required />
            <Textarea placeholder="Teacher comments" value={resultForm.teacher_comments} onChange={(e) => setResultForm({ ...resultForm, teacher_comments: e.target.value })} />
            <Button type="submit" className="w-full">Submit Result</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={attendanceDialogOpen} onOpenChange={setAttendanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Attendance</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMarkAttendance} className="space-y-4">
            <Input type="date" value={attendanceForm.date} onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })} required />
            <Select value={attendanceForm.student_id} onValueChange={(value) => setAttendanceForm({ ...attendanceForm, student_id: value })}>
              <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
              <SelectContent>
                {asArray(students).map((student) => (
                  <SelectItem key={student.id} value={student.id}>{student.full_name} - {student.admission_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={attendanceForm.status} onValueChange={(value) => setAttendanceForm({ ...attendanceForm, status: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="excused">Excused</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Remarks" value={attendanceForm.remarks} onChange={(e) => setAttendanceForm({ ...attendanceForm, remarks: e.target.value })} />
            <Button type="submit" className="w-full">Save Attendance</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedStudent?.full_name || "Student Profile"}</DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <Tabs defaultValue="overview">
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="guardians">Guardians</TabsTrigger>
                <TabsTrigger value="medical">Medical</TabsTrigger>
                <TabsTrigger value="results">Results</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
              <TeacherProfileTab value="overview" data={pick(selectedStudent, ["admission_number", "class_name", "stream", "status", "approval_status"])} />
              <TeacherProfileTab value="guardians" data={pick(selectedStudent, ["guardian_name", "guardian_phone", "guardian_email", "secondary_guardian_name", "secondary_guardian_phone", "secondary_guardian_email"])} />
              <TeacherProfileTab value="medical" data={pick(selectedStudent, ["special_needs", "chronic_conditions", "allergies", "medication", "medical_info"])} />
              <TabsContent value="results">
                <div className="space-y-2 mt-4">
                  {studentResults.length === 0 ? <p className="text-slate-400">No results found</p> : studentResults.map((result) => (
                    <div key={result.id} className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-3">
                      <p className="text-white font-medium">{result.subject}: {result.marks} ({result.grade})</p>
                      <p className="text-slate-400 text-sm">{result.teacher_comments || "No comments"}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="history">
                <div className="space-y-2 mt-4">
                  {studentHistory.length === 0 ? <p className="text-slate-400">No history found</p> : studentHistory.map((item) => (
                    <div key={item.id || item.timestamp} className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-3">
                      <p className="text-white">{item.action || item.type || "History"}</p>
                      <p className="text-slate-400 text-sm">{item.timestamp || item.created_at || ""}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};

function pick(obj, keys) {
  return keys.reduce((acc, key) => ({ ...acc, [key]: obj?.[key] ?? "" }), {});
}

function TeacherProfileTab({ value, data }) {
  return (
    <TabsContent value={value}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        {Object.entries(data).map(([key, val]) => (
          <div key={key} className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-3">
            <p className="text-xs text-slate-400 capitalize">{key.replaceAll("_", " ")}</p>
            <p className="text-white break-words">{String(val || "-")}</p>
          </div>
        ))}
      </div>
    </TabsContent>
  );
}

export default TeacherPortal;
