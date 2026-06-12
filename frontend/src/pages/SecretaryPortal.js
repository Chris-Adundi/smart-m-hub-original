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

const SecretaryPortal = () => {
  const [students, setStudents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [announcementDialogOpen, setAnnouncementDialogOpen] = useState(false);

  const user = authService.getUser();

  const initialStudentForm = {
    admission_number: "",
    full_name: "",
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

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      Register Student
                    </DialogTitle>
                  </DialogHeader>

                  <form
                    onSubmit={handleStudentSubmit}
                    className="space-y-3"
                  >
                    <Input
                      placeholder="Full Name"
                      value={studentForm.full_name}
                      onChange={(e) =>
                        setStudentForm({
                          ...studentForm,
                          full_name: e.target.value,
                        })
                      }
                      required
                    />

                    <Input
                      placeholder="Admission Number"
                      value={studentForm.admission_number}
                      onChange={(e) =>
                        setStudentForm({
                          ...studentForm,
                          admission_number: e.target.value,
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