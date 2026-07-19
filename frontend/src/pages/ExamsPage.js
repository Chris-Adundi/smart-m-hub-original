import { useEffect, useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { apiClient } from "@/App";

import { toast } from "sonner";

import {
  Plus,
  FileText,
  Calendar,
  ClipboardList,
} from "lucide-react";

import jsPDF from "jspdf";
import { ALL_CBC_CLASSES } from "@/utils/schoolClasses";

// ======================
// DEFAULT FORM
// ======================
const defaultForm = {
  name: "",
  class_name: "",
  year_of_study: "",
  term: "Term 1",
  exam_number: "Exam 1",
  academic_year: new Date().getFullYear().toString(),
  exam_date: "",
};

// ======================
// COMPONENT
// ======================
const ExamsPage = () => {
  const [exams, setExams] = useState([]);

  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState(defaultForm);

  // ======================
  // OPTIONS
  // ======================
  const collegeYears = [
    "Year 1",
    "Year 2",
    "Year 3",
    "Year 4",
    "Year 5",
    "Year 6",
  ];

  // ======================
  // UPDATE FORM
  // ======================
  const update = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // ======================
  // FETCH EXAMS
  // ======================
  const fetchExams = async () => {
    try {
      setLoading(true);

      const response = await apiClient.get("/exams");

      const data = response?.data;

      if (Array.isArray(data)) {
        setExams(data);
      } else if (Array.isArray(data?.data)) {
        setExams(data.data);
      } else if (Array.isArray(data?.items)) {
        setExams(data.items);
      } else {
        setExams([]);
      }
    } catch (error) {
      console.error("FETCH EXAMS ERROR:", error);

      toast.error("Failed to fetch exams");

      setExams([]);
    } finally {
      setLoading(false);
    }
  };

  // ======================
  // INITIAL LOAD
  // ======================
  useEffect(() => {
    fetchExams();
  }, []);

  // ======================
  // CREATE EXAM
  // ======================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (submitting) return;

    try {
      setSubmitting(true);

      if (!formData.name?.trim()) {
        toast.error("Exam name is required");
        return;
      }

      if (!formData.exam_date) {
        toast.error("Exam date is required");
        return;
      }

      const payload = {
        ...formData,
        name: formData.name.trim(),
      };

      await apiClient.post("/exams", payload);

      toast.success("Exam created successfully");

      setDialogOpen(false);

      setFormData(defaultForm);

      await fetchExams();
    } catch (error) {
      console.error("CREATE EXAM ERROR:", error);

      toast.error(
        error?.response?.data?.detail ||
          "Failed to create exam"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ======================
  // PDF REPORT
  // ======================
  const generateReport = () => {
    try {
      const doc = new jsPDF();

      doc.setFontSize(18);

      doc.text("Exams Report", 20, 20);

      doc.setFontSize(12);

      let y = 40;

      if (exams.length === 0) {
        doc.text("No exams available", 20, y);
      } else {
        exams.forEach((exam, index) => {
          const line = `
${index + 1}. ${exam?.name || "Unnamed Exam"}
Class: ${exam?.class_name || "-"}
Term: ${exam?.term || "-"}
Date: ${exam?.exam_date || "-"}
          `;

          doc.text(line, 20, y);

          y += 28;

          if (y > 260) {
            doc.addPage();
            y = 20;
          }
        });
      }

      doc.save("exam-report.pdf");

      toast.success("Report generated");
    } catch (error) {
      console.error("PDF ERROR:", error);

      toast.error("Failed to generate report");
    }
  };

  // ======================
  // GROUP EXAMS
  // ======================
  const groupedExams = useMemo(() => {
    return exams.reduce((acc, exam) => {
      const year =
        exam?.academic_year || "Unknown Year";

      const term = exam?.term || "Unknown Term";

      const key = `${year} - ${term}`;

      if (!acc[key]) {
        acc[key] = [];
      }

      acc[key].push(exam);

      return acc;
    }, {});
  }, [exams]);

  // ======================
  // LOADING
  // ======================
  if (loading) {
    return (
      <div className="p-6 text-slate-400">
        Loading exams...
      </div>
    );
  }

  // ======================
  // UI
  // ======================
  return (
    <div className="space-y-6">

      {/* ======================
          HEADER
      ====================== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

        <div>
          <h2 className="text-3xl font-bold text-white">
            Exams
          </h2>

          <p className="text-slate-400">
            Manage assessments and exam records
          </p>
        </div>

        <div className="flex flex-wrap gap-2">

          {/* REPORT */}
          <Button
            onClick={generateReport}
            variant="outline"
          >
            <FileText className="w-4 h-4 mr-2" />
            Generate Report
          </Button>

          {/* CREATE */}
          <Dialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
          >

            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Exam
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">

              <DialogHeader>
                <DialogTitle>
                  Create New Exam
                </DialogTitle>
              </DialogHeader>

              <form
                onSubmit={handleSubmit}
                className="space-y-4"
              >

                {/* EXAM NAME */}
                <div className="space-y-2">
                  <Label htmlFor="exam_name">
                    Exam Name
                  </Label>

                  <Input
                    id="exam_name"
                    placeholder="e.g Mid Term Exam"
                    value={formData.name}
                    onChange={(e) =>
                      update("name", e.target.value)
                    }
                    required
                  />
                </div>

                {/* CLASS + YEAR */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <div className="space-y-2">
                    <Label>
                      Class
                    </Label>

                    <Select
                      value={formData.class_name}
                      onValueChange={(value) =>
                        update("class_name", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>

                      <SelectContent>
                        {ALL_CBC_CLASSES.map((item) => (
                          <SelectItem
                            key={item}
                            value={item}
                          >
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Year of Study
                    </Label>

                    <Select
                      value={formData.year_of_study}
                      onValueChange={(value) =>
                        update("year_of_study", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>

                      <SelectContent>
                        {collegeYears.map((item) => (
                          <SelectItem
                            key={item}
                            value={item}
                          >
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                </div>

                {/* TERM + EXAM */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <div className="space-y-2">
                    <Label>
                      Term
                    </Label>

                    <Select
                      value={formData.term}
                      onValueChange={(value) =>
                        update("term", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="Term 1">
                          Term 1
                        </SelectItem>

                        <SelectItem value="Term 2">
                          Term 2
                        </SelectItem>

                        <SelectItem value="Term 3">
                          Term 3
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Exam Number
                    </Label>

                    <Select
                      value={formData.exam_number}
                      onValueChange={(value) =>
                        update("exam_number", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="Exam 1">
                          Exam 1
                        </SelectItem>

                        <SelectItem value="Exam 2">
                          Exam 2
                        </SelectItem>

                        <SelectItem value="Exam 3">
                          Exam 3
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                </div>

                {/* DATE */}
                <div className="space-y-2">
                  <Label htmlFor="exam_date">
                    Exam Date
                  </Label>

                  <Input
                    id="exam_date"
                    type="date"
                    value={formData.exam_date}
                    onChange={(e) =>
                      update("exam_date", e.target.value)
                    }
                    required
                  />
                </div>

                {/* SAVE */}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitting}
                >
                  {submitting
                    ? "Saving..."
                    : "Save Exam"}
                </Button>

              </form>

            </DialogContent>

          </Dialog>

        </div>
      </div>

      {/* ======================
          EMPTY STATE
      ====================== */}
      {exams.length === 0 && (
        <Card>

          <CardContent className="py-10">

            <div className="flex flex-col items-center justify-center text-center">

              <ClipboardList className="w-12 h-12 text-slate-500 mb-4" />

              <h3 className="text-lg font-semibold text-white">
                No Exams Yet
              </h3>

              <p className="text-slate-400 mt-1">
                Create your first exam to get started
              </p>

            </div>

          </CardContent>

        </Card>
      )}

      {/* ======================
          EXAMS LIST
      ====================== */}
      <div className="space-y-4">

        {Object.entries(groupedExams).map(
          ([groupKey, list]) => (

            <Card key={groupKey}>

              <CardHeader>

                <CardTitle className="flex items-center gap-2">

                  <Calendar className="w-4 h-4" />

                  {groupKey}

                </CardTitle>

              </CardHeader>

              <CardContent className="space-y-3">

                {list.map((exam, index) => (

                  <div
                    key={exam?.id || index}
                    className="border border-slate-700 rounded-lg p-4 bg-slate-900/40"
                  >

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

                      <div>

                        <h4 className="font-semibold text-white">
                          {exam?.name || "Unnamed Exam"}
                        </h4>

                        <p className="text-sm text-slate-400 mt-1">

                          {exam?.class_name || "No Class"}

                          {" • "}

                          {exam?.exam_number || "Exam"}

                        </p>

                      </div>

                      <div className="text-sm text-slate-400">
                        {exam?.exam_date || "No Date"}
                      </div>

                    </div>

                  </div>

                ))}

              </CardContent>

            </Card>

          )
        )}

      </div>

    </div>
  );
};

export default ExamsPage;
