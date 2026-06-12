import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  GraduationCap,
  AlertCircle,
  Copy,
  CheckCircle,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

const RegisterPage = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    school_type: "",
    admin_name: "",
    admin_email: "",
    admin_phone: "",
    admin_password: "",
  });

  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [joinLink, setJoinLink] = useState("");
  const [registered, setRegistered] = useState(false);

  const updateField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied successfully");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.school_type) {
      toast.error("Please select school type");
      return;
    }

    if (!formData.admin_email || !formData.admin_password) {
      toast.error("Admin email and password are required");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...formData,
        email: formData.email?.trim().toLowerCase(),
        admin_email: formData.admin_email?.trim().toLowerCase(),
      };

      const response = await apiClient.post(
        "/auth/register-school",
        payload
      );

      const data = response?.data || {};

      const code =
        data.invite_code ||
        data.school_invite_code ||
        "";

      const slug = (formData.name || "school")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      const link =
        data.invite_link ||
        `${window.location.origin}/join/${slug}?code=${code}`;

      setInviteCode(code);
      setJoinLink(link);
      setRegistered(true);

      toast.success("School registered successfully");
    } catch (error) {
      toast.error(
        error?.response?.data?.detail ||
          error?.message ||
          "Registration failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl bg-[#1A2332] border-[#1E3A4F]/40">

        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>

          <CardTitle className="text-3xl font-bold text-white">
            School Administrator Registration
          </CardTitle>

          <CardDescription className="text-slate-400 mt-2">
            Only school administrators can create a school account
          </CardDescription>
        </CardHeader>

        <CardContent>

          {registered && (
            <Alert className="mb-6 border-emerald-500/20 bg-emerald-500/10">
              <CheckCircle className="h-4 w-4 text-emerald-400" />

              <AlertDescription className="text-emerald-200 space-y-4">

                <div className="font-semibold text-lg">
                  School Registered Successfully
                </div>

                <div>
                  <div className="text-sm mb-1 text-slate-300">
                    School Invite Code
                  </div>

                  <Input
                    value={inviteCode}
                    readOnly
                    className="bg-slate-900 text-white"
                  />

                  <Button
                    type="button"
                    onClick={() => copyToClipboard(inviteCode)}
                    className="mt-2"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>

                <div>
                  <div className="text-sm mb-1 text-slate-300">
                    School Join Link
                  </div>

                  <Input
                    value={joinLink}
                    readOnly
                    className="bg-slate-900 text-white"
                  />

                  <Button
                    type="button"
                    onClick={() => copyToClipboard(joinLink)}
                    className="mt-2"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>

                <Button
                  className="w-full mt-4"
                  onClick={() => navigate("/login")}
                >
                  Continue To Login
                </Button>

              </AlertDescription>
            </Alert>
          )}

          <Alert className="mb-6 border-emerald-500/20 bg-emerald-500/10">
            <AlertCircle className="h-4 w-4 text-emerald-400" />

            <AlertDescription className="text-emerald-300">
              Installation Fee: KES 5,000 | Monthly: KES 2,000 per school
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-6">

            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-white">
                School Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div>
                  <Label>School Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label>School Type</Label>

                  <Select
                    value={formData.school_type}
                    onValueChange={(value) =>
                      updateField("school_type", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select school type" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="primary">Primary</SelectItem>
                      <SelectItem value="junior_secondary">Junior Secondary</SelectItem>
                      <SelectItem value="senior_secondary">Senior Secondary</SelectItem>
                      <SelectItem value="college">College</SelectItem>
                      <SelectItem value="university">University</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Registering..." : "Register School"}
            </Button>

          </form>

        </CardContent>
      </Card>
    </div>
  );
};

export default RegisterPage;