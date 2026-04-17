import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient, authService } from "@/App";
import { toast } from "sonner";
import {
  Users, UsersRound, CalendarCheck, CreditCard,
  ClipboardCheck, CheckCircle, XCircle, AlertTriangle
} from "lucide-react";

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState(null);
  const [loading, setLoading] = useState(true);
  const user = authService.getUser();
  const isAdmin = user?.role === "school_admin";

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const statsRes = await apiClient.get("/dashboard/stats");
      setStats(statsRes.data);
      if (isAdmin) {
        const pendingRes = await apiClient.get("/admin/pending");
        setPending(pendingRes.data);
      }
    } catch (error) {
      console.error("Failed to fetch stats", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (itemType, itemId, action) => {
    try {
      await apiClient.patch(`/admin/approve/${itemType}/${itemId}`, { action });
      toast.success(`${itemType} ${action} successfully`);
      fetchData();
    } catch (error) {
      toast.error(`Failed to ${action} ${itemType}`);
    }
  };

  const statCards = [
    { title: "Total Students", value: stats?.total_students || 0, icon: Users, accent: "emerald" },
    { title: "Total Staff", value: stats?.total_staff || 0, icon: UsersRound, accent: "cyan" },
    { title: "Present Today", value: stats?.present_today || 0, icon: CalendarCheck, accent: "violet" },
    { title: "Pending Approvals", value: stats?.pending_approvals || 0, icon: ClipboardCheck, accent: "amber" },
  ];

  const accentMap = {
    emerald: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/20" },
    cyan: { bg: "bg-cyan-500/15", text: "text-cyan-400", border: "border-cyan-500/20" },
    violet: { bg: "bg-violet-500/15", text: "text-violet-400", border: "border-violet-500/20" },
    amber: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/20" },
  };

  if (loading) return <div className="text-center py-12 text-slate-400" data-testid="loading">Loading...</div>;

  return (
    <div className="space-y-8" data-testid="dashboard">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Dashboard Overview</h2>
        <p className="text-slate-400 mt-1 text-sm">Welcome to Smart-M Hub management system</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          const a = accentMap[stat.accent];
          return (
            <div key={i} className={`bg-[#1A2332] border ${a.border} rounded-xl p-5 hover:bg-[#1E2A3A] transition-all`} data-testid={`stat-card-${i}`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-slate-400">{stat.title}</p>
                <div className={`${a.bg} p-2 rounded-lg`}>
                  <Icon className={`w-4 h-4 ${a.text}`} />
                </div>
              </div>
              <p className="text-3xl font-bold text-white">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Admin Approval Queue */}
      {isAdmin && pending && pending.total > 0 && (
        <div className="bg-[#1A2332] border border-amber-500/20 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-semibold text-white">Pending Approvals ({pending.total})</h3>
          </div>
          <Tabs defaultValue={pending.students.length > 0 ? "students" : pending.results.length > 0 ? "results" : "attendance"} className="space-y-4">
            <TabsList className="bg-[#0F1A2A] border border-[#1E293B]">
              {pending.students.length > 0 && <TabsTrigger value="students" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Students ({pending.students.length})</TabsTrigger>}
              {pending.results.length > 0 && <TabsTrigger value="results" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Results ({pending.results.length})</TabsTrigger>}
              {pending.attendance.length > 0 && <TabsTrigger value="attendance" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Attendance ({pending.attendance.length})</TabsTrigger>}
              {pending.payments.length > 0 && <TabsTrigger value="payments" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Payments ({pending.payments.length})</TabsTrigger>}
              {pending.announcements.length > 0 && <TabsTrigger value="announcements" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Announcements ({pending.announcements.length})</TabsTrigger>}
            </TabsList>

            {["students", "results", "attendance", "payments", "announcements"].map(type => {
              const items = pending[type];
              if (!items || items.length === 0) return null;
              return (
                <TabsContent key={type} value={type}>
                  <div className="space-y-3">
                    {items.map(item => (
                      <div key={item.id} className="bg-[#0F1A2A] border border-[#1E293B] p-4 rounded-lg flex items-center justify-between" data-testid={`pending-${type}-item`}>
                        <div>
                          {type === "students" && <p className="font-medium text-white">{item.full_name} <span className="text-slate-500 text-sm">({item.admission_number})</span></p>}
                          {type === "results" && <div className="font-medium text-white">{item.subject} - <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20">{item.grade}</Badge> <span className="text-slate-500 text-sm">{item.marks}pts</span></div>}
                          {type === "attendance" && <p className="font-medium text-white">Status: {item.status} | {item.date}</p>}
                          {type === "payments" && <p className="font-medium text-white">KES {item.amount?.toLocaleString()} - {item.payment_type}</p>}
                          {type === "announcements" && <p className="font-medium text-white">{item.title}</p>}
                          <p className="text-xs text-slate-500 mt-1">By: {item.submitter?.full_name || "Unknown"}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white h-8" data-testid="approve-btn"
                            onClick={() => handleApproval(type.slice(0, -1), item.id, "approved")}>
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8" data-testid="reject-btn"
                            onClick={() => handleApproval(type.slice(0, -1), item.id, "rejected")}>
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      )}

      {isAdmin && pending && pending.total === 0 && (
        <div className="bg-[#1A2332] border border-emerald-500/20 rounded-xl p-6 text-center">
          <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-emerald-400 font-medium">All caught up! No pending approvals.</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
