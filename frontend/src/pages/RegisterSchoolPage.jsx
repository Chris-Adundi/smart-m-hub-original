import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { apiClient } from "@/App";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import InstallSmartMHub from "@/components/InstallSmartMHub";
import { toast } from "sonner";

export default function ParentSignUpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialSchoolCode = new URLSearchParams(location.search).get("school") || "";
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    school_code: initialSchoolCode,
    student_access_code: "",
    email: "",
    password: "",
    confirm_password: "",
  });

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (form.password !== form.confirm_password) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiClient.post("/auth/register-parent", {
        school_code: form.school_code.trim().toUpperCase(),
        student_access_code: form.student_access_code.trim().toUpperCase(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        confirm_password: form.confirm_password,
      });
      toast.success(data?.message || "Account created. You can now sign in.");
      navigate(`/login?school=${encodeURIComponent(form.school_code.trim().toUpperCase())}`);
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || "Unable to create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] p-6 text-white">
      <div className="mx-auto grid max-w-5xl gap-6 py-8 lg:grid-cols-[1fr_360px]">
        <Card className="bg-[#1A2332] border-[#1E3A4F]/40">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-emerald-600">
              <GraduationCap className="h-10 w-10 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold text-white">Parent/Guardian Sign Up</CardTitle>
            <CardDescription className="text-slate-400">
              Use the school code and student access code provided by your school administrator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-5">
              <div><Label>School Code</Label><Input required value={form.school_code} onChange={(e) => update("school_code", e.target.value.toUpperCase())} /></div>
              <div><Label>Student Access Code</Label><Input required value={form.student_access_code} onChange={(e) => update("student_access_code", e.target.value.toUpperCase())} placeholder="STU-XXXXXXXX" /></div>
              <div><Label>Parent/Guardian Email</Label><Input required type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div><Label>Password</Label><Input required type="password" value={form.password} onChange={(e) => update("password", e.target.value)} /></div>
                <div><Label>Confirm Password</Label><Input required type="password" value={form.confirm_password} onChange={(e) => update("confirm_password", e.target.value)} /></div>
              </div>
              <p className="text-sm leading-6 text-slate-400">
                Registration succeeds only when this email is already recorded as Guardian 1 or Guardian 2 for the student.
              </p>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating Account..." : "Sign Up"}</Button>
              <div className="text-center text-sm text-slate-300">
                Already registered? <Link className="font-semibold text-emerald-300 hover:text-emerald-200" to={`/login${form.school_code ? `?school=${encodeURIComponent(form.school_code.trim().toUpperCase())}` : ""}`}>Sign In</Link>
              </div>
            </form>
          </CardContent>
        </Card>
        <InstallSmartMHub />
      </div>
    </div>
  );
}
