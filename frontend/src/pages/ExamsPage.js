import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/App";
import { toast } from "sonner";
import { Plus, FileText, Calendar } from "lucide-react";
import jsPDF from "jspdf";

const ExamsPage = () => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    class_name: "",
    year_of_study: "",
    term: "Term 1",
    exam_number: "Exam 1",
    academic_year: new Date().getFullYear().toString(),
    exam_date: ""
  });

  const kenyaClasses = [
    "PP1", "PP2", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6",
    "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"
  ];

  const collegeYears = ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6"];

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      const response = await apiClient.get("/exams");
      setExams(response.data);
    } catch (error) {
      toast.error("Failed to fetch exams");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post("/exams", formData);
      toast.success("Exam created successfully");
      setDialogOpen(false);
      fetchExams();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create exam");
    }
  };

  const generateReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Smart Hub - Exam Report", 20, 20);
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);
    doc.text(`Academic Year: ${formData.academic_year}`, 20, 40);
    
    let y = 60;
    doc.setFontSize(14);
    doc.text("All Exams", 20, y);
    y += 10;
    
    doc.setFontSize(10);
    exams.forEach((exam, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${index + 1}. ${exam.name}`, 20, y);
      y += 5;
      doc.text(`   Class: ${exam.class_name || exam.year_of_study} | Term: ${exam.term} | Exam: ${exam.exam_number}`, 20, y);
      y += 5;
      doc.text(`   Date: ${new Date(exam.exam_date).toLocaleDateString()}`, 20, y);
      y += 10;
    });
    
    doc.save(`exam-report-${Date.now()}.pdf`);
    toast.success("Report downloaded");
  };

  const groupedExams = exams.reduce((acc, exam) => {
    const key = `${exam.academic_year}-${exam.term}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(exam);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Performance & Assessments</h2>
          <p className="text-slate-400 mt-1">Manage examinations using CBE grading (EE, ME, AE, BE)</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={generateReport}
            data-testid="download-report-btn"
          >
            <FileText className="w-4 h-4 mr-2" />
            Download Report
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="create-exam-btn">
                <Plus className="w-4 h-4 mr-2" />
                Create Exam
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Exam</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Exam Name *</Label>
                  <Input
                    data-testid="exam-name-input"
                    placeholder="Mid-Term Mathematics Exam"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Class (Primary/Secondary)</Label>
                    <Select
                      value={formData.class_name}
                      onValueChange={(value) => setFormData({ ...formData, class_name: value, year_of_study: "" })}
                    >
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
                    <Select
                      value={formData.year_of_study}
                      onValueChange={(value) => setFormData({ ...formData, year_of_study: value, class_name: "" })}
                    >
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
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Term *</Label>
                    <Select
                      value={formData.term}
                      onValueChange={(value) => setFormData({ ...formData, term: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Term 1">Term 1</SelectItem>
                        <SelectItem value="Term 2">Term 2</SelectItem>
                        <SelectItem value="Term 3">Term 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Exam Number *</Label>
                    <Select
                      value={formData.exam_number}
                      onValueChange={(value) => setFormData({ ...formData, exam_number: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Exam 1">Exam 1</SelectItem>
                        <SelectItem value="Exam 2">Exam 2</SelectItem>
                        <SelectItem value="Exam 3">Exam 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Academic Year *</Label>
                    <Input
                      type="number"
                      value={formData.academic_year}
                      onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Exam Date *</Label>
                  <Input
                    type="date"
                    value={formData.exam_date}
                    onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
                    required
                  />
                </div>
                <Button data-testid="submit-exam-btn" type="submit" className="w-full">
                  Create Exam
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Total Exams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{exams.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Current Year</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {exams.filter(e => e.academic_year === new Date().getFullYear().toString()).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Active Terms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {new Set(exams.map(e => e.term)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">Loading...</CardContent>
        </Card>
      ) : Object.keys(groupedExams).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            No exams found. Create your first exam to get started.
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedExams).map(([key, examList]) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                {key.split('-')[1]} - Academic Year {key.split('-')[0]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {examList.map((exam) => (
                  <div
                    key={exam.id}
                    data-testid="exam-card"
                    className="p-4 border border-slate-200 rounded-lg hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg text-slate-900">{exam.name}</h3>
                        <p className="text-sm text-slate-600 mt-1">
                          {exam.class_name || exam.year_of_study} | {exam.exam_number} | 
                          {new Date(exam.exam_date).toLocaleDateString()}
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        View Results
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default ExamsPage;
