import { Card, CardContent } from "@/components/ui/card";

const STATUSES = ["draft", "submitted", "approved", "published", "archived"];

export default function CbcReportSummaryCards({ summary = {} }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {STATUSES.map((item) => (
        <Card key={item}>
          <CardContent className="p-4">
            <p className="text-xs text-slate-400 capitalize">{item}</p>
            <p className="text-2xl font-semibold text-white">{summary[item] || 0}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
