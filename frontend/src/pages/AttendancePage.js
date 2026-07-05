import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { apiClient } from "@/App";
import { toast } from "sonner";
import { Plus, Calendar } from "lucide-react";

const AttendancePage = () => {
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [dialogOpen, setDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    entity_type: "student",
    entity_id: "",
    date: new Date().toISOString().split("T")[0],
    status: "present",
    remarks: "",
  });

  // ----------------------------
  // FIX: STABLE CALLBACKS
  // ----------------------------

  const fetchStudents = useCallback(async () => {
    try {
      const response = await apiClient.get("/students");
      const data = response?.data;

      const safeStudents = Array.isArray(data)
        ? data
        : data?.data || data?.students || [];

      setStudents(safeStudents);
    } catch (error) {
      console.error(error);
      setStudents([]);
      toast.error("Failed to fetch students");
    }
  }, []);

  const fetchAttendance = useCallback(async () => {
    try {
      const response = await apiClient.get(
        `/attendance?date=${selectedDate}`
      );

      const data = response?.data;

      const safeAttendance = Array.isArray(data)
        ? data
        : data?.data || data?.attendance || [];

      setAttendance(safeAttendance);
    } catch (error) {
      console.error(error);
      setAttendance([]);
      toast.error("Failed to fetch attendance");
    }
  }, [selectedDate]);

  // ----------------------------
  // FIX: EFFECT DEPENDENCIES
  // ----------------------------

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // ----------------------------
  // FORM SUBMIT
  // ----------------------------

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await apiClient.post("/attendance", formData);

      toast.success("Attendance marked successfully");
      setDialogOpen(false);

      setFormData({
        entity_type: "student",
        entity_id: "",
        date: selectedDate,
        status: "present",
        remarks: "",
      });

      fetchAttendance();
    } catch (error) {
      toast.error(
        error?.response?.data?.detail ||
          "Failed to mark attendance"
      );
    }
  };

  // ----------------------------
  // SAFE MEMOS
  // ----------------------------

  const safeAttendance = useMemo(() => {
    return Array.isArray(attendance) ? attendance : [];
  }, [attendance]);

  const safeStudents = useMemo(() => {
    return Array.isArray(students) ? students : [];
  }, [students]);

  const stats = useMemo(() => {
    return {
      present: safeAttendance.filter((a) => a.status === "present").length,
      absent: safeAttendance.filter((a) => a.status === "absent").length,
      late: safeAttendance.filter((a) => a.status === "late").length,
      excused: safeAttendance.filter((a) => a.status === "excused").length,
    };
  }, [safeAttendance]);

  // ----------------------------
  // UI
  // ----------------------------

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">
            Attendance
          </h2>
          <p className="text-slate-600 mt-1">
            Track student and staff attendance
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Mark Attendance
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark Attendance</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">

              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      date: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Student</Label>

                <Select
                  value={formData.entity_id}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      entity_id: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>

                  <SelectContent>
                    {safeStudents.map((student) => (
                      <SelectItem
                        key={student.id}
                        value={String(student.id)}
                      >
                        {student.full_name} - {student.admission_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>

                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      status: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

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
                <Input
                  value={formData.remarks}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      remarks: e.target.value,
                    })
                  }
                />
              </div>

              <Button type="submit" className="w-full">
                Mark Attendance
              </Button>

            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* DATE */}
      <div className="flex items-center gap-4">
        <Calendar className="w-5 h-5" />
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-auto"
        />
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-600">Present</p>
            <p className="text-2xl font-bold text-green-600">
              {stats.present}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-600">Absent</p>
            <p className="text-2xl font-bold text-red-600">
              {stats.absent}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-600">Late</p>
            <p className="text-2xl font-bold text-orange-600">
              {stats.late}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-600">Excused</p>
            <p className="text-2xl font-bold text-blue-600">
              {stats.excused}
            </p>
          </CardContent>
        </Card>

      </div>

      {/* RECORDS */}
      <Card>
        <CardHeader>
          <CardTitle>
            Attendance Records for {selectedDate}
          </CardTitle>
        </CardHeader>

        <CardContent>
          {safeAttendance.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No attendance records for this date
            </div>
          ) : (
            <div className="space-y-2">

              {safeAttendance.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      Student ID: {record.student_id}
                    </p>
                    {record.remarks && (
                      <p className="text-sm text-slate-500">
                        {record.remarks}
                      </p>
                    )}
                  </div>

                  <div
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      record.status === "present"
                        ? "bg-green-100 text-green-800"
                        : record.status === "absent"
                        ? "bg-red-100 text-red-800"
                        : record.status === "late"
                        ? "bg-orange-100 text-orange-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {record.status}
                  </div>
                </div>
              ))}

            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};

export default AttendancePage;
