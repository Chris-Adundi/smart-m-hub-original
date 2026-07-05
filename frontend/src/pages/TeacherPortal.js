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
  if (marks >= 80) return "EE";
  if (marks >= 60) return "ME";
  if (marks >= 40) return "AE";
  return "BE";
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

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentResults, setStudentResults] = useState([]);

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

    return list.filter((a) => a?.date === today).length;
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
                className="flex justify-between p-2 border-b border-slate-700"
              >
                <span>{s.full_name}</span>
                <span className="text-slate-400">
                  {s.admission_number}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

    </div>
  );
};

export default TeacherPortal;
