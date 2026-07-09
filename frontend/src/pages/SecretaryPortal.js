import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { apiClient, authService } from "@/App";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { uploadManagedFile } from "@/utils/uploads";

const SecretaryPortal = () => {
  const [students, setStudents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [announcementDialogOpen, setAnnouncementDialogOpen] = useState(false);

  const user = authService.getUser();

  const initialStudentForm = {
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

  const [studentForm, setStudentForm] = useState(initialStudentForm);

  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    content: "",
  });

  // ----------------------------
  // FIX: STABLE DATA FETCH
  // ----------------------------

  const normalizeArray = (data, fallbackKey) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.[fallbackKey])) return data[fallbackKey];
    return [];
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const [studentsRes, announcementsRes] = await Promise.all([
        apiClient
          .get("/students?approval_status=all")
          .catch(() => ({ data: [] })),
        apiClient
          .get("/announcements?approval_status=all")
          .catch(() => ({ data: [] })),
      ]);

      setStudents(normalizeArray(studentsRes?.data, "students"));
      setAnnouncements(normalizeArray(announcementsRes?.data, "announcements"));
    } catch (err) {
      toast.error("Failed to load portal data");
      setStudents([]);
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ----------------------------
  // FIX: EFFECT DEPENDENCY
  // ----------------------------

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ----------------------------
  // HANDLERS
  // ----------------------------

  const handleStudentSubmit = async (e) => {
    e.preventDefault();

    try {
      await apiClient.post("/students", studentForm);

      toast.success("Student submitted for approval");

      setStudentDialogOpen(false);
      setStudentForm(initialStudentForm);
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to create student");
    }
  };

  const updateStudentField = (field, value) => {
    setStudentForm((prev) => ({ ...prev, [field]: value }));
  };

  const uploadStudentFile = async (field, file, category) => {
    if (!file) return;
    try {
      const url = await uploadManagedFile(file, category);
      updateStudentField(field, url);
      toast.success("File uploaded");
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || "File upload failed");
    }
  };

  const toggleStudentDocument = (name, checked) => {
    setStudentForm((prev) => ({
      ...prev,
      documents_attached: checked
        ? [...(prev.documents_attached || []), name]
        : (prev.documents_attached || []).filter((item) => item !== name),
    }));
  };

  const handleAnnouncementSubmit = async (e) => {
    e.preventDefault();

    try {
      await apiClient.post("/announcements", announcementForm);

      toast.success("Announcement submitted");

      setAnnouncementDialogOpen(false);
      setAnnouncementForm({ title: "", content: "" });

      fetchData();
    } catch (err) {
      toast.error(
        err?.response?.data?.detail || "Failed to post announcement"
      );
    }
  };

  // ----------------------------
  // SAFE DATA
  // ----------------------------

  const safeStudents = Array.isArray(students) ? students : [];
  const safeAnnouncements = Array.isArray(announcements)
    ? announcements
    : [];

  const statusColor = (status) => {
    if (status === "approved") return "bg-green-500/15 text-green-400";
    if (status === "rejected") return "bg-red-500/15 text-red-400";
    return "bg-yellow-500/15 text-yellow-400";
  };

  // ----------------------------
  // LOADING STATE
  // ----------------------------

  if (loading) {
    return (
      <div className="text-slate-400 p-6">
        Loading Secretary Portal...
      </div>
    );
  }

  // ----------------------------
  // UI
  // ----------------------------

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="bg-[#1A2332] border border-[#1E293B] rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white">
          Secretary Portal
        </h2>
        <p className="text-slate-400">
          Welcome, {user?.full_name || "User"}
        </p>
      </div>

      {/* TABS */}
      <Tabs defaultValue="students">

        <TabsList className="bg-[#0F1A2A] border border-[#1E293B]">
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="announcements">
            Announcements
          </TabsTrigger>
        </TabsList>

        {/* STUDENTS */}
        <TabsContent value="students">
          <Card className="bg-[#1A2332] border-[#1E293B]">

            <CardHeader className="flex flex-row justify-between items-center">
              <CardTitle className="text-white">
                Student Records
              </CardTitle>

              <Dialog
                open={studentDialogOpen}
                onOpenChange={setStudentDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button className="bg-amber-600">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Student
                  </Button>
                </DialogTrigger>

                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      Register Student
                    </DialogTitle>
                  </DialogHeader>

                  <form
                    onSubmit={handleStudentSubmit}
                    className="space-y-3"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label>Admission Number</Label>
                        <Input value="Generated automatically if left blank" readOnly />
                      </div>
                      <div>
                        <Label>Passport Photo</Label>
                        <Input type="file" accept="image/*" onChange={(e) => uploadStudentFile("passport_photo_url", e.target.files?.[0], "student_photo")} />
                        {studentForm.passport_photo_url && <p className="text-xs text-emerald-400 mt-1">Photo uploaded</p>}
                      </div>
                      {[
                        ["full_name", "Full Name"],
                        ["gender", "Gender"],
                        ["date_of_birth", "Date of Birth", "date"],
                        ["birth_certificate_no", "Birth Certificate No."],
                        ["nationality", "Nationality"],
                        ["religion", "Religion"],
                        ["class_name", "Class"],
                        ["stream", "Stream"],
                        ["year_of_study", "Boarding/Day"],
                        ["guardian_name", "Guardian 1 Name"],
                        ["guardian_relationship", "Guardian 1 Relationship"],
                        ["guardian_phone", "Guardian 1 Phone"],
                        ["guardian_email", "Guardian 1 Email", "email"],
                        ["guardian_occupation", "Guardian 1 Occupation"],
                        ["guardian_national_id", "Guardian 1 National ID"],
                        ["guardian_address", "Guardian 1 Address"],
                        ["secondary_guardian_name", "Guardian 2 Name"],
                        ["secondary_guardian_relationship", "Guardian 2 Relationship"],
                        ["secondary_guardian_phone", "Guardian 2 Phone"],
                        ["secondary_guardian_email", "Guardian 2 Email", "email"],
                        ["secondary_guardian_occupation", "Guardian 2 Occupation"],
                        ["secondary_guardian_national_id", "Guardian 2 National ID"],
                        ["secondary_guardian_address", "Guardian 2 Address"],
                        ["previous_school", "Previous School"],
                        ["transfer_reason", "Reason for Transfer"],
                        ["last_class", "Last Class"],
                      ].map(([field, label, type]) => (
                        <div key={field}>
                          <Label>{label}</Label>
                          <Input
                            type={type || "text"}
                            value={studentForm[field] || ""}
                            onChange={(e) => updateStudentField(field, e.target.value)}
                            required={field === "full_name"}
                          />
                        </div>
                      ))}
                      <div className="md:col-span-2">
                        <Label>Special Needs</Label>
                        <Textarea value={studentForm.special_needs} onChange={(e) => updateStudentField("special_needs", e.target.value)} />
                      </div>
                      <div>
                        <Label>Medical Conditions</Label>
                        <Textarea value={studentForm.chronic_conditions} onChange={(e) => updateStudentField("chronic_conditions", e.target.value)} />
                      </div>
                      <div>
                        <Label>Allergies</Label>
                        <Textarea value={studentForm.allergies} onChange={(e) => updateStudentField("allergies", e.target.value)} />
                      </div>
                      <div>
                        <Label>Medication</Label>
                        <Textarea value={studentForm.medication} onChange={(e) => updateStudentField("medication", e.target.value)} />
                      </div>
                      <div>
                        <Label>Hospital Letter</Label>
                        <Input type="file" accept="image/*,.pdf" onChange={(e) => uploadStudentFile("hospital_letter_url", e.target.files?.[0], "medical_letter")} />
                        {studentForm.hospital_letter_url && <p className="text-xs text-emerald-400 mt-1">Hospital letter uploaded</p>}
                      </div>
                    </div>

                    <div className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-3">
                      <Label>Documents Attached</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-slate-300">
                        {["Birth Certificate", "Passport Photo", "Previous assessment book", "Other"].map((doc) => (
                          <label key={doc} className="flex items-center gap-2">
                            <input type="checkbox" checked={(studentForm.documents_attached || []).includes(doc)} onChange={(e) => toggleStudentDocument(doc, e.target.checked)} />
                            {doc}
                          </label>
                        ))}
                      </div>
                    </div>

                    <Button type="submit" className="w-full">
                      Submit (Pending Approval)
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>

            <CardContent className="space-y-2">
              {safeStudents.map((s) => (
                <div
                  key={s.id}
                  className="p-3 border border-[#1E293B] rounded flex justify-between"
                >
                  <div>
                    <p className="text-white">{s.full_name}</p>
                    <p className="text-slate-400 text-sm">
                      {s.admission_number}
                      {s.student_access_code ? (
                        <span className="block text-xs text-emerald-400">
                          Access: {s.student_access_code}
                        </span>
                      ) : null}
                    </p>
                  </div>

                  <Badge className={statusColor(s.approval_status)}>
                    {s.approval_status || "pending"}
                  </Badge>
                </div>
              ))}
            </CardContent>

          </Card>
        </TabsContent>

        {/* ANNOUNCEMENTS */}
        <TabsContent value="announcements">
          <Card className="bg-[#1A2332] border-[#1E293B]">

            <CardHeader className="flex flex-row justify-between">
              <CardTitle className="text-white">
                Announcements
              </CardTitle>

              <Dialog
                open={announcementDialogOpen}
                onOpenChange={setAnnouncementDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button className="bg-blue-600">New</Button>
                </DialogTrigger>

                <DialogContent>
                  <form
                    onSubmit={handleAnnouncementSubmit}
                    className="space-y-3"
                  >
                    <Input
                      placeholder="Title"
                      value={announcementForm.title}
                      onChange={(e) =>
                        setAnnouncementForm({
                          ...announcementForm,
                          title: e.target.value,
                        })
                      }
                      required
                    />

                    <Textarea
                      placeholder="Content"
                      value={announcementForm.content}
                      onChange={(e) =>
                        setAnnouncementForm({
                          ...announcementForm,
                          content: e.target.value,
                        })
                      }
                      required
                    />

                    <Button type="submit" className="w-full">
                      Submit (Pending Approval)
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>

            <CardContent className="space-y-3">
              {safeAnnouncements.map((a) => (
                <div
                  key={a.id}
                  className="p-3 border border-[#1E293B] rounded"
                >
                  <p className="text-white font-semibold">
                    {a.title}
                  </p>
                  <p className="text-slate-400 text-sm">
                    {a.content}
                  </p>

                  <Badge className={statusColor(a.approval_status)}>
                    {a.approval_status || "pending"}
                  </Badge>
                </div>
              ))}
            </CardContent>

          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default SecretaryPortal;
