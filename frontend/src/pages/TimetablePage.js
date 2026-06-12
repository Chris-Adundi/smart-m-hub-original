import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon } from "lucide-react";

const TimetablePage = () => {
  // future-safe placeholder state (prevents later uncontrolled upgrades issues)
  const timetableData = useMemo(() => [], []);

  const hasData = useMemo(() => {
    return Array.isArray(timetableData) && timetableData.length > 0;
  }, [timetableData]);

  return (
    <div className="space-y-6">

      <div>
        <h2 className="text-3xl font-bold text-slate-900">Timetable</h2>
        <p className="text-slate-600 mt-1">
          Manage class schedules and teacher allocation
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Timetable</CardTitle>
        </CardHeader>

        <CardContent>

          {/* SAFE EMPTY STATE */}
          {!hasData ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <CalendarIcon className="w-16 h-16 mb-4" />
              <p className="text-lg font-medium">Timetable Management</p>
              <p className="text-sm">
                Coming soon - Schedule classes and allocate teachers
              </p>
            </div>
          ) : (
            <div>
              {/* Future timetable table goes here */}
              <p className="text-slate-700">Timetable loaded</p>
            </div>
          )}

        </CardContent>
      </Card>

    </div>
  );
};

export default TimetablePage;