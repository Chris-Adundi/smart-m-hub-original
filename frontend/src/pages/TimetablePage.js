import { useEffect, useMemo, useState } from "react";
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
import { apiClient } from "@/App";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Plus } from "lucide-react";
import { uploadManagedFile } from "@/utils/uploads";
import { ALL_CBC_CLASSES } from "@/utils/schoolClasses";

const initialForm = {
  class_name: "",
  day: "Monday",
  subject: "",
  time: "",
  teacher_name: "",
  room: "",
  document_url: "",
};

const TimetablePage = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    fetchTimetable();
  }, []);

  const fetchTimetable = async () => {
    try {
      const res = await apiClient.get("/timetable");
      setEntries(Array.isArray(res?.data) ? res.data : res?.data?.data || []);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to load timetable");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const grouped = useMemo(() => {
    return entries.reduce((acc, entry) => {
      const key = entry.class_name || "Unassigned";
      acc[key] = acc[key] || [];
      acc[key].push(entry);
      return acc;
    }, {});
  }, [entries]);

  const openEditor = (entry = null) => {
    setEditing(entry);
    setForm(entry ? { ...initialForm, ...entry } : initialForm);
    setDialogOpen(true);
  };

  const uploadDocument = async (file) => {
    if (!file) return;
    try {
      const url = await uploadManagedFile(file, "document");
      setForm((prev) => ({ ...prev, document_url: url }));
      toast.success("Timetable document uploaded");
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || "Document upload failed");
    }
  };

  const saveEntry = async (event) => {
    event.preventDefault();
    try {
      if (editing?.id) {
        await apiClient.patch(`/timetable/${editing.id}`, form);
        toast.success("Timetable entry updated");
      } else {
        await apiClient.post("/timetable", form);
        toast.success("Timetable entry saved");
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(initialForm);
      fetchTimetable();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to save timetable entry");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">Timetable</h2>
          <p className="text-slate-400 mt-1">Manage weekly schedules, uploads and timetable versions</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openEditor()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Entry
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Timetable Entry" : "New Timetable Entry"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={saveEntry} className="space-y-4">
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={form.class_name} onValueChange={(value) => setForm({ ...form, class_name: value })}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {ALL_CBC_CLASSES.map((className) => (
                      <SelectItem key={className} value={className}>{className}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {[
                ["day", "Day"],
                ["subject", "Subject"],
                ["time", "Time"],
                ["teacher_name", "Teacher"],
                ["room", "Room"],
              ].map(([field, label]) => (
                <div className="space-y-2" key={field}>
                  <Label>{label}</Label>
                  <Input value={form[field] || ""} onChange={(e) => setForm({ ...form, [field]: e.target.value })} required={["class_name", "day", "subject", "time"].includes(field)} />
                </div>
              ))}
              <div className="space-y-2">
                <Label>Upload Timetable</Label>
                <Input type="file" accept="image/*,.pdf" onChange={(e) => uploadDocument(e.target.files?.[0])} />
                {form.document_url && <p className="text-xs text-emerald-400">Document uploaded</p>}
              </div>
              <Button type="submit" className="w-full">Save Timetable</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Timetable</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-slate-400">Loading timetable...</div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <CalendarIcon className="w-16 h-16 mb-4" />
              <p className="text-lg font-medium">No timetable entries yet</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([className, rows]) => (
                <section key={className} className="space-y-3">
                  <h3 className="text-lg font-semibold text-white">{className}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Day</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Teacher</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Document</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>{entry.day}</TableCell>
                          <TableCell>{entry.time}</TableCell>
                          <TableCell>{entry.subject}</TableCell>
                          <TableCell>{entry.teacher_name || "-"}</TableCell>
                          <TableCell>{entry.room || "-"}</TableCell>
                          <TableCell>{entry.version || 1}</TableCell>
                          <TableCell>
                            {entry.document_url ? <a className="text-emerald-400 underline" href={entry.document_url} target="_blank" rel="noreferrer">Open</a> : "-"}
                          </TableCell>
                          <TableCell><Button size="sm" variant="outline" onClick={() => openEditor(entry)}>Edit</Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TimetablePage;
