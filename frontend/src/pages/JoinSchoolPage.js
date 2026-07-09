import { useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";

import { apiClient } from "@/App";

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
import { GraduationCap } from "lucide-react";

const JoinSchoolPage = () => {
  const navigate = useNavigate();
  const { inviteCode } = useParams();
  const location = useLocation();

  const queryCode = new URLSearchParams(location.search).get("code");
  const initialCode = inviteCode || queryCode || "";

  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    invite_code: initialCode,
    full_name: "",
    role: "",
    email: "",
    password: "",
    admission_number: "",
    student_access_code: "",
  });

  const updateField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const requiresAdmissionNumber =
    formData.role === "student" || formData.role === "parent";

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.invite_code.trim())
      return toast.error("Invite code is required");
    if (!formData.full_name.trim())
      return toast.error("Full name is required");
    if (!formData.role)
      return toast.error("Please select a role");
    if (!formData.email.trim())
      return toast.error("Email is required");
    if (!formData.password)
      return toast.error("Password is required");

    if (
      requiresAdmissionNumber &&
      !formData.admission_number.trim() &&
      !formData.student_access_code.trim()
    ) {
      return toast.error("Admission number or student access code is required");
    }

    setLoading(true);

    try {
      const payload = {
        invite_code: formData.invite_code.trim(),
        full_name: formData.full_name.trim(),
        role: formData.role.toLowerCase(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        admission_number:
          formData.admission_number?.trim() || null,
        student_access_code:
          formData.student_access_code?.trim().toUpperCase() || null,
      };

      const response = await apiClient.post(
        "/auth/join-school",
        payload
      );

      toast.success(
        response?.data?.message ||
          "Account created successfully. Awaiting approval."
      );

      navigate("/login");
    } catch (error) {
      toast.error(
        error?.response?.data?.detail ||
          error?.response?.data?.message ||
          error?.message ||
          "Failed to join school"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-6">

      <Card className="w-full max-w-lg bg-[#1A2332] border-[#1E3A4F]/40">

        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-emerald-600 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>

          <div>
            <CardTitle className="text-3xl font-bold text-white">
              Join School
            </CardTitle>

            <CardDescription className="text-slate-400 mt-2">
              Create your account using the school invite code
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">

            <div className="space-y-2">
              <Label>Invite Code</Label>
              <Input
                value={formData.invite_code}
                onChange={(e) =>
                  updateField("invite_code", e.target.value)
                }
                placeholder="Enter school invite code"
              />
            </div>

            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={formData.full_name}
                onChange={(e) =>
                  updateField("full_name", e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Role</Label>

              <Select
                value={formData.role}
                onValueChange={(value) =>
                  updateField("role", value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="secretary">Secretary</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  updateField("email", e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) =>
                  updateField("password", e.target.value)
                }
              />
            </div>

            {requiresAdmissionNumber && (
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Student Access Code</Label>
                  <Input
                    value={formData.student_access_code}
                    onChange={(e) =>
                      updateField(
                        "student_access_code",
                        e.target.value.toUpperCase()
                      )
                    }
                    placeholder="STU-XXXXXXXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Admission Number</Label>
                  <Input
                    value={formData.admission_number}
                    onChange={(e) =>
                      updateField(
                        "admission_number",
                        e.target.value
                      )
                    }
                    placeholder="Alternative to access code"
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading
                ? "Creating Account..."
                : "Join School"}
            </Button>

          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            Your account will be linked to the school after approval.
          </div>
        </CardContent>

      </Card>
    </div>
  );
};

export default JoinSchoolPage;
