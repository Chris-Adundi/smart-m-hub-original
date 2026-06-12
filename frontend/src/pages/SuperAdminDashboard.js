import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/App";
import { toast } from "sonner";
import {
  Building2,
  CheckCircle,
  XCircle,
  DollarSign,
} from "lucide-react";

const SuperAdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, schoolsRes] = await Promise.all([
        apiClient.get("/dashboard/stats"),
        apiClient.get("/schools"),
      ]);

      setStats(statsRes?.data || {});
      setSchools(Array.isArray(schoolsRes?.data) ? schoolsRes.data : []);
    } catch {
      toast.error("Failed to fetch data");
      setStats({});
      setSchools([]);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Schools",
      value: stats?.total_schools ?? 0,
      icon: Building2,
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
    {
      title: "Active Schools",
      value: stats?.active_schools ?? 0,
      icon: CheckCircle,
      color: "text-green-600",
      bg: "bg-green-100",
    },
    {
      title: "Suspended Schools",
      value: stats?.suspended_schools ?? 0,
      icon: XCircle,
      color: "text-red-600",
      bg: "bg-red-100",
    },
    {
      title: "Total Revenue",
      value: `KES ${stats?.total_revenue ?? 0}`,
      icon: DollarSign,
      color: "text-purple-600",
      bg: "bg-purple-100",
    },
  ];

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  const safeSchools = Array.isArray(schools) ? schools : [];

  return (
    <div className="space-y-8">

      {/* HEADER */}
      <div>
        <h2 className="text-3xl font-bold text-slate-900">
          Super Admin Dashboard
        </h2>
        <p className="text-slate-600 mt-2">
          System-wide overview and school management
        </p>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;

          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-600">
                  {stat.title}
                </CardTitle>

                <div className={`${stat.bg} p-2 rounded-lg`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </CardHeader>

              <CardContent>
                <div className="text-3xl font-bold text-slate-900">
                  {stat.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* TABLE */}
      <Card>
        <CardHeader>
          <CardTitle>All Schools</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="overflow-auto rounded-lg border border-slate-200">

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Active Users</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Installation Paid</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {safeSchools.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-slate-500"
                    >
                      No schools registered yet
                    </TableCell>
                  </TableRow>
                ) : (
                  safeSchools.map((school) => (
                    <TableRow key={school?.id}>
                      <TableCell className="font-medium">
                        {school?.name || "-"}
                      </TableCell>

                      <TableCell>
                        {school?.school_type || "-"}
                      </TableCell>

                      <TableCell>
                        {school?.email || "-"}
                      </TableCell>

                      <TableCell>
                        {school?.active_users_count ?? 0}
                      </TableCell>

                      <TableCell>
                        <Badge
                          className={
                            school?.subscription_status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }
                        >
                          {school?.subscription_status || "unknown"}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        {school?.installation_fee_paid ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>

            </Table>

          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default SuperAdminDashboard;