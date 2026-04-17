import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiClient, authService } from "@/App";
import { toast } from "sonner";
import { Plus, Search, Download, ArrowUpRight } from "lucide-react";

const StudentsPage = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [progressYear, setProgressYear] = useState(new Date().getFullYear().toString());
  const [progressLoading, setProgressLoading] = useState(false);
  const user = authService.getUser();
  const [formData, setFormData] = useState({
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
    status: "active"
  });

  const kenyaClasses = [
    "PP1", "PP2", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6",
    "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"
  ];

  const collegeYears = ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6"];

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const response = await apiClient.get("/students?approval_status=all");
      setStudents(response.data);
    } catch (error) {
      toast.error("Failed to fetch students");
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
      fetchStudents();
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add student");
    }
  };

  const resetForm = () => {
    setFormData({
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
      status: "active"
    });
  };

  const updateStudentStatus = async (studentId, newStatus, reason) => {
    try {
      await apiClient.patch(`/students/${studentId}/status`, { status: newStatus, reason });
      toast.success("Student status updated");
      fetchStudents();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleProgressStudents = async () => {
    if (!window.confirm(`Are you sure you want to progress ALL active students to the next grade for academic year ${progressYear}? This will archive their current grade and move them up.`)) return;
    setProgressLoading(true);
    try {
      const res = await apiClient.post("/admin/progress-students", { academic_year: progressYear });
      toast.success(`${res.data.progressed} students progressed, ${res.data.graduated} graduated`);
      setProgressDialogOpen(false);
      fetchStudents();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Progression failed");
    } finally {
      setProgressLoading(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    const matchesSearch = s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.admission_number.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status) => {
    const colors = {
      active: "bg-green-100 text-green-800",
      graduated: "bg-blue-100 text-blue-800",
      deferred: "bg-yellow-100 text-yellow-800",
      transferred: "bg-purple-100 text-purple-800",
      suspended: "bg-orange-100 text-orange-800",
      expelled: "bg-red-100 text-red-800"
    };
    return colors[status] || "bg-slate-100 text-slate-800";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Students</h2>
          <p className="text-slate-400 mt-1">Manage student records and status</p>
        </div>
        <div className="flex gap-2">
          {user?.role === "school_admin" && (
            <Dialog open={progressDialogOpen} onOpenChange={setProgressDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="progress-students-btn" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                  <ArrowUpRight className="w-4 h-4 mr-2" /> Progress Students
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Progress Students to Next Grade</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-slate-400">This will move all active, approved students to their next grade. Students in Grade 12 will be marked as graduated. Historical records are preserved.</p>
                  <div className="space-y-2">
                    <Label>Academic Year *</Label>
                    <Input data-testid="progress-year-input" value={progressYear}
                      onChange={(e) => setProgressYear(e.target.value)} placeholder="e.g. 2026" />
                  </div>
                  <Button onClick={handleProgressStudents} disabled={progressLoading} data-testid="confirm-progress-btn"
                    className="w-full bg-amber-600 hover:bg-amber-500">
                    {progressLoading ? "Processing..." : "Confirm Progression"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-student-btn">
                <Plus className="w-4 h-4 mr-2" />
                Add Student
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Admission Number *</Label>
                  <Input
                    data-testid="admission-number-input"
                    value={formData.admission_number}
                    onChange={(e) => setFormData({ ...formData, admission_number: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date of Birth *</Label>
                  <Input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gender *</Label>
                  <Select value={formData.gender} onValueChange={(value) => setFormData({ ...formData, gender: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Class (Primary/Secondary)</Label>
                  <Select value={formData.class_name} onValueChange={(value) => setFormData({ ...formData, class_name: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {kenyaClasses.map((cls) => (
                        <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Year (College/University)</Label>
                  <Select value={formData.year_of_study} onValueChange={(value) => setFormData({ ...formData, year_of_study: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {collegeYears.map((year) => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Stream/Section</Label>
                <Input
                  value={formData.stream}
                  onChange={(e) => setFormData({ ...formData, stream: e.target.value })}
                  placeholder="e.g., A, B, Science, Arts"
                />
              </div>
              
              <div className="border-t pt-4">
                <h3 className="font-semibold text-lg mb-3">Primary Guardian Details</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Guardian Name *</Label>
                      <Input
                        value={formData.guardian_name}
                        onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Relationship *</Label>
                      <Select value={formData.guardian_relationship} onValueChange={(value) => setFormData({ ...formData, guardian_relationship: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="parent">Parent</SelectItem>
                          <SelectItem value="guardian">Guardian</SelectItem>
                          <SelectItem value="relative">Relative</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Phone Number *</Label>
                      <Input
                        value={formData.guardian_phone}
                        onChange={(e) => setFormData({ ...formData, guardian_phone: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email Address</Label>
                      <Input
                        type="email"
                        value={formData.guardian_email}
                        onChange={(e) => setFormData({ ...formData, guardian_email: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="font-semibold text-lg mb-3">Secondary Guardian (Optional)</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={formData.secondary_guardian_name}
                      onChange={(e) => setFormData({ ...formData, secondary_guardian_name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <Input
                        value={formData.secondary_guardian_phone}
                        onChange={(e) => setFormData({ ...formData, secondary_guardian_phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email Address</Label>
                      <Input
                        type="email"
                        value={formData.secondary_guardian_email}
                        onChange={(e) => setFormData({ ...formData, secondary_guardian_email: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Medical Information</Label>
                <Input
                  value={formData.medical_info}
                  onChange={(e) => setFormData({ ...formData, medical_info: e.target.value })}
                  placeholder="Allergies, conditions, medications..."
                />
              </div>
              
              <Button data-testid="submit-student-btn" type="submit" className="w-full">
                Add Student
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                data-testid="search-students-input"
                placeholder="Search students..."
                className="pl-10"
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
          <div className="overflow-auto rounded-lg border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead>Admission No.</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Class/Year</TableHead>
                  <TableHead>Guardian</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approval</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      No students found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => (
                    <TableRow key={student.id} data-testid="student-row">
                      <TableCell className="font-medium">{student.admission_number}</TableCell>
                      <TableCell>{student.full_name}</TableCell>
                      <TableCell>
                        {student.class_name || student.year_of_study} {student.stream}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{student.guardian_name}</p>
                          {student.guardian_email && (
                            <p className="text-xs text-slate-500">{student.guardian_email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{student.guardian_phone}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(student.status)}>
                          {student.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          student.approval_status === "approved" ? "bg-green-100 text-green-800" :
                          student.approval_status === "rejected" ? "bg-red-100 text-red-800" :
                          "bg-yellow-100 text-yellow-800"
                        }>
                          {student.approval_status || "approved"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentsPage;
