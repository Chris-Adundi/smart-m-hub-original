import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/App";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
    school_classification: "",
    operation_type: "day",
    logo_url: "",
    banner_url: "",
    theme_primary: "#10B981",
    theme_secondary: "#0F172A",
    motto: "",
    vision: "",
    mission: "",
    website: "",
    principal_name: "",
    principal_email: "",
    principal_phone: "",
    school_registration_number: "",
    ministry_registration_number: "",
    kra_pin: "",
    admin_name: "",
    admin_email: "",
    admin_phone: "",
  });

  const [loading, setLoading] = useState(false);
  const [registrationSummary, setRegistrationSummary] = useState(null);
  const [registered, setRegistered] = useState(false);

  const updateField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.school_type) {
      toast.error("Please select school type");
      return;
    }

    if (!formData.school_classification) {
      toast.error("Please select school classification");
      return;
    }

    if (!formData.operation_type) {
      toast.error("Please select school operation type");
      return;
    }

    if (!formData.admin_email) {
      toast.error("Admin email is required");
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

      setRegistrationSummary({
        schoolName: data.school_name || formData.name,
        invoiceNumber: data.installation_invoice?.invoice_number || "",
        installationFee: data.installation_invoice?.amount || 5000,
        approvalStatus: data.approval_status || "pending",
        paymentStatus: data.payment_status || "pending",
      });
      setRegistered(true);

      toast.success("School registered. Installation payment and approval are required before login.");
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
                  School Registered Successfully - Pending Approval
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-emerald-500/20 bg-slate-950/40 p-3">
                    <div className="text-slate-300">School</div>
                    <div className="text-white font-medium">{registrationSummary?.schoolName}</div>
                  </div>
                  <div className="rounded-lg border border-emerald-500/20 bg-slate-950/40 p-3">
                    <div className="text-slate-300">Installation Invoice</div>
                    <div className="text-white font-medium">{registrationSummary?.invoiceNumber || "Generated"}</div>
                  </div>
                  <div className="rounded-lg border border-emerald-500/20 bg-slate-950/40 p-3">
                    <div className="text-slate-300">Installation Fee</div>
                    <div className="text-white font-medium">KES {Number(registrationSummary?.installationFee || 5000).toLocaleString()}</div>
                  </div>
                  <div className="rounded-lg border border-emerald-500/20 bg-slate-950/40 p-3">
                    <div className="text-slate-300">Current Status</div>
                    <div className="text-white font-medium capitalize">
                      Payment {registrationSummary?.paymentStatus} | Approval {registrationSummary?.approvalStatus}
                    </div>
                  </div>
                </div>

                <div className="text-sm mt-2 text-slate-300">
                  School code, login link, username and temporary password will be available inside the School Admin Dashboard after payment and platform approval.
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>School Classification</Label>
                  <Select
                    value={formData.school_classification}
                    onValueChange={(value) =>
                      updateField("school_classification", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select classification" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="international">International</SelectItem>
                      <SelectItem value="special">Special School</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Operation Type</Label>
                  <Select
                    value={formData.operation_type}
                    onValueChange={(value) =>
                      updateField("operation_type", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select operation type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Day School</SelectItem>
                      <SelectItem value="boarding">Boarding School</SelectItem>
                      <SelectItem value="mixed">Mixed Day & Boarding</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>School Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label>School Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <Label>Physical Address</Label>
                <Textarea
                  value={formData.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Logo URL</Label>
                  <Input
                    type="url"
                    value={formData.logo_url}
                    onChange={(e) => updateField("logo_url", e.target.value)}
                  />
                </div>

                <div>
                  <Label>Banner URL</Label>
                  <Input
                    type="url"
                    value={formData.banner_url}
                    onChange={(e) => updateField("banner_url", e.target.value)}
                  />
                </div>

                <div>
                  <Label>Primary Theme Color</Label>
                  <Input
                    type="color"
                    value={formData.theme_primary}
                    onChange={(e) => updateField("theme_primary", e.target.value)}
                  />
                </div>

                <div>
                  <Label>Secondary Theme Color</Label>
                  <Input
                    type="color"
                    value={formData.theme_secondary}
                    onChange={(e) => updateField("theme_secondary", e.target.value)}
                  />
                </div>

                <div>
                  <Label>School Motto</Label>
                  <Input
                    value={formData.motto}
                    onChange={(e) => updateField("motto", e.target.value)}
                  />
                </div>

                <div>
                  <Label>Website</Label>
                  <Input
                    value={formData.website}
                    onChange={(e) => updateField("website", e.target.value)}
                  />
                </div>

                <div>
                  <Label>School Registration Number</Label>
                  <Input
                    value={formData.school_registration_number}
                    onChange={(e) =>
                      updateField("school_registration_number", e.target.value)
                    }
                  />
                </div>

                <div>
                  <Label>Ministry Registration Number</Label>
                  <Input
                    value={formData.ministry_registration_number}
                    onChange={(e) =>
                      updateField("ministry_registration_number", e.target.value)
                    }
                  />
                </div>

                <div>
                  <Label>KRA PIN</Label>
                  <Input
                    value={formData.kra_pin}
                    onChange={(e) => updateField("kra_pin", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Principal Name</Label>
                  <Input
                    value={formData.principal_name}
                    onChange={(e) => updateField("principal_name", e.target.value)}
                  />
                </div>

                <div>
                  <Label>Principal Email</Label>
                  <Input
                    type="email"
                    value={formData.principal_email}
                    onChange={(e) => updateField("principal_email", e.target.value)}
                  />
                </div>

                <div>
                  <Label>Principal Phone</Label>
                  <Input
                    value={formData.principal_phone}
                    onChange={(e) => updateField("principal_phone", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Vision</Label>
                  <Textarea
                    value={formData.vision}
                    onChange={(e) => updateField("vision", e.target.value)}
                  />
                </div>

                <div>
                  <Label>Mission</Label>
                  <Textarea
                    value={formData.mission}
                    onChange={(e) => updateField("mission", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-white">
                School Admin Account
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Admin Full Name</Label>
                  <Input
                    value={formData.admin_name}
                    onChange={(e) => updateField("admin_name", e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label>Admin Email</Label>
                  <Input
                    type="email"
                    value={formData.admin_email}
                    onChange={(e) => updateField("admin_email", e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label>Admin Phone</Label>
                  <Input
                    value={formData.admin_phone}
                    onChange={(e) => updateField("admin_phone", e.target.value)}
                  />
                </div>

                <div>
                  <Label>Temporary Password</Label>
                  <Input value="Generated automatically after submission" readOnly />
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
