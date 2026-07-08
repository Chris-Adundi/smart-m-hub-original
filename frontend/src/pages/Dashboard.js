import {
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { apiClient, authService } from "@/App";

import { toast } from "sonner";

import {
  AlertTriangle,
  Loader2,
  Users,
  UsersRound,
  CalendarCheck,
  ClipboardCheck,
  GraduationCap,
  CreditCard,
  Copy,
  Building2,
} from "lucide-react";

// =========================
// ROLE NORMALIZER
// =========================

const normalizeRole = (role) => {
  if (!role) return "";

  const r = String(role)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  const map = {
    admin: "school_admin",
    schooladmin: "school_admin",
    school_admin: "school_admin",

    superadmin: "super_admin",
    super_admin: "super_admin",

    teacher: "teacher",

    finance: "finance",
    accountant: "finance",
    accounts: "finance",

    secretary: "secretary",

    student: "student",
    parent: "parent",
  };

  return map[r] || r;
};

// =========================
// DEFAULT STATS
// =========================

const defaultStats = {
  total_students: 0,
  total_staff: 0,
  present_today: 0,
  pending_approvals: 0,
  total_fees_collected: 0,
  total_classes: 0,
};

// =========================
// DEFAULT PENDING
// =========================

const defaultPending = {
  pending_users: [],
  results: [],
  attendance: [],
  payments: [],
  announcements: [],
  inventory: [],
  totals: {
    all_pending_operations: 0,
  },
};

// =========================
// COMPONENT
// =========================

const Dashboard = () => {
  const [stats, setStats] =
    useState(defaultStats);

  const [pending, setPending] =
    useState(defaultPending);

  const [loading, setLoading] =
    useState(true);

  const [approvalLoading, setApprovalLoading] =
    useState(false);
  const [schoolIdentity, setSchoolIdentity] = useState(null);
  const [globalAnnouncements, setGlobalAnnouncements] = useState([]);

  // =========================
// SAFE USER
// =========================

const user = useMemo(() => {
  const rawUser = authService.getUser();

  if (!rawUser) return null;

  return {
    ...rawUser,
    role: normalizeRole(rawUser.role),
  };
}, []);

const role = normalizeRole(user?.role);

  // =========================
// ROLE FLAGS
// =========================

const isSchoolAdmin = role === "school_admin";

const isAdmin = [
  "school_admin",
  "super_admin",
].includes(role);

const isTeacher = role === "teacher";

const isFinance = role === "finance";

const isSecretary = role === "secretary";

const isStudent =
  role === "student" || role === "parent";

  useEffect(() => {
    if (!isSchoolAdmin) return;

    apiClient
      .get("/school/profile")
      .then((response) => setSchoolIdentity(response?.data?.data || null))
      .catch(() => setSchoolIdentity(null));
  }, [isSchoolAdmin]);

  const copyIdentity = async (value, label) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}`);
    }
  };
  // =========================
  // FETCH DASHBOARD DATA
  // =========================

  const fetchDashboardData =
    useCallback(async () => {
      try {
        setLoading(true);

        // =========================
        // DASHBOARD STATS
        // =========================

        try {
          const statsRes =
            await apiClient.get(
              "/dashboard/stats"
            );

          setStats({
            ...defaultStats,
            ...(statsRes?.data || {}),
          });
        } catch (err) {
          console.error(
            "Stats error:",
            err
          );

          setStats(defaultStats);
        }

        try {
          const announcementsRes = await apiClient.get("/platform-announcements");
          const data = announcementsRes?.data;
          setGlobalAnnouncements(Array.isArray(data) ? data : data?.announcements || []);
        } catch {
          setGlobalAnnouncements([]);
        }

        // =========================
        // ADMIN PENDING DATA
        // =========================

        if (isAdmin) {
          try {
            const res =
              await apiClient.get(
                "/admin/pending"
              );

            const data =
              res?.data || {};

            const nested =
              data?.data || {};

            const nestedUsers =
              nested?.users || {};

            const nestedOps =
              nested?.operations || {};

            setPending({
              pending_users:
                data.pending_users ||
                nestedUsers.pending ||
                [],

              results:
                data.results ||
                nestedOps.results ||
                [],

              attendance:
                data.attendance ||
                nestedOps.attendance ||
                [],

              payments:
                data.payments ||
                nestedOps.payments ||
                [],

              announcements:
                data.announcements ||
                nestedOps.announcements ||
                [],

              inventory:
                data.inventory ||
                nestedOps.inventory ||
                [],

              totals:
                data.totals ||
                nested.totals || {
                  all_pending_operations: 0,
                },
            });
          } catch (err) {
            console.error(
              "Pending error:",
              err
            );

            setPending(defaultPending);
          }
        } else {
          // IMPORTANT:
          // NON ADMINS SHOULD NEVER LOAD ADMIN DATA

          setPending(defaultPending);
        }
      } catch (error) {
        console.error(
          "Dashboard error:",
          error
        );

        toast.error(
          "Failed to load dashboard"
        );
      } finally {
        setLoading(false);
      }
    }, [isAdmin]);

  // =========================
  // INITIAL LOAD
  // =========================

 useEffect(() => {
  if (!user) return;

  fetchDashboardData();
}, [fetchDashboardData, user]);
  // =========================
  // AUTO REFRESH
  // =========================

 useEffect(() => {
  if (!user) return;

  const interval = setInterval(() => {
    fetchDashboardData();
  }, 60000);

  return () => clearInterval(interval);
}, [fetchDashboardData, user]);
  // =========================
  // APPROVAL HANDLER
  // =========================

  const handleApproval = async (
    itemType,
    item,
    action
  ) => {
    const itemId =
      item?._id || item?.id;

    if (!itemId) {
      toast.error("Invalid item ID");
      return;
    }

    try {
      setApprovalLoading(true);

      await apiClient.patch(
        `/admin/approve/${itemType}/${itemId}`,
        { action }
      );

      toast.success(
        `${itemType} ${action} successfully`
      );

      await fetchDashboardData();
    } catch (error) {
      console.error(error);

      toast.error(
        error?.response?.data?.detail ||
          "Action failed"
      );
    } finally {
      setApprovalLoading(false);
    }
  };

  // =========================
  // LOADING
  // =========================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>

    );
  }

  // =========================
  // TABS CONFIG
  // =========================

  const tabs = [
    {
      key: "pending_users",
      label: "Users",
      items: pending.pending_users,
      itemType: "user",
    },

    {
      key: "results",
      label: "Results",
      items: pending.results,
      itemType: "result",
    },

    {
      key: "attendance",
      label: "Attendance",
      items: pending.attendance,
      itemType: "attendance",
    },

    {
      key: "payments",
      label: "Payments",
      items: pending.payments,
      itemType: "payment",
    },

    {
      key: "announcements",
      label: "Announcements",
      items: pending.announcements,
      itemType: "announcement",
    },

    {
      key: "inventory",
      label: "Inventory",
      items: pending.inventory,
      itemType: "inventory",
    },
  ];

  const firstTab =
    tabs.find(
      (t) => t.items?.length > 0
    )?.key || "pending_users";

  // =========================
  // ROLE BASED CARDS
  // =========================

  const statCards = [
    {
      title: "Students",
      value:
        stats?.total_students || 0,
      icon: Users,
      show:
        isAdmin ||
        isTeacher ||
        isSecretary,
    },

    {
      title: "Staff",
      value:
        stats?.total_staff || 0,
      icon: UsersRound,
      show: isAdmin,
    },

    {
      title: "Attendance",
      value:
        stats?.present_today || 0,
      icon: CalendarCheck,
      show:
        isAdmin ||
        isTeacher ||
        isSecretary,
    },

    {
      title: "Pending",
      value:
        pending?.totals
          ?.all_pending_operations ||
        0,
      icon: ClipboardCheck,
      show: isAdmin,
    },

    {
      title: "Fees",
      value:
        stats?.total_fees_collected ||
        0,
      icon: CreditCard,
      show:
        isFinance || isSchoolAdmin,
    },

    {
      title: "Classes",
      value:
        stats?.total_classes || 0,
      icon: GraduationCap,
      show:
        isTeacher ||
        isStudent ||
        isSchoolAdmin,
    },
  ];

  return (
    <div className="space-y-8">

      {/* HEADER */}
      <div>

        <h1 className="text-3xl font-bold text-white">
          Dashboard Overview
        </h1>

        <p className="text-slate-400 mt-1">
          Welcome back{" "}
          {user?.full_name || "User"}
        </p>

      </div>

      {globalAnnouncements.length > 0 && (
        <div className="space-y-3">
          {globalAnnouncements.map((announcement) => (
            <Card key={announcement.id} className="border-amber-500/30 bg-amber-500/10">
              <CardContent className="p-4">
                <p className="text-amber-200 font-semibold">{announcement.title || "Platform Announcement"}</p>
                <p className="text-amber-100/90 text-sm mt-1">{announcement.message}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isSchoolAdmin && schoolIdentity && (
        <Card
          className="border-white/10 overflow-hidden"
          style={{
            borderColor: `${schoolIdentity?.theme?.primary || "#10B981"}55`,
          }}
        >
          <CardContent className="p-5 grid lg:grid-cols-[auto_1fr_1fr] gap-5 items-center">
            <div className="flex items-center gap-3">
              {schoolIdentity.logo_url || schoolIdentity.logo ? (
                <img
                  src={schoolIdentity.logo_url || schoolIdentity.logo}
                  alt={`${schoolIdentity.name} logo`}
                  className="w-14 h-14 object-contain rounded-xl bg-white/10"
                />
              ) : (
                <Building2 className="w-12 h-12 text-slate-400" />
              )}
              <div>
                <p className="font-semibold text-white">{schoolIdentity.name}</p>
                <p className="text-xs text-slate-400 capitalize">
                  {(schoolIdentity.operation_type || "day").replaceAll("_", " ")} school
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-1">School Code</p>
              <div className="flex gap-2">
                <Input value={schoolIdentity.school_code || ""} readOnly />
                <Button
                  variant="outline"
                  onClick={() => copyIdentity(schoolIdentity.school_code, "School code")}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {schoolIdentity.generated_credentials?.username && (
              <div>
                <p className="text-xs text-slate-400 mb-1">Admin Username</p>
                <div className="flex gap-2">
                  <Input value={schoolIdentity.generated_credentials.username || ""} readOnly />
                  <Button
                    variant="outline"
                    onClick={() => copyIdentity(schoolIdentity.generated_credentials.username, "Admin username")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-slate-400 mb-1">School Login Link</p>
              <div className="flex gap-2">
                <Input value={schoolIdentity.login_link || ""} readOnly />
                <Button
                  variant="outline"
                  onClick={() => copyIdentity(schoolIdentity.login_link, "Login link")}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {schoolIdentity.generated_credentials?.temporary_password && (
              <div>
                <p className="text-xs text-slate-400 mb-1">Temporary Password</p>
                <div className="flex gap-2">
                  <Input value={schoolIdentity.generated_credentials.temporary_password || ""} readOnly />
                  <Button
                    variant="outline"
                    onClick={() => copyIdentity(schoolIdentity.generated_credentials.temporary_password, "Temporary password")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ROLE CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

        {statCards
          .filter((card) => card.show)
          .map((card) => {
            const Icon = card.icon;

            return (
              <Card
                key={card.title}
                className="bg-[#1A2332] border-[#1E293B]"
              >

                <CardContent className="p-5">

                  <div className="flex items-center justify-between">

                    <div>

                      <p className="text-slate-400 text-sm">
                        {card.title}
                      </p>

                      <h3 className="text-2xl font-bold text-white mt-2">
                        {card.value}
                      </h3>

                    </div>

                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-emerald-400" />
                    </div>

                  </div>

                </CardContent>

              </Card>
            );
          })}

      </div>

      {/* STUDENT MESSAGE */}
      {isStudent && (
        <Card className="bg-[#1A2332] border-[#1E293B]">

          <CardContent className="p-6">

            <h2 className="text-xl font-semibold text-white">
              Student Portal
            </h2>

            <p className="text-slate-400 mt-2">
              Access your academic records,
              fees, timetable, results and
              announcements from the sidebar.
            </p>

          </CardContent>

        </Card>
      )}

      {/* FINANCE MESSAGE */}
      {isFinance && (
        <Card className="bg-[#1A2332] border-[#1E293B]">

          <CardContent className="p-6">

            <h2 className="text-xl font-semibold text-white">
              Finance Dashboard
            </h2>

            <p className="text-slate-400 mt-2">
              Manage fee payments, balances,
              receipts and financial reports.
            </p>

          </CardContent>

        </Card>
      )}

      {/* TEACHER MESSAGE */}
      {isTeacher && (
        <Card className="bg-[#1A2332] border-[#1E293B]">

          <CardContent className="p-6">

            <h2 className="text-xl font-semibold text-white">
              Teacher Workspace
            </h2>

            <p className="text-slate-400 mt-2">
              Manage attendance, exams,
              results and classroom records.
            </p>

          </CardContent>

        </Card>
      )}

      {/* ADMIN APPROVALS */}
      {isAdmin && (
        <Card className="bg-[#1A2332] border-[#1E293B]">

          <CardContent className="p-6">

            <div className="flex items-center gap-3 mb-6">

              <AlertTriangle className="w-5 h-5 text-amber-400" />

              <div>

                <h2 className="text-lg font-semibold text-white">
                  Pending Approvals
                </h2>

                <p className="text-sm text-slate-400">
                  {
                    pending?.totals
                      ?.all_pending_operations
                  }{" "}
                  total items
                </p>

              </div>

            </div>

            {pending?.totals
              ?.all_pending_operations ===
            0 ? (
              <div className="text-center py-10 text-emerald-400">
                No pending approvals
              </div>
            ) : (
              <Tabs defaultValue={firstTab}>

                <TabsList className="bg-[#0F172A] flex flex-wrap gap-2">

                  {tabs.map((tab) =>
                    tab.items?.length ? (
                      <TabsTrigger
                        key={tab.key}
                        value={tab.key}
                      >
                        {tab.label} (
                        {tab.items.length})
                      </TabsTrigger>
                    ) : null
                  )}

                </TabsList>

                {tabs.map((tab) =>
                  tab.items?.length ? (
                    <TabsContent
                      key={tab.key}
                      value={tab.key}
                    >

                      <div className="space-y-3 mt-4">

                        {tab.items.map(
                          (
                            item,
                            index
                          ) => (
                            <div
                              key={
                                item._id ||
                                item.id ||
                                index
                              }
                              className="p-4 bg-[#0F172A] rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                            >

                              <div>

                                <p className="text-white font-semibold">
                                  {item.full_name ||
                                    item.title ||
                                    item.subject ||
                                    "Item"}
                                </p>

                                <p className="text-xs text-slate-400 mt-1">
                                  Submitted by{" "}
                                  {item
                                    ?.submitter
                                    ?.full_name ||
                                    "Unknown"}
                                </p>

                              </div>

                              <div className="flex gap-2">

                                <Button
                                  disabled={
                                    approvalLoading
                                  }
                                  onClick={() =>
                                    handleApproval(
                                      tab.itemType,
                                      item,
                                      "approved"
                                    )
                                  }
                                >
                                  Approve
                                </Button>

                                <Button
                                  disabled={
                                    approvalLoading
                                  }
                                  variant="destructive"
                                  onClick={() =>
                                    handleApproval(
                                      tab.itemType,
                                      item,
                                      "rejected"
                                    )
                                  }
                                >
                                  Reject
                                </Button>

                              </div>

                            </div>
                          )
                        )}

                      </div>

                    </TabsContent>
                  ) : null
                )}

              </Tabs>
            )}

          </CardContent>

        </Card>
      )}

    </div>
  );
};

export default Dashboard;
