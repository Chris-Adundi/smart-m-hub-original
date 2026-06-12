import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Badge } from "@/components/ui/badge";
import { apiClient, authService } from "@/App";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";

/* ---------------- INITIAL STATE ---------------- */
const initialForm = {
  admission_number: "",
  full_name: "",
  date_of_birth: "",
  gender: "male",
  class_name: "",
  year_of_study: "",
  stream: "",
  guardian_name: "",
  guardian_phone: "",
  guardian_email: "",
  guardian_relationship: "parent",
  secondary_guardian_name: "",
  secondary_guardian_phone: "",
  secondary_guardian_email: "",
  medical_info: "",
  status: "active",
};

const StudentsPage = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState(initialForm);

  const user = authService.getUser();

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);

    try {
      const response = await apiClient.get("/students");

      const data = response?.data;

      // ✅ SAFE NORMALIZATION
      const safeStudents = Array.isArray(data)
        ? data
        : data?.students || [];

      setStudents(safeStudents);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch students");
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await apiClient.post("/students", formData);
      toast.success("Student added successfully");

      setDialogOpen(false);
      setFormData(initialForm);
      fetchStudents();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to add student");
    }
  };

  // ✅ SAFE FILTERING (prevents .filter crash)
  const filteredStudents = useMemo(() => {
    const safe = Array.isArray(students) ? students : [];

    return safe.filter((s) => {
      const fullName = s?.full_name || "";
      const admission = s?.admission_number || "";

      const matchesSearch =
        fullName.toLowerCase().includes(search.toLowerCase()) ||
        admission.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || s?.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [students, search, statusFilter]);

  const getStatusColor = (status) => {
    const colors = {
      active: "bg-green-100 text-green-800",
      graduated: "bg-blue-100 text-blue-800",
      deferred: "bg-yellow-100 text-yellow-800",
      transferred: "bg-purple-100 text-purple-800",
      suspended: "bg-orange-100 text-orange-800",
      expelled: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-slate-100 text-slate-800";
  };

  const safeList = Array.isArray(filteredStudents) ? filteredStudents : [];

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Students</h2>
          <p className="text-slate-400 mt-1">
            Manage student records and status
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Student
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">

              <div className="space-y-2">
                <Label>Admission Number *</Label>
                <Input
                  value={formData.admission_number}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      admission_number: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      full_name: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <Button type="submit" className="w-full">
                Add Student
              </Button>

            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* SEARCH + FILTER */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">

            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <Input
                className="pl-10"
                placeholder="Search students..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="graduated">Graduated</SelectItem>
                <SelectItem value="deferred">Deferred</SelectItem>
                <SelectItem value="transferred">Transferred</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="expelled">Expelled</SelectItem>
              </SelectContent>
            </Select>

          </div>
        </CardHeader>

        <CardContent>
          <Table>

            <TableHeader>
              <TableRow>
                <TableHead>Admission No.</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : safeList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6">
                    No students found
                  </TableCell>
                </TableRow>
              ) : (
                safeList.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>{student.admission_number}</TableCell>
                    <TableCell>{student.full_name}</TableCell>
                    <TableCell>{student.class_name}</TableCell>

                    <TableCell>
                      <Badge className={getStatusColor(student.status)}>
                        {student.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>

          </Table>
        </CardContent>
      </Card>

    </div>
  );
};

export default StudentsPage;