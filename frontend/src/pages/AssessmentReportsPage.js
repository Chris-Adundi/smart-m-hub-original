import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { API, apiClient, authService } from "@/App";
import CbcReportSummaryCards from "@/features/cbc/CbcReportSummaryCards";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { CheckCircle2, Download, Eye, FileText, Send, Upload } from "lucide-react";

const asArray = (value) => (Array.isArray(value) ? value : []);
const payloadList = (payload) => (Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []);

const reportImageDataUrl = (url) => new Promise((resolve, reject) => {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext("2d").drawImage(image, 0, 0);
    resolve(canvas.toDataURL("image/png"));
  };
  image.onerror = reject;
  image.src = String(url || "").startsWith("/") ? `${API.replace(/\/api$/, "")}${url}` : url;
});

const statusTone = {
  draft: "bg-slate-500/15 text-slate-200 border-slate-500/20",
  submitted: "bg-sky-500/15 text-sky-300 border-sky-500/20",
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  published: "bg-purple-500/15 text-purple-300 border-purple-500/20",
  archived: "bg-zinc-500/15 text-zinc-300 border-zinc-500/20",
};

const gradeFromScore = (score) => {
  const value = Number(score);
  if (Number.isNaN(value)) return "";
  if (value >= 80) return "EE";
  if (value >= 60) return "ME";
  if (value >= 40) return "AE";
  return "BE";
};

const AssessmentReportsPage = () => {
  const user = authService.getUser();
  const isAdmin = user?.role === "school_admin" || user?.role === "super_admin";

  const [reports, setReports] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = status === "all" ? {} : { status };
      const [reportsRes, examsRes] = await Promise.all([
        apiClient.get("/assessments/reports", { params }),
        apiClient.get("/exams").catch(() => ({ data: [] })),
      ]);
      setReports(payloadList(reportsRes.data));
      setExams(payloadList(examsRes.data));
    } catch (error) {
      toast.error(error?.message || "Failed to load CBC reports");
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openReport = async (report) => {
    try {
      const response = await apiClient.get(`/assessments/reports/${report.id}`);
      const loaded = response.data?.data || report;
      setSelected(loaded);
      setDraft(JSON.parse(JSON.stringify(loaded)));
    } catch (error) {
      toast.error(error?.message || "Unable to load report");
    }
  };

  const updateLearningArea = (index, key, value) => {
    setDraft((prev) => {
      const learningAreas = asArray(prev?.learning_areas).map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item, [key]: value };
        if (key === "score") {
          next.achievement_level = gradeFromScore(value);
          next.overall_grade = gradeFromScore(value);
        }
        return next;
      });
      return { ...prev, learning_areas: learningAreas };
    });
  };

  const updateNamedAssessment = (section, index, key, value) => {
    setDraft((prev) => ({
      ...prev,
      [section]: asArray(prev?.[section]).map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      ),
    }));
  };

  const saveDraft = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const response = await apiClient.put(`/assessments/reports/${draft.id}/draft`, {
        learning_areas: draft.learning_areas,
        competencies: draft.competencies,
        values: draft.values,
        attendance: draft.attendance,
        co_curricular: draft.co_curricular,
        teacher_remarks: draft.teacher_remarks,
        principal_remarks: draft.principal_remarks,
        parent_acknowledgement: draft.parent_acknowledgement,
        teacher_name: draft.teacher_name || user?.full_name || user?.name,
      });
      const updated = response.data?.data || draft;
      setSelected(updated);
      setDraft(updated);
      toast.success("Draft saved");
      fetchData();
    } catch (error) {
      toast.error(error?.message || "Draft save failed");
    } finally {
      setSaving(false);
    }
  };

  const transition = async (action) => {
    if (!draft) return;
    try {
      await apiClient.post(`/assessments/reports/${draft.id}/${action}`);
      toast.success(`Report ${action}ed`);
      setSelected(null);
      setDraft(null);
      fetchData();
    } catch (error) {
      toast.error(error?.message || `Failed to ${action} report`);
    }
  };

  const bulkGenerate = async (examId) => {
    try {
      await apiClient.post("/assessments/reports/bulk-generate", null, { params: { exam_id: examId } });
      toast.success("Reports generated");
      fetchData();
    } catch (error) {
      toast.error(error?.message || "Bulk generation failed");
    }
  };

  const bulkPublish = async (examId) => {
    try {
      await apiClient.post("/assessments/reports/bulk-publish", null, { params: { exam_id: examId } });
      toast.success("Reports published");
      fetchData();
    } catch (error) {
      toast.error(error?.message || "Bulk publish failed");
    }
  };

  const downloadPdf = async (report) => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const learner = report?.learner_details || {};
    const school = report?.school_details || {};
    doc.setFillColor(15, 118, 110);
    doc.rect(0, 0, 297, 34, "F");
    if (school.logo_url) {
      try {
        doc.addImage(await reportImageDataUrl(school.logo_url), 14, 5, 23, 23, undefined, "FAST");
      } catch {
        // Continue with the school name when an external host blocks logo access.
      }
    }
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text(school.name || "Smart M Hub School", 43, 13);
    doc.setFontSize(11);
    doc.text("OFFICIAL ASSESSMENT REPORT", 43, 22);
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleString()}`, 210, 41);
    doc.text(`Exam: ${report.exam_name || "-"} (${report.exam_number || "-"})`, 14, 43);
    doc.text(`Term: ${report.term || "-"}   Academic Year: ${report.academic_year || "-"}`, 14, 50);
    doc.text(`Learner: ${learner.full_name || "-"}   Admission No: ${learner.admission_number || "-"}`, 14, 57);
    doc.text(`Class: ${report.class_name || learner.class_name || "-"}   Stream: ${report.stream || learner.stream || "-"}`, 14, 64);
    doc.text(`Teacher: ${report.teacher_name || user?.full_name || user?.name || "-"}`, 14, 71);
    doc.setDrawColor(15, 118, 110);
    doc.line(14, 76, 283, 76);
    let y = 84;
    doc.setFont(undefined, "bold");
    doc.text("Learning Area", 16, y);
    doc.text("Score", 102, y);
    doc.text("Achievement Level", 130, y);
    doc.text("Teacher Comment", 185, y);
    doc.setFont(undefined, "normal");
    y += 7;
    asArray(report.learning_areas).forEach((area, index) => {
      if (y > 180) {
        doc.addPage();
        y = 18;
      }
      if (index % 2 === 0) {
        doc.setFillColor(241, 245, 249);
        doc.rect(14, y - 5, 269, 8, "F");
      }
      doc.text(`${index + 1}. ${area.name || area.learning_area || "-"}`, 16, y);
      doc.text(String(area.score ?? "-"), 102, y);
      doc.text(area.achievement_level || area.overall_grade || "-", 130, y);
      doc.text(doc.splitTextToSize(area.teacher_remarks || "-", 92)[0], 185, y);
      y += 8;
    });
    doc.setFont(undefined, "bold");
    doc.text("Teacher's Comment:", 14, y + 5);
    doc.setFont(undefined, "normal");
    doc.text(doc.splitTextToSize(report.teacher_remarks || "-", 220), 52, y + 5);
    doc.setFont(undefined, "bold");
    doc.text("Principal's Comment:", 14, y + 18);
    doc.setFont(undefined, "normal");
    doc.text(doc.splitTextToSize(report.principal_remarks || "-", 215), 55, y + 18);
    doc.text("Teacher Signature: ____________________", 14, y + 38);
    doc.text("Principal Signature: ___________________", 108, y + 38);
    doc.text("Official Stamp: _______________________", 205, y + 38);
    doc.save(`${learner.admission_number || "cbc-report"}.pdf`);
    toast.success("Professional assessment PDF downloaded");
  };

  const summary = useMemo(() => {
    return reports.reduce((acc, report) => {
      const key = report.status || "draft";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [reports]);

  if (loading) return <div className="p-6 text-slate-400">Loading CBC reports...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">CBC Reports</h2>
          <p className="text-slate-400">Draft, review, publish, print, and audit CBC assessment reports.</p>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["all", "draft", "submitted", "approved", "published", "archived"].map((item) => (
              <SelectItem key={item} value={item}>{item.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <CbcReportSummaryCards summary={summary} />

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Bulk Exam Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {exams.slice(0, 6).map((exam) => (
              <div key={exam.id} className="border border-slate-700 rounded-lg p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-white font-medium">{exam.name}</p>
                  <p className="text-xs text-slate-400">{exam.class_name || "All classes"} | {exam.term}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => bulkGenerate(exam.id)}>
                    <FileText className="w-4 h-4 mr-1" />
                    Generate
                  </Button>
                  <Button size="sm" onClick={() => bulkPublish(exam.id)}>
                    <Upload className="w-4 h-4 mr-1" />
                    Publish
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-white">Reports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {reports.length === 0 ? (
            <p className="text-slate-400">No reports found.</p>
          ) : reports.map((report) => (
            <div key={report.id} className="border border-slate-700 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-white font-medium">{report.learner_details?.full_name || report.student_id}</p>
                <p className="text-sm text-slate-400">{report.exam_name} | {report.class_name} | {report.term} {report.academic_year}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={statusTone[report.status] || statusTone.draft}>{report.status}</Badge>
                <Button size="sm" variant="outline" onClick={() => openReport(report)}>
                  <Eye className="w-4 h-4 mr-1" />
                  Open
                </Button>
                <Button size="sm" variant="outline" onClick={() => downloadPdf(report)}>
                  <Download className="w-4 h-4 mr-1" />
                  PDF
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.learner_details?.full_name || "CBC Report"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                <Info label="Exam" value={draft.exam_name} />
                <Info label="Class" value={draft.class_name} />
                <Info label="Term" value={draft.term} />
                <Info label="Status" value={draft.status} />
                <Info label="Teacher" value={draft.teacher_name || user?.full_name || user?.name} />
              </div>

              <section className="space-y-3">
                <h3 className="text-white font-semibold">Learning Areas</h3>
                {asArray(draft.learning_areas).map((area, index) => (
                  <div key={`${area.name}-${index}`} className="grid grid-cols-1 lg:grid-cols-12 gap-2 border border-slate-700 rounded-lg p-3">
                    <div className="lg:col-span-3 text-white font-medium">{area.name}</div>
                    <Input className="lg:col-span-2" type="number" placeholder="Score" value={area.score ?? ""} onChange={(e) => updateLearningArea(index, "score", e.target.value)} disabled={draft.status !== "draft"} />
                    <Input className="lg:col-span-2" placeholder="Level" value={area.achievement_level || ""} onChange={(e) => updateLearningArea(index, "achievement_level", e.target.value)} disabled={draft.status !== "draft"} />
                    <Textarea className="lg:col-span-5" placeholder="Teacher remarks" value={area.teacher_remarks || ""} onChange={(e) => updateLearningArea(index, "teacher_remarks", e.target.value)} disabled={draft.status !== "draft"} />
                  </div>
                ))}
              </section>

              <AssessmentSection title="Core Competencies" section="competencies" draft={draft} update={updateNamedAssessment} />
              <AssessmentSection title="Values" section="values" draft={draft} update={updateNamedAssessment} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Teacher Remarks</Label>
                  <Textarea value={draft.teacher_remarks || ""} onChange={(e) => setDraft({ ...draft, teacher_remarks: e.target.value })} disabled={draft.status !== "draft"} />
                </div>
                <div className="space-y-2">
                  <Label>Principal Remarks</Label>
                  <Textarea value={draft.principal_remarks || ""} onChange={(e) => setDraft({ ...draft, principal_remarks: e.target.value })} disabled={!isAdmin || draft.status === "published" || draft.status === "archived"} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="outline" onClick={() => downloadPdf(draft)}>
                  <Download className="w-4 h-4 mr-1" />
                  PDF
                </Button>
                {draft.status === "draft" && (
                  <>
                    <Button variant="outline" onClick={saveDraft} disabled={saving}>{saving ? "Saving..." : "Save Draft"}</Button>
                    <Button onClick={() => transition("submit")}>
                      <Send className="w-4 h-4 mr-1" />
                      Submit
                    </Button>
                  </>
                )}
                {isAdmin && ["draft", "submitted"].includes(draft.status) && (
                  <Button onClick={() => transition("approve")}>
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                )}
                {isAdmin && ["approved", "submitted"].includes(draft.status) && (
                  <Button onClick={() => transition("publish")}>
                    <Upload className="w-4 h-4 mr-1" />
                    Publish
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

function Info({ label, value }) {
  return (
    <div className="bg-[#0F172A] border border-slate-700 rounded-lg p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-white truncate">{value || "-"}</p>
    </div>
  );
}

function AssessmentSection({ title, section, draft, update }) {
  return (
    <section className="space-y-3">
      <h3 className="text-white font-semibold">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {asArray(draft?.[section]).map((item, index) => (
          <div key={`${section}-${item.name}-${index}`} className="border border-slate-700 rounded-lg p-3 space-y-2">
            <p className="text-white font-medium">{item.name}</p>
            <Input placeholder="Achievement level" value={item.achievement_level || ""} onChange={(e) => update(section, index, "achievement_level", e.target.value)} disabled={draft.status !== "draft"} />
            <Textarea placeholder="Remarks" value={item.teacher_remarks || ""} onChange={(e) => update(section, index, "teacher_remarks", e.target.value)} disabled={draft.status !== "draft"} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default AssessmentReportsPage;
