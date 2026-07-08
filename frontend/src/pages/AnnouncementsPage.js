import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/App";
import { toast } from "sonner";
import { Plus, Bell, AlertTriangle, AlertCircle, Info } from "lucide-react";

const AnnouncementsPage = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    title: "",
    content: "",
    target_audience: "all",
    target_class: "",
    target_student_ids_text: "",
    target_staff_user_ids_text: "",
    priority: "normal"
  });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const res = await apiClient.get("/announcements?approval_status=all");
      const data = res?.data;
      setAnnouncements(
        Array.isArray(data)
          ? data
          : data?.data || data?.announcements || []
      );
    } catch (err) {
      toast.error("Failed to load announcements");
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        ...form,
        target_student_ids: splitTargets(form.target_student_ids_text),
        target_staff_user_ids: splitTargets(form.target_staff_user_ids_text),
      };
      delete payload.target_student_ids_text;
      delete payload.target_staff_user_ids_text;

      const res = await apiClient.post("/announcements", payload);

      toast.success(
        (res?.data?.approval_status || res?.data?.data?.approval_status) === "pending"
          ? "Sent for admin approval"
          : "Announcement published"
      );

      setOpen(false);
      setForm({
        title: "",
        content: "",
        target_audience: "all",
        target_class: "",
        target_student_ids_text: "",
        target_staff_user_ids_text: "",
        priority: "normal"
      });

      fetchAnnouncements();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit");
    }
  };

  const splitTargets = (value) => String(value || "").split(",").map((item) => item.trim()).filter(Boolean);

  const getPriorityIcon = (p) => {
    if (p === "urgent") return <AlertTriangle className="w-4 h-4 text-red-500" />;
    if (p === "high") return <AlertCircle className="w-4 h-4 text-orange-500" />;
    return <Info className="w-4 h-4 text-blue-500" />;
  };

  const getPriorityColor = (p) => {
    if (p === "urgent") return "bg-red-500/10 text-red-400 border-red-500/20";
    if (p === "high") return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  };

  const pending = announcements.filter(a => a.approval_status === "pending").length;

  if (loading) {
    return <div className="text-slate-400 p-6">Loading announcements...</div>;
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Announcements</h2>
          <p className="text-slate-400">School-wide communication hub</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600">
              <Plus className="w-4 h-4 mr-2" />
              New Announcement
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Announcement</DialogTitle>
            </DialogHeader>

            <form onSubmit={submit} className="space-y-3">

              <Input
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />

              <Textarea
                placeholder="Message..."
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                required
              />

              <div className="grid grid-cols-2 gap-3">

                <Select
                  value={form.target_audience}
                  onValueChange={(v) => setForm({ ...form, target_audience: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Audience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="students">Students</SelectItem>
                    <SelectItem value="parents">Parents</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="class">Specific Class</SelectItem>
                    <SelectItem value="specific_students">Specific Students</SelectItem>
                    <SelectItem value="specific_staff">Specific Staff</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm({ ...form, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>

              </div>

              {form.target_audience === "class" && (
                <div>
                  <Label>Class</Label>
                  <Input
                    placeholder="Example: Grade 4"
                    value={form.target_class}
                    onChange={(e) => setForm({ ...form, target_class: e.target.value })}
                  />
                </div>
              )}

              {form.target_audience === "specific_students" && (
                <div>
                  <Label>Student IDs or Admission Numbers</Label>
                  <Input
                    placeholder="Comma separated"
                    value={form.target_student_ids_text}
                    onChange={(e) => setForm({ ...form, target_student_ids_text: e.target.value })}
                  />
                </div>
              )}

              {form.target_audience === "specific_staff" && (
                <div>
                  <Label>Staff User IDs</Label>
                  <Input
                    placeholder="Comma separated"
                    value={form.target_staff_user_ids_text}
                    onChange={(e) => setForm({ ...form, target_staff_user_ids_text: e.target.value })}
                  />
                </div>
              )}

              <Button type="submit" className="w-full">
                Submit for Approval
              </Button>

            </form>
          </DialogContent>
        </Dialog>

      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <Card className="bg-[#1A2332] border-[#1E293B]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-400">Total</CardTitle>
          </CardHeader>
          <CardContent className="text-white text-2xl">
            {announcements.length}
          </CardContent>
        </Card>

        <Card className="bg-[#1A2332] border-[#1E293B]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-400">Pending Approval</CardTitle>
          </CardHeader>
          <CardContent className="text-yellow-400 text-2xl">
            {pending}
          </CardContent>
        </Card>

        <Card className="bg-[#1A2332] border-[#1E293B]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-400">Active</CardTitle>
          </CardHeader>
          <CardContent className="text-green-400 text-2xl">
            {announcements.filter(a => a.approval_status === "approved").length}
          </CardContent>
        </Card>

      </div>

      {/* List */}
      <div className="space-y-3">

        {announcements.length === 0 ? (
          <Card className="bg-[#1A2332] border-[#1E293B]">
            <CardContent className="p-6 text-slate-400 text-center">
              No announcements found
            </CardContent>
          </Card>
        ) : (
          announcements.map(a => (
            <Card key={a.id} className="bg-[#1A2332] border-[#1E293B]">

              <CardContent className="p-4 space-y-2">

                <div className="flex items-center justify-between">

                  <div className="flex items-center gap-2">
                    {getPriorityIcon(a.priority)}
                    <h3 className="text-white font-semibold">{a.title}</h3>
                  </div>

                  <Badge className={getPriorityColor(a.priority)}>
                    {a.priority}
                  </Badge>

                </div>

                <p className="text-slate-400 text-sm whitespace-pre-wrap">
                  {a.content}
                </p>

                <div className="flex gap-2 flex-wrap">

                  <Badge className="bg-white/5 text-slate-300">
                    {a.target_audience}
                  </Badge>

                  {a.target_class && (
                    <Badge className="bg-white/5 text-slate-300">
                      {a.target_class}
                    </Badge>
                  )}

                  {(a.target_student_ids || []).length > 0 && (
                    <Badge className="bg-white/5 text-slate-300">
                      {(a.target_student_ids || []).length} students
                    </Badge>
                  )}

                  {(a.target_staff_user_ids || []).length > 0 && (
                    <Badge className="bg-white/5 text-slate-300">
                      {(a.target_staff_user_ids || []).length} staff
                    </Badge>
                  )}

                  <Badge className={
                    a.approval_status === "approved"
                      ? "bg-green-500/10 text-green-400"
                      : a.approval_status === "rejected"
                      ? "bg-red-500/10 text-red-400"
                      : "bg-yellow-500/10 text-yellow-400"
                  }>
                    {a.approval_status}
                  </Badge>

                </div>

              </CardContent>

            </Card>
          ))
        )}

      </div>

    </div>
  );
};

export default AnnouncementsPage;
