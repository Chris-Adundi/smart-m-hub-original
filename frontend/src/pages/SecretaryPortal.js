import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient, authService } from "@/App";
import { toast } from "sonner";
import {
  Plus, Search, Users, Bell, FileText, ClipboardCheck,
  Heart, Shield, Clock
} from "lucide-react";

const SecretaryPortal = () => {
  const [students, setStudents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [announcementDialogOpen, setAnnouncementDialogOpen] = useState(false);
  const user = authService.getUser();

  const kenyaClasses = [
    "PP1", "PP2", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6",
    "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"
  ];

  const [studentForm, setStudentForm] = useState({
    admission_number: "", full_name: "", date_of_birth: "", gender: "male",
    class_name: "", year_of_study: "", stream: "",
    guardian_name: "", guardian_phone: "", guardian_email: "", guardian_relationship: "parent",
    secondary_guardian_name: "", secondary_guardian_phone: "", secondary_guardian_email: "",
    secondary_guardian_relationship: "",
    blood_type: "", allergies: "", chronic_conditions: "", disabilities: "",
    immunization_status: "", medical_info: ""
  });

  const [announcementForm, setAnnouncementForm] = useState({
    title: "", content: "", target_audience: "all", target_class: "", priority: "normal"
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [studentsRes, announcementsRes] = await Promise.all([
        apiClient.get("/students?approval_status=all"),
        apiClient.get("/announcements?approval_status=all"),
      ]);
      setStudents(studentsRes.data);
      setAnnouncements(announcementsRes.data);
    } catch (error) {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitStudent = async (e) => {
    e.preventDefault();
    try {
      const res = await apiClient.post("/students", studentForm);
      toast.success(res.data.approval_status === "pending"
        ? "Student submitted for admin approval"
        : "Student added successfully");
      setStudentDialogOpen(false);
      resetStudentForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add student");
    }
  };

  const handleSubmitAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const res = await apiClient.post("/announcements", announcementForm);
      toast.success(res.data.approval_status === "pending"
        ? "Announcement submitted for admin approval"
        : "Announcement posted");
      setAnnouncementDialogOpen(false);
      setAnnouncementForm({ title: "", content: "", target_audience: "all", target_class: "", priority: "normal" });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to post announcement");
    }
  };

  const resetStudentForm = () => {
    setStudentForm({
      admission_number: "", full_name: "", date_of_birth: "", gender: "male",
      class_name: "", year_of_study: "", stream: "",
      guardian_name: "", guardian_phone: "", guardian_email: "", guardian_relationship: "parent",
      secondary_guardian_name: "", secondary_guardian_phone: "", secondary_guardian_email: "",
      secondary_guardian_relationship: "",
      blood_type: "", allergies: "", chronic_conditions: "", disabilities: "",
      immunization_status: "", medical_info: ""
    });
  };

  const filteredStudents = students.filter(s =>
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.admission_number?.toLowerCase().includes(search.toLowerCase())
  );

  const approvalColor = (status) => {
    if (status === "approved") return "bg-green-100 text-green-800";
    if (status === "rejected") return "bg-red-100 text-red-800";
    return "bg-yellow-100 text-yellow-800";
  };

  const pendingStudents = students.filter(s => s.approval_status === "pending").length;
  const approvedStudents = students.filter(s => s.approval_status === "approved").length;
  const pendingAnnouncements = announcements.filter(a => a.approval_status === "pending").length;

  return (
    <div className="space-y-6" data-testid="secretary-portal">
      <div className="bg-gradient-to-r from-amber-600/20 to-orange-600/20 border border-amber-500/20 rounded-2xl p-8">
        <h2 className="text-4xl font-bold text-white">Secretary Portal</h2>
        <p className="text-amber-300/70 mt-2 text-lg">Welcome, {user?.full_name}</p>
        <p className="text-amber-400/50 text-sm mt-1">Manage student records and school announcements</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-amber-500 bg-[#1A2332] border-[#1E293B]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-400">Total Students</CardTitle>
              <Users className="w-5 h-5 text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white" data-testid="total-students-count">{students.length}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500 bg-[#1A2332] border-[#1E293B]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-400">Approved</CardTitle>
              <ClipboardCheck className="w-5 h-5 text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">{approvedStudents}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500 bg-[#1A2332] border-[#1E293B]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-400">Pending Approval</CardTitle>
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-400">{pendingStudents}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500 bg-[#1A2332] border-[#1E293B]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-400">Announcements</CardTitle>
              <Bell className="w-5 h-5 text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{announcements.length}</div>
            {pendingAnnouncements > 0 && (
              <p className="text-xs text-yellow-600 mt-1">{pendingAnnouncements} pending</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="students" className="space-y-6">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="students" data-testid="tab-students">Student Records</TabsTrigger>
          <TabsTrigger value="announcements" data-testid="tab-announcements">Announcements</TabsTrigger>
        </TabsList>

        <TabsContent value="students">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle>Student Records</CardTitle>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      data-testid="search-students-input"
                      placeholder="Search students..."
                      className="pl-10 w-64"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Dialog open={studentDialogOpen} onOpenChange={setStudentDialogOpen}>
                    <DialogTrigger asChild>
                      <Button data-testid="add-student-btn" className="bg-amber-600 hover:bg-amber-700">
                        <Plus className="w-4 h-4 mr-2" /> Add Student
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Register New Student</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleSubmitStudent} className="space-y-6">
                        {/* Basic Info */}
                        <div>
                          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                            <FileText className="w-5 h-5" /> Basic Information
                          </h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Admission Number *</Label>
                              <Input data-testid="admission-number-input" value={studentForm.admission_number}
                                onChange={(e) => setStudentForm({...studentForm, admission_number: e.target.value})} required />
                            </div>
                            <div className="space-y-2">
                              <Label>Full Name *</Label>
                              <Input data-testid="full-name-input" value={studentForm.full_name}
                                onChange={(e) => setStudentForm({...studentForm, full_name: e.target.value})} required />
                            </div>
                            <div className="space-y-2">
                              <Label>Date of Birth *</Label>
                              <Input type="date" value={studentForm.date_of_birth}
                                onChange={(e) => setStudentForm({...studentForm, date_of_birth: e.target.value})} required />
                            </div>
                            <div className="space-y-2">
                              <Label>Gender *</Label>
                              <Select value={studentForm.gender} onValueChange={(v) => setStudentForm({...studentForm, gender: v})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="male">Male</SelectItem>
                                  <SelectItem value="female">Female</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Class</Label>
                              <Select value={studentForm.class_name} onValueChange={(v) => setStudentForm({...studentForm, class_name: v})}>
                                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                                <SelectContent>
                                  {kenyaClasses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Stream</Label>
                              <Input value={studentForm.stream} placeholder="e.g., A, B, East"
                                onChange={(e) => setStudentForm({...studentForm, stream: e.target.value})} />
                            </div>
                          </div>
                        </div>

                        {/* Primary Guardian */}
                        <div className="border-t pt-4">
                          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                            <Shield className="w-5 h-5" /> Primary Guardian
                          </h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Guardian Name *</Label>
                              <Input value={studentForm.guardian_name}
                                onChange={(e) => setStudentForm({...studentForm, guardian_name: e.target.value})} required />
                            </div>
                            <div className="space-y-2">
                              <Label>Relationship *</Label>
                              <Select value={studentForm.guardian_relationship}
                                onValueChange={(v) => setStudentForm({...studentForm, guardian_relationship: v})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="parent">Parent</SelectItem>
                                  <SelectItem value="guardian">Guardian</SelectItem>
                                  <SelectItem value="relative">Relative</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Phone Number *</Label>
                              <Input value={studentForm.guardian_phone}
                                onChange={(e) => setStudentForm({...studentForm, guardian_phone: e.target.value})} required />
                            </div>
                            <div className="space-y-2">
                              <Label>Email</Label>
                              <Input type="email" value={studentForm.guardian_email}
                                onChange={(e) => setStudentForm({...studentForm, guardian_email: e.target.value})} />
                            </div>
                          </div>
                        </div>

                        {/* Secondary Guardian */}
                        <div className="border-t pt-4">
                          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                            <Shield className="w-5 h-5" /> Secondary Guardian (Optional)
                          </h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Name</Label>
                              <Input value={studentForm.secondary_guardian_name}
                                onChange={(e) => setStudentForm({...studentForm, secondary_guardian_name: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                              <Label>Relationship</Label>
                              <Select value={studentForm.secondary_guardian_relationship || ""}
                                onValueChange={(v) => setStudentForm({...studentForm, secondary_guardian_relationship: v})}>
                                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="parent">Parent</SelectItem>
                                  <SelectItem value="guardian">Guardian</SelectItem>
                                  <SelectItem value="relative">Relative</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Phone</Label>
                              <Input value={studentForm.secondary_guardian_phone}
                                onChange={(e) => setStudentForm({...studentForm, secondary_guardian_phone: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                              <Label>Email</Label>
                              <Input type="email" value={studentForm.secondary_guardian_email}
                                onChange={(e) => setStudentForm({...studentForm, secondary_guardian_email: e.target.value})} />
                            </div>
                          </div>
                        </div>

                        {/* Health Info */}
                        <div className="border-t pt-4">
                          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                            <Heart className="w-5 h-5 text-red-500" /> Health Information
                          </h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Blood Type</Label>
                              <Select value={studentForm.blood_type || ""}
                                onValueChange={(v) => setStudentForm({...studentForm, blood_type: v})}>
                                <SelectTrigger><SelectValue placeholder="Select blood type" /></SelectTrigger>
                                <SelectContent>
                                  {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(bt =>
                                    <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Immunization Status</Label>
                              <Select value={studentForm.immunization_status || ""}
                                onValueChange={(v) => setStudentForm({...studentForm, immunization_status: v})}>
                                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="up_to_date">Up to Date</SelectItem>
                                  <SelectItem value="partial">Partial</SelectItem>
                                  <SelectItem value="not_immunized">Not Immunized</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2 col-span-2">
                              <Label>Allergies</Label>
                              <Textarea value={studentForm.allergies} rows={2} placeholder="List known allergies..."
                                onChange={(e) => setStudentForm({...studentForm, allergies: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                              <Label>Chronic Conditions</Label>
                              <Textarea value={studentForm.chronic_conditions} rows={2} placeholder="Asthma, diabetes, etc."
                                onChange={(e) => setStudentForm({...studentForm, chronic_conditions: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                              <Label>Disabilities</Label>
                              <Textarea value={studentForm.disabilities} rows={2} placeholder="If any..."
                                onChange={(e) => setStudentForm({...studentForm, disabilities: e.target.value})} />
                            </div>
                            <div className="space-y-2 col-span-2">
                              <Label>Additional Medical Info</Label>
                              <Textarea value={studentForm.medical_info} rows={2} placeholder="Medications, doctor notes..."
                                onChange={(e) => setStudentForm({...studentForm, medical_info: e.target.value})} />
                            </div>
                          </div>
                        </div>

                        <Button data-testid="submit-student-btn" type="submit" className="w-full bg-amber-600 hover:bg-amber-700">
                          Submit for Admin Approval
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <p className="text-lg font-medium">No students found</p>
                  <p className="text-sm mt-1">Add a new student to get started</p>
                </div>
              ) : (
                <div className="overflow-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50">
                        <TableHead>Adm. No.</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Guardian</TableHead>
                        <TableHead>Blood Type</TableHead>
                        <TableHead>Approval</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map(student => (
                        <TableRow key={student.id} data-testid="student-row">
                          <TableCell className="font-medium">{student.admission_number}</TableCell>
                          <TableCell>{student.full_name}</TableCell>
                          <TableCell>{student.class_name || student.year_of_study} {student.stream}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{student.guardian_name}</p>
                              <p className="text-xs text-slate-500">{student.guardian_phone}</p>
                            </div>
                          </TableCell>
                          <TableCell>{student.blood_type || "-"}</TableCell>
                          <TableCell>
                            <Badge className={approvalColor(student.approval_status)}>
                              {student.approval_status}
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

        <TabsContent value="announcements">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Announcements</CardTitle>
                <Dialog open={announcementDialogOpen} onOpenChange={setAnnouncementDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="create-announcement-btn" className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="w-4 h-4 mr-2" /> New Announcement
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Create Announcement</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmitAnnouncement} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Title *</Label>
                        <Input data-testid="announcement-title-input" value={announcementForm.title}
                          onChange={(e) => setAnnouncementForm({...announcementForm, title: e.target.value})} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Content *</Label>
                        <Textarea data-testid="announcement-content-input" rows={6} value={announcementForm.content}
                          onChange={(e) => setAnnouncementForm({...announcementForm, content: e.target.value})} required />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Target Audience *</Label>
                          <Select value={announcementForm.target_audience}
                            onValueChange={(v) => setAnnouncementForm({...announcementForm, target_audience: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="students">Students</SelectItem>
                              <SelectItem value="parents">Parents</SelectItem>
                              <SelectItem value="staff">Staff</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Priority</Label>
                          <Select value={announcementForm.priority}
                            onValueChange={(v) => setAnnouncementForm({...announcementForm, priority: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button data-testid="submit-announcement-btn" type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                        Submit for Approval
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {announcements.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Bell className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <p className="text-lg font-medium">No announcements</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {announcements.map(a => (
                    <div key={a.id} className="p-4 border border-slate-200 rounded-lg" data-testid="announcement-item">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">{a.title}</h3>
                          <p className="text-sm text-slate-600 mt-1 line-clamp-2">{a.content}</p>
                          <p className="text-xs text-slate-400 mt-2">{new Date(a.created_at).toLocaleDateString()}</p>
                        </div>
                        <Badge className={approvalColor(a.approval_status)}>{a.approval_status}</Badge>
                      </div>
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

export default SecretaryPortal;
