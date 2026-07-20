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
import { uploadManagedFile } from "@/utils/uploads";
import jsPDF from "jspdf";
import { CBC_GRADE_OPTIONS, gradeToMarks, learningAreasForClass } from "@/utils/schoolClasses";

import {
  BookOpen,
  Users,
  ClipboardList,
  Award,
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
    custom_subject: "",
    grade: "",
    teacher_comments: "",
    report_url: "",
    result_type: "assessment",
  });
  const [assessmentDrafts, setAssessmentDrafts] = useState([]);
  const [subjectIndex, setSubjectIndex] = useState(0);

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

  const selectedAssessmentStudent = useMemo(
    () => asArray(students).find((student) => student.id === resultForm.student_id) || null,
    [students, resultForm.student_id]
  );

  const subjectOptions = useMemo(
    () => learningAreasForClass(selectedAssessmentStudent?.class_name),
    [selectedAssessmentStudent?.class_name]
  );

  const mergeCurrentDraft = () => {
    const subject = String(
      resultForm.subject === "other" ? resultForm.custom_subject : resultForm.subject || subjectOptions[subjectIndex] || ""
    ).trim();
    if (!resultForm.exam_id || !resultForm.student_id || !subject || !resultForm.grade) {
      toast.error("Select student, exam, subject and CBC grade");
      return null;
    }

    const current = {
      exam_id: resultForm.exam_id,
      student_id: resultForm.student_id,
      subject,
      grade: resultForm.grade,
      teacher_comments: resultForm.teacher_comments,
      report_url: resultForm.report_url,
      result_type: "assessment",
    };

    const nextDrafts = [
      ...assessmentDrafts.filter((draft) => draft.subject !== subject),
      current,
    ];
    setAssessmentDrafts(nextDrafts);
    return nextDrafts;
  };

  const loadDraftForSubject = (subject, drafts = assessmentDrafts) => {
    const existing = drafts.find((draft) => draft.subject === subject);
    setResultForm((prev) => ({
      ...prev,
      subject,
      custom_subject: "",
      grade: existing?.grade || "",
      teacher_comments: existing?.teacher_comments || "",
      report_url: existing?.report_url || prev.report_url || "",
      result_type: "assessment",
    }));
  };

  const saveAndNextSubject = () => {
    const nextDrafts = mergeCurrentDraft();
    if (!nextDrafts) return;

    const nextIndex = Math.min(subjectIndex + 1, subjectOptions.length - 1);
    setSubjectIndex(nextIndex);
    loadDraftForSubject(subjectOptions[nextIndex], nextDrafts);
    toast.success(nextIndex === subjectIndex ? "Subject saved" : "Subject saved. Continue with the next subject.");
  };

  const generateAssessmentSummaryPdf = (student, exam, drafts) => {
    const doc = new jsPDF();
    const counts = drafts.reduce((acc, draft) => {
      const band = String(draft.grade || "").slice(0, 2);
      acc[band] = (acc[band] || 0) + 1;
      return acc;
    }, {});
    const strongest = ["EE", "ME", "AE", "BE"].find((band) => counts[band]) || "-";

    doc.setFontSize(16);
    doc.text("CBC Assessment Report", 15, 18);
    doc.setFontSize(11);
    doc.text(`Learner: ${student?.full_name || "-"}`, 15, 32);
    doc.text(`Class: ${student?.class_name || "-"}`, 15, 40);
    doc.text(`Admission/Access: ${student?.admission_number || student?.student_access_code || "-"}`, 15, 48);
    doc.text(`Exam: ${exam?.name || "-"}`, 15, 56);
    doc.text(`General Performance: ${strongest}`, 15, 64);

    let y = 78;
    drafts.forEach((draft, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${index + 1}. ${draft.subject}: ${draft.grade} - ${draft.teacher_comments || "No remarks"}`, 15, y);
      y += 9;
    });

    doc.save(`${student?.admission_number || student?.student_access_code || "assessment"}-cbc-assessment.pdf`);
  };

  /* =========================
     SUBMIT RESULT
  ========================= */
  const handleSubmitResult = async (e) => {
    e.preventDefault();

    try {
      const drafts = mergeCurrentDraft();
      if (!drafts || drafts.length === 0) return;

      const exam = asArray(exams).find((item) => item.id === resultForm.exam_id);

      await Promise.all(drafts.map((draft) =>
        apiClient.post("/results", {
          ...draft,
          marks: gradeToMarks(draft.grade),
        })
      ));

      generateAssessmentSummaryPdf(selectedAssessmentStudent, exam, drafts);
      toast.success("Assessment submitted and report downloaded");

      setResultForm({
        exam_id: "",
        student_id: "",
        subject: "",
        custom_subject: "",
        grade: "",
        teacher_comments: "",
        report_url: "",
        result_type: "assessment",
      });
      setAssessmentDrafts([]);
      setSubjectIndex(0);

      setResultsDialogOpen(false);
      fetchTeacherData();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to submit result");
    }
  };

  const openResultDialog = (student = null) => {
    const classSubjects = learningAreasForClass(student?.class_name);
    setResultForm((prev) => ({
      ...prev,
      student_id: student?.id || "",
      subject: classSubjects[0] || "",
      custom_subject: "",
      grade: "",
      teacher_comments: "",
      result_type: "assessment",
    }));
    setAssessmentDrafts([]);
    setSubjectIndex(0);
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

  const handleReportUpload = async (file) => {
    if (!file) return;
    try {
      const category = resultForm.result_type === "exam" ? "exam" : "assessment";
      const url = await uploadManagedFile(file, category);
      setResultForm((prev) => ({ ...prev, report_url: url }));
      toast.success("Report uploaded");
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || "Report upload failed");
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
        class_name: asArray(students).find((student) => student.id === attendanceForm.student_id)?.class_name || null,
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
        <p className="text-slate-500 text-sm mt-1">
          Class learners: {[...new Set(asArray(students).map((s) => s.class_name).filter(Boolean))].join(", ") || "No class records assigned yet"}
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
          CBC Assessment
        </Button>
      </div>

      {/* SAFE LIST */}
      <Card>
        <CardHeader>
          <CardTitle>Assigned Class Learners</CardTitle>
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
                  <Button size="sm" onClick={() => openResultDialog(s)}>CBC Assessment</Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={resultsDialogOpen} onOpenChange={setResultsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit CBC Assessment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitResult} className="space-y-4">
            <div className="space-y-2">
              <Label>Student</Label>
              <Select
                value={resultForm.student_id}
                onValueChange={(value) => {
                  const student = asArray(students).find((item) => item.id === value);
                  const subjects = learningAreasForClass(student?.class_name);
                  setAssessmentDrafts([]);
                  setSubjectIndex(0);
                  setResultForm({
                    ...resultForm,
                    student_id: value,
                    subject: subjects[0] || "",
                    custom_subject: "",
                    grade: "",
                    teacher_comments: "",
                    result_type: "assessment",
                  });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {asArray(students).map((student) => (
                    <SelectItem key={student.id} value={student.id}>{student.full_name} - {student.admission_number || student.student_access_code}</SelectItem>
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
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Subject / Learning Area</Label>
                <Select
                  value={resultForm.subject}
                  onValueChange={(value) => {
                    const index = subjectOptions.indexOf(value);
                    setSubjectIndex(index >= 0 ? index : 0);
                    loadDraftForSubject(value);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {subjectOptions.map((subject) => (
                      <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                    ))}
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {resultForm.subject === "other" && (
                  <Input
                    placeholder="Type subject / learning area"
                    value={resultForm.custom_subject || ""}
                    onChange={(e) => setResultForm({ ...resultForm, custom_subject: e.target.value })}
                    required
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>CBC Grade</Label>
                <Select value={resultForm.grade} onValueChange={(value) => setResultForm({ ...resultForm, grade: value })}>
                  <SelectTrigger><SelectValue placeholder="Select CBC grade" /></SelectTrigger>
                  <SelectContent>
                    {CBC_GRADE_OPTIONS.map((grade) => (
                      <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-lg border border-[#1E293B] bg-[#0F172A] p-3 text-sm text-slate-300">
              Saved subjects: {assessmentDrafts.length} / {subjectOptions.length}
            </div>
            <Textarea placeholder="Teacher comments" value={resultForm.teacher_comments} onChange={(e) => setResultForm({ ...resultForm, teacher_comments: e.target.value })} />
            <div className="space-y-2">
              <Label>Upload Exam / Assessment Report</Label>
              <Input type="file" accept="image/*,.pdf" onChange={(e) => handleReportUpload(e.target.files?.[0])} />
              {resultForm.report_url && <p className="text-xs text-emerald-400">Report uploaded and will await admin approval</p>}
            </div>
            <div className="sticky bottom-0 bg-background pt-3 grid md:grid-cols-2 gap-3">
              <Button type="button" variant="outline" onClick={saveAndNextSubject}>
                Save & Next Subject
              </Button>
              <Button type="submit">Submit & Download Report</Button>
            </div>
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
                <TabsTrigger value="guardians">Parent/Guardians</TabsTrigger>
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
                      <p className="text-white font-medium">{result.subject}: {result.grade || result.marks}</p>
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

function formatProfileLabel(key) {
  return key
    .replace(/^secondary_guardian_/, "parent/guardian 2 ")
    .replace(/^guardian_/, "parent/guardian 1 ")
    .replaceAll("_", " ");
}

function TeacherProfileTab({ value, data }) {
  return (
    <TabsContent value={value}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        {Object.entries(data).map(([key, val]) => (
          <div key={key} className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-3">
            <p className="text-xs text-slate-400 capitalize">{formatProfileLabel(key)}</p>
            <p className="text-white break-words">{String(val || "-")}</p>
          </div>
        ))}
      </div>
    </TabsContent>
  );
}

export default TeacherPortal;
