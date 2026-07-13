import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { apiClient, formatApiError } from "@/App";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { toast } from "sonner";
import { Building2, Check, GraduationCap } from "lucide-react";

const SCHOOL_CODE_PATTERN = /^(SMH-KE-\d{6}|SMH-[A-Z0-9]{8,12})$/;

const roleOptions = [
  { value: "teacher", label: "Teacher" },
  { value: "secretary", label: "Secretary" },
  { value: "finance", label: "Finance Officer" },
  { value: "supporting_staff", label: "Supporting Staff" },
  { value: "parent", label: "Parent/Guardian" },
];

const JoinSchoolPage = () => {
  const navigate = useNavigate();
  const { inviteCode } = useParams();
  const location = useLocation();

  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialSchoolCode = query.get("school") || "";
  const initialInviteCode = inviteCode || query.get("code") || "";

  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [school, setSchool] = useState(null);
  const [classes, setClasses] = useState([]);

  const [formData, setFormData] = useState({
    school_code: initialSchoolCode.toUpperCase(),
    invite_code: initialInviteCode,
    full_name: "",
    email: "",
    phone: "",
    password: "",
    role: "",
    selected_classes: [],
    child_name: "",
    child_admission_number: "",
  });

  const updateField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const normalizedSchoolCode = formData.school_code.trim().toUpperCase();
  const isTeacher = formData.role === "teacher";
  const isParent = formData.role === "parent";

  useEffect(() => {
    const inviteValue = formData.invite_code.trim();

    if (!SCHOOL_CODE_PATTERN.test(normalizedSchoolCode) && !inviteValue) {
      setSchool(null);
      setClasses([]);
      return;
    }

    let active = true;
    const loadSchool = async () => {
      try {
        setResolving(true);
        const response = SCHOOL_CODE_PATTERN.test(normalizedSchoolCode)
          ? await apiClient.get(
              `/public/schools/resolve/${encodeURIComponent(normalizedSchoolCode)}/classes`
            )
          : await apiClient.get(
              `/public/schools/invite/${encodeURIComponent(inviteValue)}/classes`
            );
        if (!active) return;
        const data = response?.data?.data || {};
        setSchool(data.school || null);
        setClasses(Array.isArray(data.classes) ? data.classes : []);
      } catch {
        if (!active) return;
        setSchool(null);
        setClasses([]);
      } finally {
        if (active) setResolving(false);
      }
    };

    loadSchool();
    return () => {
      active = false;
    };
  }, [normalizedSchoolCode, formData.invite_code]);

  const toggleClass = (className) => {
    setFormData((prev) => {
      const current = new Set(prev.selected_classes || []);
      if (current.has(className)) {
        current.delete(className);
      } else {
        current.add(className);
      }
      return {
        ...prev,
        selected_classes: Array.from(current),
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!normalizedSchoolCode && !formData.invite_code.trim()) {
      toast.error("School code or invite link code is required");
      return;
    }
    if (normalizedSchoolCode && !SCHOOL_CODE_PATTERN.test(normalizedSchoolCode)) {
      toast.error("Enter a valid school code, for example SMH-AB12CD34EF");
      return;
    }
    if (!formData.full_name.trim()) return toast.error("Full name is required");
    if (!formData.email.trim()) return toast.error("Email is required");
    if (!formData.phone.trim()) return toast.error("Phone number is required");
    if (!formData.password) return toast.error("Password is required");
    if (!formData.role) return toast.error("Please select a role");
    if (isTeacher && formData.selected_classes.length === 0) {
      return toast.error("Select at least one class");
    }
    if (isParent && (!formData.child_name.trim() || !formData.child_admission_number.trim())) {
      return toast.error("Child name and admission number are required");
    }

    try {
      setLoading(true);
      const response = await apiClient.post("/auth/join-school", {
        school_code: normalizedSchoolCode,
        invite_code: formData.invite_code.trim().toUpperCase(),
        full_name: formData.full_name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        password: formData.password,
        role: formData.role,
        selected_classes: isTeacher ? formData.selected_classes : [],
        child_name: isParent ? formData.child_name.trim() : null,
        child_admission_number: isParent ? formData.child_admission_number.trim() : null,
      });

      toast.success(
        response?.data?.message ||
          "Your request has been submitted and is waiting for school administrator approval."
      );
      navigate(`/login${normalizedSchoolCode ? `?school=${encodeURIComponent(normalizedSchoolCode)}` : ""}`);
    } catch (error) {
      toast.error(formatApiError(error, "Failed to submit join request"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-6">
      <Card className="w-full max-w-3xl bg-[#1A2332] border-[#1E3A4F]/40">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-emerald-600 rounded-xl flex items-center justify-center overflow-hidden">
            {school?.logo_url ? (
              <img src={school.logo_url} alt={`${school.name} logo`} className="w-full h-full object-contain" />
            ) : (
              <GraduationCap className="w-10 h-10 text-white" />
            )}
          </div>
          <div>
            <CardTitle className="text-3xl font-bold text-white">Join School</CardTitle>
            <CardDescription className="text-slate-400 mt-2">
              Submit your account request for an already registered school.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>School Code</Label>
                <Input
                  value={formData.school_code}
                  onChange={(e) => updateField("school_code", e.target.value.toUpperCase())}
                  placeholder="SMH-AB12CD34EF"
                />
                {resolving && <p className="text-xs text-slate-400">Checking school code...</p>}
              </div>

              <div className="space-y-2">
                <Label>School Invite Link Code</Label>
                <Input
                  value={formData.invite_code}
                  onChange={(e) => updateField("invite_code", e.target.value)}
                  placeholder="Optional if you have the school code"
                />
              </div>
            </div>

            {school && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-3">
                <Building2 className="w-5 h-5 text-emerald-300" />
                <div>
                  <p className="text-white font-medium">{school.name}</p>
                  <p className="text-xs text-slate-400">{school.school_code}</p>
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={formData.full_name} onChange={(e) => updateField("full_name", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => updateField("email", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input value={formData.phone} onChange={(e) => updateField("phone", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={formData.password} onChange={(e) => updateField("password", e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={formData.role} onValueChange={(value) => updateField("role", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select requested role" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isTeacher && (
              <div className="space-y-3 rounded-lg border border-white/10 p-4">
                <div>
                  <Label>Responsible Classes</Label>
                  <p className="text-xs text-slate-400 mt-1">Only classes from the selected school are shown.</p>
                </div>
                {classes.length === 0 ? (
                  <p className="text-sm text-amber-300">No classes found for this school code yet.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {classes.map((className) => {
                      const selected = formData.selected_classes.includes(className);
                      return (
                        <button
                          key={className}
                          type="button"
                          onClick={() => toggleClass(className)}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                            selected
                              ? "border-emerald-400 bg-emerald-500/15 text-white"
                              : "border-white/10 bg-[#0F172A] text-slate-300"
                          }`}
                        >
                          <span>{className}</span>
                          {selected && <Check className="w-4 h-4 text-emerald-300" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {isParent && (
              <div className="grid md:grid-cols-2 gap-4 rounded-lg border border-white/10 p-4">
                <div className="space-y-2">
                  <Label>Child Name</Label>
                  <Input value={formData.child_name} onChange={(e) => updateField("child_name", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Child Admission Number</Label>
                  <Input
                    value={formData.child_admission_number}
                    onChange={(e) => updateField("child_admission_number", e.target.value)}
                  />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || resolving}>
              {loading ? "Submitting Request..." : "Submit Join Request"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            Your request has to be approved by the school administrator before login.{" "}
            <Link to="/login" className="text-emerald-300 hover:text-emerald-200">
              Already approved?
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default JoinSchoolPage;
