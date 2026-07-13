import { useEffect, useState } from "react";
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
import { Plus } from "lucide-react";

const initialForm = {
  full_name: "",
  email: "",
  phone: "",
  employee_number: "",
  department: "",
  position: "",
  role: "teacher",
  password: "",
  salary: "",
  joined_date: "",
};

const StaffPage = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);

  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      setLoading(true);

      const response = await apiClient.get("/staff");

      const staffData = response?.data?.data;

      setStaff(Array.isArray(staffData) ? staffData : []);
    } catch (error) {
      toast.error("Failed to fetch staff");
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await apiClient.post("/staff", formData);

      toast.success("Staff member added successfully");

      setDialogOpen(false);
      setFormData(initialForm);

      fetchStaff();
    } catch (error) {
      toast.error(
        error?.response?.data?.detail || "Failed to add staff"
      );
    }
  };

  const deactivateUser = async (member) => {
    const userId = member?.user_id || member?.id;
    if (!userId) return toast.error("User ID missing");
    try {
      await apiClient.patch(`/admin/users/${userId}/deactivate`, {
        reason: "Former user",
      });
      toast.success("User deactivated");
      fetchStaff();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to deactivate user");
    }
  };

  const safeStaff = Array.isArray(staff) ? staff : [];

  const openProfile = (member) => {
    setSelectedStaff(member);
    setProfileOpen(true);
  };

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">
            Staff Management
          </h2>
          <p className="text-slate-600 mt-1">
            Manage staff members and roles
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Staff
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Staff Member</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* NAME + EMP NO */}
              <div className="grid grid-cols-2 gap-4">

                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    value={formData.full_name}
                    onChange={(e) =>
                      updateField("full_name", e.target.value)
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employee_number">
                    Employee Number
                  </Label>
                  <Input
                    id="employee_number"
                    name="employee_number"
                    value={formData.employee_number}
                    onChange={(e) =>
                      updateField("employee_number", e.target.value)
                    }
                    required
                  />
                </div>

              </div>

              {/* EMAIL + PHONE */}
              <div className="grid grid-cols-2 gap-4">

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      updateField("email", e.target.value)
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      updateField("phone", e.target.value)
                    }
                    required
                  />
                </div>

              </div>

              {/* DEPT + POSITION */}
              <div className="grid grid-cols-2 gap-4">

                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    name="department"
                    value={formData.department}
                    onChange={(e) =>
                      updateField("department", e.target.value)
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="position">Position</Label>
                  <Input
                    id="position"
                    name="position"
                    value={formData.position}
                    onChange={(e) =>
                      updateField("position", e.target.value)
                    }
                    required
                  />
                </div>

              </div>

              {/* ROLE + DATE */}
              <div className="grid grid-cols-2 gap-4">

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) =>
                      updateField("role", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="finance">
                        Finance Officer
                      </SelectItem>
                      <SelectItem value="secretary">
                        Secretary
                      </SelectItem>
                      <SelectItem value="supporting_staff">
                        Supporting Staff
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="joined_date">Joined Date</Label>
                  <Input
                    id="joined_date"
                    name="joined_date"
                    type="date"
                    value={formData.joined_date}
                    onChange={(e) =>
                      updateField("joined_date", e.target.value)
                    }
                    required
                  />
                </div>

              </div>

              {/* PASSWORD */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    updateField("password", e.target.value)
                  }
                  required
                />
              </div>

              <Button type="submit" className="w-full">
                Add Staff Member
              </Button>

            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* TABLE */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Members</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="overflow-auto rounded-lg border border-slate-200">

            <Table>

              <TableHeader>
                <TableRow>
                  <TableHead>Employee No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>

                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>

                ) : safeStaff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      No staff members found
                    </TableCell>
                  </TableRow>

                ) : (
                  safeStaff.map((member) => (
                    <TableRow
                      key={member.id || member._id}
                      className="cursor-pointer"
                      onClick={() => openProfile(member)}
                    >
                      <TableCell>{member.employee_number}</TableCell>
                      <TableCell>
                        {member.full_name || member.user?.full_name}
                      </TableCell>
                      <TableCell>{member.department}</TableCell>
                      <TableCell>{member.position}</TableCell>
                      <TableCell>
                        {member.phone || member.user?.phone}
                      </TableCell>
                      <TableCell>{member.status || (member.is_active === false ? "deactivated" : "active")}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={member.is_active === false}
                          onClick={(event) => {
                            event.stopPropagation();
                            deactivateUser(member);
                          }}
                        >
                          Deactivate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}

              </TableBody>

            </Table>

          </div>
        </CardContent>
      </Card>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedStaff?.full_name || "Staff Profile"}</DialogTitle>
          </DialogHeader>
          {selectedStaff && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                ["Full Name", selectedStaff.full_name],
                ["Email", selectedStaff.email],
                ["Phone", selectedStaff.phone],
                ["Role", String(selectedStaff.role || "").replaceAll("_", " ")],
                ["Employee Number", selectedStaff.employee_number],
                ["Department", selectedStaff.department],
                ["Position", selectedStaff.position],
                ["Joined Date", selectedStaff.joined_date ? new Date(selectedStaff.joined_date).toLocaleDateString() : "-"],
                ["Status", selectedStaff.status || (selectedStaff.is_active === false ? "deactivated" : "active")],
                ["Approval", selectedStaff.approval_status],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="font-medium text-slate-900 capitalize">{value || "-"}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default StaffPage;
