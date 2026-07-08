import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/App";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { uploadManagedFile } from "@/utils/uploads";

const initialForm = {
  admission_number: "",
  passport_photo_url: "",
  full_name: "",
  gender: "male",
  date_of_birth: "",
  birth_certificate_no: "",
  nationality: "Kenyan",
  religion: "",
  special_needs: "",
  status: "active",
  class_name: "",
  stream: "",
  year_of_study: "",
  guardian_name: "",
  guardian_relationship: "parent",
  guardian_phone: "",
  guardian_email: "",
  guardian_occupation: "",
  guardian_national_id: "",
  guardian_address: "",
  secondary_guardian_name: "",
  secondary_guardian_relationship: "",
  secondary_guardian_phone: "",
  secondary_guardian_email: "",
  secondary_guardian_occupation: "",
  secondary_guardian_national_id: "",
  secondary_guardian_address: "",
  chronic_conditions: "",
  allergies: "",
  medication: "",
  hospital_letter_url: "",
  previous_school: "",
  transfer_reason: "",
  last_class: "",
  documents_attached: [],
};

const textFields = [
  ["full_name", "Full Name"],
  ["date_of_birth", "Date of Birth", "date"],
  ["birth_certificate_no", "Birth Certificate No."],
  ["nationality", "Nationality"],
  ["religion", "Religion"],
  ["class_name", "Class"],
  ["stream", "Stream"],
  ["year_of_study", "Boarding/Day"],
  ["guardian_name", "Guardian 1 Name"],
  ["guardian_phone", "Guardian 1 Phone"],
  ["guardian_email", "Guardian 1 Email", "email"],
  ["guardian_occupation", "Guardian 1 Occupation"],
  ["guardian_national_id", "Guardian 1 National ID"],
  ["guardian_address", "Guardian 1 Physical Address"],
  ["secondary_guardian_name", "Guardian 2 Name"],
  ["secondary_guardian_relationship", "Guardian 2 Relationship"],
  ["secondary_guardian_phone", "Guardian 2 Phone"],
  ["secondary_guardian_email", "Guardian 2 Email", "email"],
  ["secondary_guardian_occupation", "Guardian 2 Occupation"],
  ["secondary_guardian_national_id", "Guardian 2 National ID"],
  ["secondary_guardian_address", "Guardian 2 Physical Address"],
  ["previous_school", "Previous School"],
  ["transfer_reason", "Reason for Transfer"],
  ["last_class", "Last Class"],
];

const StudentsPage = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get("/students?approval_status=all");
      const data = response?.data;
      setStudents(Array.isArray(data) ? data : data?.data || data?.students || []);
    } catch {
      toast.error("Failed to fetch students");
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateFileField = async (field, file, category) => {
    if (!file) return;

    try {
      const url = await uploadManagedFile(file, category);
      updateField(field, url);
      toast.success("File uploaded");
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || "File upload failed");
    }
  };

  const toggleDocument = (name, checked) => {
    setFormData((prev) => ({
      ...prev,
      documents_attached: checked
        ? [...(prev.documents_attached || []), name]
        : (prev.documents_attached || []).filter((item) => item !== name),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        admission_number: formData.admission_number || null,
      };
      await apiClient.post("/students", payload);
      toast.success("Student admission submitted");
      setDialogOpen(false);
      setFormData(initialForm);
      fetchStudents();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to admit student");
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = search.toLowerCase();
      const matchesSearch =
        String(s?.full_name || "").toLowerCase().includes(q) ||
        String(s?.admission_number || "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || s?.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [students, search, statusFilter]);

  const openProfile = (student) => {
    setSelectedStudent(student);
    setProfileOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">Students</h2>
          <p className="text-slate-400 mt-1">Admissions, profiles, guardians and history</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Admission
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>SMART M HUB - Student Admission Form</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Admission Number</Label>
                  <Input value="Generated automatically if left blank" readOnly />
                </div>
                <div>
                  <Label>Passport Photo</Label>
                  <Input type="file" accept="image/*" onChange={(e) => updateFileField("passport_photo_url", e.target.files?.[0], "student_photo")} />
                  {formData.passport_photo_url && (
                    <img src={formData.passport_photo_url} alt="Passport preview" className="mt-2 h-20 w-20 rounded-lg object-cover border border-[#1E293B]" />
                  )}
                </div>
                <div>
                  <Label>Gender</Label>
                  <Select value={formData.gender} onValueChange={(v) => updateField("gender", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Current Status</Label>
                  <Select value={formData.status} onValueChange={(v) => updateField("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {textFields.map(([field, label, type]) => (
                  <div key={field}>
                    <Label>{label}</Label>
                    <Input type={type || "text"} value={formData[field] || ""} onChange={(e) => updateField(field, e.target.value)} required={field === "full_name"} />
                  </div>
                ))}
                <div className="md:col-span-2">
                  <Label>Special Needs</Label>
                  <Textarea value={formData.special_needs} onChange={(e) => updateField("special_needs", e.target.value)} />
                </div>
                <div>
                  <Label>Medical Conditions</Label>
                  <Textarea value={formData.chronic_conditions} onChange={(e) => updateField("chronic_conditions", e.target.value)} />
                </div>
                <div>
                  <Label>Allergies</Label>
                  <Textarea value={formData.allergies} onChange={(e) => updateField("allergies", e.target.value)} />
                </div>
                <div>
                  <Label>Medication</Label>
                  <Textarea value={formData.medication} onChange={(e) => updateField("medication", e.target.value)} />
                </div>
                <div>
                  <Label>Hospital Letter</Label>
                  <Input type="file" accept="image/*,.pdf" onChange={(e) => updateFileField("hospital_letter_url", e.target.files?.[0], "medical_letter")} />
                  {formData.hospital_letter_url && (
                    <p className="text-xs text-emerald-400 mt-2">Hospital letter attached</p>
                  )}
                </div>
              </section>

              <section className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-4">
                <Label>Documents Attached</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm text-slate-300">
                  {["Birth Certificate", "Passport Photo", "Previous assessment book", "Other"].map((doc) => (
                    <label key={doc} className="flex items-center gap-2">
                      <input type="checkbox" checked={(formData.documents_attached || []).includes(doc)} onChange={(e) => toggleDocument(doc, e.target.checked)} />
                      {doc}
                    </label>
                  ))}
                </div>
              </section>

              <Button type="submit" className="w-full">Submit Admission</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <Input className="pl-10" placeholder="Search students..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="graduated">Graduated</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
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
                <TableHead>Guardian</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Approval</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6">Loading...</TableCell></TableRow>
              ) : filteredStudents.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6">No students found</TableCell></TableRow>
              ) : (
                filteredStudents.map((student) => (
                  <TableRow key={student.id} className="cursor-pointer" onClick={() => openProfile(student)}>
                    <TableCell>{student.admission_number}</TableCell>
                    <TableCell>{student.full_name}</TableCell>
                    <TableCell>{student.class_name}</TableCell>
                    <TableCell>{student.guardian_name}</TableCell>
                    <TableCell><Badge>{student.status}</Badge></TableCell>
                    <TableCell><Badge>{student.approval_status}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedStudent?.full_name || "Student Profile"}</DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <Tabs defaultValue="overview">
              <div className="flex items-center gap-4 mb-4">
                {selectedStudent.passport_photo_url ? (
                  <img
                    src={selectedStudent.passport_photo_url}
                    alt={`${selectedStudent.full_name} passport`}
                    className="h-20 w-20 rounded-xl object-cover border border-[#1E293B]"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-xl border border-[#1E293B] bg-[#0F172A] flex items-center justify-center text-slate-500 text-xs">
                    No photo
                  </div>
                )}
                <div>
                  <p className="text-white font-semibold">{selectedStudent.full_name}</p>
                  <p className="text-slate-400 text-sm">{selectedStudent.admission_number}</p>
                </div>
              </div>
              <TabsList className="flex flex-wrap h-auto">
                {["overview", "personal", "guardians", "academics", "attendance", "finance", "discipline", "medical", "communication", "history"].map((tab) => (
                  <TabsTrigger key={tab} value={tab}>{tab}</TabsTrigger>
                ))}
              </TabsList>
              <ProfileTab value="overview" data={pick(selectedStudent, ["admission_number", "student_id", "full_name", "status", "approval_status"])} />
              <ProfileTab value="personal" data={pick(selectedStudent, ["gender", "date_of_birth", "birth_certificate_no", "nationality", "religion", "special_needs"])} />
              <ProfileTab value="guardians" data={pick(selectedStudent, ["guardian_name", "guardian_relationship", "guardian_phone", "guardian_email", "guardian_occupation", "guardian_national_id", "guardian_address", "secondary_guardian_name", "secondary_guardian_phone", "secondary_guardian_email"])} />
              <ProfileTab value="academics" data={pick(selectedStudent, ["class_name", "stream", "year_of_study", "previous_school", "transfer_reason", "last_class"])} />
              <ProfileTab value="attendance" data={{ note: "Attendance history is preserved through the attendance module." }} />
              <ProfileTab value="finance" data={{ note: "Fee balances and receipts are managed through Finance and Student Portal." }} />
              <ProfileTab value="discipline" data={{ note: "Discipline history is retained for audit and reporting." }} />
              <ProfileTab value="medical" data={pick(selectedStudent, ["chronic_conditions", "allergies", "medication", "hospital_letter_url"])} />
              <ProfileTab value="communication" data={{ guardian_email: selectedStudent.guardian_email, secondary_guardian_email: selectedStudent.secondary_guardian_email }} />
              <ProfileTab value="history" data={{ created_at: selectedStudent.created_at, updated_at: selectedStudent.updated_at, submitted_by: selectedStudent.submitted_by, approved_by: selectedStudent.approved_by, approval_date: selectedStudent.approval_date }} />
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

function ProfileTab({ value, data }) {
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

export default StudentsPage;
