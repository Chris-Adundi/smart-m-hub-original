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
import { Badge } from "@/components/ui/badge";

import { apiClient } from "@/App";
import { uploadManagedFile } from "@/utils/uploads";
import { resolveMediaUrl } from "@/utils/mediaUrl";
import { toast } from "sonner";
import { Edit, GraduationCap, LockKeyhole, Plus, Search, Trash2, UserCheck, UserX } from "lucide-react";

const emptyForm = {
  full_name: "",
  national_id: "",
  gender: "",
  custom_gender: "",
  phone: "",
  email: "",
  passport_photo_url: "",
  employee_number: "",
  tsc_number: "",
  designation: "",
  custom_designation: "",
  role: "teacher",
  account_status: "active",
  password: "",
  confirm_password: "",
  salary: "",
  joined_date: "",
  selected_classes: [],
};

const roleOptions = [
  { value: "teacher", label: "Teacher" },
  { value: "finance", label: "Finance Officer" },
  { value: "secretary", label: "Secretary" },
  { value: "supporting_staff", label: "Supporting Staff" },
];

const designationOptions = [
  "Teacher",
  "Deputy Principal",
  "Principal",
  "Finance Officer",
  "Secretary",
  "Librarian",
  "Store Keeper",
  "Nurse",
  "Guidance & Counselling",
  "Games Teacher",
  "Laboratory Technician",
  "ICT Officer",
  "Boarding Master/Mistress",
  "Driver",
  "Security Officer",
  "Cook",
  "Cleaner",
  "Other Staff",
];

const statusClass = {
  active: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  suspended: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  inactive: "bg-slate-500/10 text-slate-700 border-slate-500/20",
  deactivated: "bg-red-500/10 text-red-700 border-red-500/20",
};

const staffStatus = (member) => member?.status || (member?.is_active === false ? "deactivated" : "active");
const staffId = (member) => member?.user_id || member?.id;

const StaffPage = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [editingStaff, setEditingStaff] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formData, setFormData] = useState(emptyForm);
  const [resetForm, setResetForm] = useState({ password: "", confirm_password: "" });
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentData, setAssignmentData] = useState({ teachers: [], classes: [] });
  const [assignmentTeacherId, setAssignmentTeacherId] = useState("");
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [classOptions, setClassOptions] = useState([]);

  const fetchClassOptions = async () => {
    const response = await apiClient.get("/admin/teacher-class-assignments");
    const data = response?.data?.data || { teachers: [], classes: [] };
    setClassOptions(Array.isArray(data.classes) ? data.classes : []);
    return data;
  };

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

  const openAssignments = async () => {
    try {
      const data = await fetchClassOptions();
      setAssignmentData(data);
      setAssignmentTeacherId("");
      setAssignedClasses([]);
      setAssignmentOpen(true);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to load teacher assignments");
    }
  };

  const chooseAssignmentTeacher = (teacherId) => {
    setAssignmentTeacherId(teacherId);
    const teacher = assignmentData.teachers.find((item) => item.id === teacherId);
    setAssignedClasses(Array.isArray(teacher?.selected_classes) ? teacher.selected_classes : []);
  };

  const saveAssignments = async () => {
    if (!assignmentTeacherId) return toast.error("Select a teacher");
    try {
      await apiClient.put(`/admin/teachers/${assignmentTeacherId}/classes`, { class_names: assignedClasses });
      toast.success("Teacher class assignments updated");
      setAssignmentOpen(false);
      fetchStaff();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to update class assignments");
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const filteredStaff = useMemo(() => {
    const term = search.trim().toLowerCase();
    return staff.filter((member) => {
      const haystack = [
        member.full_name,
        member.email,
        member.phone,
        member.employee_number,
        member.designation,
      ].join(" ").toLowerCase();
      const matchesSearch = !term || haystack.includes(term);
      const matchesRole = roleFilter === "all" || member.role === roleFilter;
      const matchesStatus = statusFilter === "all" || staffStatus(member) === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [staff, search, roleFilter, statusFilter]);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const openAddDialog = () => {
    setEditingStaff(null);
    setFormData(emptyForm);
    setDialogOpen(true);
    fetchClassOptions().catch(() => toast.error("Failed to load available classes"));
  };

  const openEditDialog = (member) => {
    setEditingStaff(member);
    setFormData({
      ...emptyForm,
      full_name: member.full_name || "",
      national_id: member.national_id || "",
      gender: member.gender || "",
      custom_gender: "",
      phone: member.phone || "",
      email: member.email || "",
      passport_photo_url: member.passport_photo_url || "",
      employee_number: member.employee_number || "",
      tsc_number: member.tsc_number || "",
      designation: member.designation || "",
      custom_designation: "",
      role: member.role || "teacher",
      account_status: staffStatus(member),
      salary: member.salary || "",
      joined_date: member.joined_date ? String(member.joined_date).slice(0, 10) : "",
      password: "",
      confirm_password: "",
      selected_classes: Array.isArray(member.selected_classes) ? member.selected_classes : [],
    });
    setDialogOpen(true);
    fetchClassOptions().catch(() => toast.error("Failed to load available classes"));
  };

  const openProfile = (member) => {
    setSelectedStaff(member);
    setProfileOpen(true);
  };

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    try {
      const url = await uploadManagedFile(file, "document");
      updateField("passport_photo_url", url);
      toast.success("Profile photo uploaded. Save the staff form to apply it.");
    } catch (error) {
      toast.error(error?.message || "Photo upload failed");
    }
  };

  const submitStaff = async (event) => {
    event.preventDefault();
    if (!editingStaff && formData.password !== formData.confirm_password) {
      return toast.error("Passwords do not match");
    }
    try {
      const payload = {
        ...formData,
        gender: formData.gender === "other" ? formData.custom_gender : formData.gender,
        designation: formData.designation === "Other Staff" ? formData.custom_designation : formData.designation,
        salary: formData.salary === "" ? null : Number(formData.salary),
      };
      delete payload.custom_gender;
      delete payload.custom_designation;
      if (editingStaff) {
        if (!payload.password) {
          delete payload.password;
          delete payload.confirm_password;
        }
        await apiClient.put(`/staff/${staffId(editingStaff)}`, payload);
        toast.success("Staff member updated");
      } else {
        await apiClient.post("/staff", payload);
        toast.success("Staff member added successfully");
      }
      setDialogOpen(false);
      setEditingStaff(null);
      setFormData(emptyForm);
      fetchStaff();
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || "Failed to save staff");
    }
  };

  const setStatus = async (member, status) => {
    try {
      await apiClient.patch(`/staff/${staffId(member)}/status`, {
        status,
        reason: status === "active" ? "Activated by school admin" : `${status} by school admin`,
      });
      toast.success(`Staff ${status}`);
      fetchStaff();
    } catch (error) {
      toast.error(error?.response?.data?.detail || `Failed to ${status} staff`);
    }
  };

  const deleteStaff = async (member) => {
    if (!window.confirm(`Delete ${member.full_name}? This disables login and hides the staff record.`)) return;
    try {
      await apiClient.delete(`/staff/${staffId(member)}`);
      toast.success("Staff member deleted");
      fetchStaff();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to delete staff");
    }
  };

  const openReset = (member) => {
    setSelectedStaff(member);
    setResetForm({ password: "", confirm_password: "" });
    setResetOpen(true);
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    if (resetForm.password !== resetForm.confirm_password) return toast.error("Passwords do not match");
    try {
      await apiClient.patch(`/staff/${staffId(selectedStaff)}/reset-password`, resetForm);
      toast.success("Password reset");
      setResetOpen(false);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to reset password");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Staff Management</h2>
          <p className="text-slate-600 mt-1">School-admin controlled staff accounts and access.</p>
        </div>

        <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={openAssignments}>
          <GraduationCap className="w-4 h-4 mr-2" /> Assign Teachers to Classes
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Staff
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingStaff ? "Edit Staff Member" : "Add New Staff Member"}</DialogTitle>
            </DialogHeader>

            <form onSubmit={submitStaff} className="space-y-6">
              <FormSection title="Personal Information">
                <Field label="Full Name" value={formData.full_name} onChange={(value) => updateField("full_name", value)} required />
                <Field label="National ID / Passport" value={formData.national_id} onChange={(value) => updateField("national_id", value)} />
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select value={formData.gender} onValueChange={(value) => {
                    updateField("gender", value);
                    updateField("custom_gender", "");
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.gender === "other" && (
                    <Input
                      placeholder="Type gender"
                      value={formData.custom_gender || ""}
                      onChange={(event) => updateField("custom_gender", event.target.value)}
                    />
                  )}
                </div>
                <Field label="Phone Number" value={formData.phone} onChange={(value) => updateField("phone", value)} required />
                <Field label="Email Address" type="email" value={formData.email} onChange={(value) => updateField("email", value)} required />
                <div className="space-y-2 md:col-span-2">
                  <Label>Passport Photo</Label>
                  <Input type="file" accept="image/*" onChange={(event) => handlePhotoUpload(event.target.files?.[0])} />
                  {formData.passport_photo_url && (
                    <img src={resolveMediaUrl(formData.passport_photo_url)} alt="Staff preview" className="h-20 w-20 rounded-lg object-cover border" />
                  )}
                </div>
              </FormSection>

              <FormSection title="Employment Information">
                <Field label="Employee Number" value={formData.employee_number} onChange={(value) => updateField("employee_number", value)} required />
                <Field label="TSC Number" value={formData.tsc_number} onChange={(value) => updateField("tsc_number", value)} />
                <div className="space-y-2">
                  <Label>Designation</Label>
                  <Select value={formData.designation} onValueChange={(value) => {
                    updateField("designation", value);
                    updateField("custom_designation", "");
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select designation" /></SelectTrigger>
                    <SelectContent>
                      {designationOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {formData.designation === "Other Staff" && (
                    <Input
                      placeholder="Type designation"
                      value={formData.custom_designation || ""}
                      onChange={(event) => updateField("custom_designation", event.target.value)}
                    />
                  )}
                </div>
                <Field label="Employment Date" type="date" value={formData.joined_date} onChange={(value) => updateField("joined_date", value)} />
                <Field label="Salary" type="number" value={formData.salary} onChange={(value) => updateField("salary", value)} />
                {formData.role === "teacher" && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>Classes Assigned to This Teacher</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-lg border p-3">
                      {classOptions.map((className) => (
                        <label key={className} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.selected_classes.includes(className)}
                            onChange={(event) => updateField("selected_classes", event.target.checked
                              ? [...formData.selected_classes, className]
                              : formData.selected_classes.filter((item) => item !== className))}
                          />
                          <span>{className}</span>
                        </label>
                      ))}
                    </div>
                    {classOptions.length === 0 && <p className="text-sm text-slate-500">No classes are currently available.</p>}
                  </div>
                )}
              </FormSection>

              <FormSection title="Authentication & Permissions">
                <div className="space-y-2">
                  <Label>System Role</Label>
                  <Select value={formData.role} onValueChange={(value) => updateField("role", value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.account_status} onValueChange={(value) => updateField("account_status", value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Field label={editingStaff ? "New Password" : "Password"} type="password" value={formData.password} onChange={(value) => updateField("password", value)} required={!editingStaff} />
                <Field label="Confirm Password" type="password" value={formData.confirm_password} onChange={(value) => updateField("confirm_password", value)} required={!editingStaff || !!formData.password} />
              </FormSection>

              <Button type="submit" className="w-full">
                {editingStaff ? "Save Changes" : "Add Staff Member"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search staff..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {roleOptions.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="deactivated">Deactivated</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Staff Members</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-lg border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : filteredStaff.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">No staff members found</TableCell></TableRow>
                ) : filteredStaff.map((member) => {
                  const status = staffStatus(member);
                  return (
                    <TableRow key={staffId(member)}>
                      <TableCell>{member.employee_number}</TableCell>
                      <TableCell className="cursor-pointer" onClick={() => openProfile(member)}>
                        <p className="font-medium">{member.full_name}</p>
                        <p className="text-xs text-slate-500">{member.email}</p>
                      </TableCell>
                      <TableCell>{String(member.role || "").replaceAll("_", " ")}</TableCell>
                      <TableCell>{member.designation || "-"}</TableCell>
                      <TableCell><Badge className={statusClass[status] || statusClass.inactive}>{status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(member)}><Edit className="w-3 h-3 mr-1" />Edit</Button>
                          {status === "active" ? (
                            <Button size="sm" variant="outline" onClick={() => setStatus(member, "suspended")}><UserX className="w-3 h-3 mr-1" />Suspend</Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setStatus(member, "active")}><UserCheck className="w-3 h-3 mr-1" />Activate</Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => openReset(member)}><LockKeyhole className="w-3 h-3 mr-1" />Reset</Button>
                          <Button size="sm" variant="outline" onClick={() => setStatus(member, "deactivated")}>Deactivate</Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteStaff(member)}><Trash2 className="w-3 h-3 mr-1" />Delete</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{selectedStaff?.full_name || "Staff Profile"}</DialogTitle></DialogHeader>
          {selectedStaff && <ProfileGrid member={selectedStaff} />}
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
          <form onSubmit={resetPassword} className="space-y-4">
            <p className="text-sm text-slate-600">Set a new password for {selectedStaff?.full_name}.</p>
            <Field label="New Password" type="password" value={resetForm.password} onChange={(value) => setResetForm((prev) => ({ ...prev, password: value }))} required />
            <Field label="Confirm Password" type="password" value={resetForm.confirm_password} onChange={(value) => setResetForm((prev) => ({ ...prev, confirm_password: value }))} required />
            <Button type="submit" className="w-full">Reset Password</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={assignmentOpen} onOpenChange={setAssignmentOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Assign Teachers to Classes</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Teacher</Label>
              <Select value={assignmentTeacherId} onValueChange={chooseAssignmentTeacher}>
                <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>
                  {assignmentData.teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>{teacher.full_name} ({teacher.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {assignmentTeacherId && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {assignmentData.classes.map((className) => (
                  <label key={className} className="flex items-center gap-2 rounded border p-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assignedClasses.includes(className)}
                      onChange={(event) => setAssignedClasses((current) => event.target.checked
                        ? [...current, className]
                        : current.filter((item) => item !== className))}
                    />
                    <span>{className}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-sm text-slate-500">Clear all selections and save to remove all class assignments.</p>
            <Button className="w-full" onClick={saveAssignments} disabled={!assignmentTeacherId}>Save Assignments</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function FormSection({ title, children }) {
  return (
    <section className="space-y-3">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, type = "text", required = false }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} required={required} />
    </div>
  );
}

function ProfileGrid({ member }) {
  const rows = [
    ["Full Name", member.full_name],
    ["Email", member.email],
    ["Phone", member.phone],
    ["National ID / Passport", member.national_id],
    ["Gender", member.gender],
    ["Role", String(member.role || "").replaceAll("_", " ")],
    ["Designation", member.designation],
    ["Employee Number", member.employee_number],
    ["TSC Number", member.tsc_number],
    ["Joined Date", member.joined_date ? String(member.joined_date).slice(0, 10) : "-"],
    ["Status", staffStatus(member)],
    ["School Code", member.school_code],
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {member.passport_photo_url && (
        <div className="md:col-span-2 flex justify-center">
          <img src={resolveMediaUrl(member.passport_photo_url)} alt={`${member.full_name || "Staff"} profile`} className="h-28 w-28 rounded-xl object-cover border border-slate-200" />
        </div>
      )}
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="font-medium text-slate-900 capitalize break-words">{value || "-"}</p>
        </div>
      ))}
    </div>
  );
}

export default StaffPage;
