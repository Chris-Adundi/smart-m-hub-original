import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient, authService } from "@/App";
import { toast } from "sonner";
import { Building2, Copy } from "lucide-react";
import { uploadManagedFile } from "@/utils/uploads";

const SchoolProfilePage = () => {
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [inviteLink, setInviteLink] = useState("");
  const [loginLink, setLoginLink] = useState("");
  const [counts, setCounts] = useState({
    students: 0,
    teachers: 0,
    staff: 0
  });

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    school_type: "",
    school_classification: "",
    operation_type: "day",
    school_code: "",
    invite_code: "",
    logo_url: "",
    banner_url: "",
    stamp_url: "",
    motto: "",
    vision: "",
    mission: "",
    principal_name: "",
    principal_email: "",
    principal_phone: "",
    website: "",
    established_year: "",
    school_registration_number: "",
    ministry_registration_number: "",
    kra_pin: "",
    theme_primary: "#10B981",
    theme_secondary: "#0F172A",
    subscription_status: "",
    subscription_expiry: "",
    status: "",
    date_registered: ""
  });

  const [user, setUser] = useState(() => authService.getUser() || {});

  // =========================
  // FETCH SCHOOL PROFILE
  // =========================
  useEffect(() => {
    fetchSchoolProfile();
  }, []);

  const fetchSchoolProfile = async () => {
    try {
      const currentUser = authService.getUser();

      if (!currentUser?.school_id) {
        setLoading(false);
        return;
      }

      const res = await apiClient.get("/school/profile");

      const data = res?.data?.data;

      if (data) {
        setFormData({
          name: data.name || "",
          address: data.address || "",
          phone: data.phone || "",
          email: data.email || "",
          school_type: data.school_type || "",
          school_classification: data.school_classification || "",
          operation_type: data.operation_type || "day",
          school_code: data.school_code || "",
          invite_code: data.invite_code || "",
          logo_url: data.logo || data.logo_url || "",
          banner_url: data.banner_url || "",
          stamp_url: data.stamp_url || "",
          motto: data.motto || "",
          vision: data.vision || "",
          mission: data.mission || "",
          principal_name: data.principal_name || "",
          principal_email: data.principal_email || "",
          principal_phone: data.principal_phone || "",
          website: data.website || "",
          established_year: data.established_year || "",
          school_registration_number: data.school_registration_number || "",
          ministry_registration_number: data.ministry_registration_number || "",
          kra_pin: data.kra_pin || "",
          theme_primary: data.theme?.primary || "#10B981",
          theme_secondary: data.theme?.secondary || "#0F172A",
          subscription_status: data.subscription_status || "",
          subscription_expiry: data.subscription_expiry || "",
          status: data.status || "",
          date_registered: data.date_registered || ""
        });

        setLogoPreview(data.logo || data.logo_url || null);
        setInviteLink(data.invite_link || "");
        setLoginLink(data.login_link || "");
        setCounts(data.counts || { students: 0, teachers: 0, staff: 0 });
      }
    } catch (e) {
      console.error("PROFILE LOAD ERROR:", e?.response?.data || e?.message);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // LOGO UPLOAD
  // =========================
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await uploadManagedFile(file, "school_logo");
      setLogoPreview(url);
      setFormData((prev) => ({
        ...prev,
        logo_url: url
      }));
      toast.success("Logo uploaded");
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || "Logo upload failed");
    }
  };

  const copyText = async (text, label) => {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Failed to copy");
    }
  };

  // =========================
  // SUBMIT (CREATE OR UPDATE)
  // =========================
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (!user?.school_id) {
        throw new Error("Your account is not assigned to a school");
      }

      // =========================
      // UPDATE SCHOOL
      // =========================
      const clean = Object.fromEntries(
        Object.entries(formData || {}).filter(([_, v]) => v !== "")
      );

      await apiClient.patch("/school/profile", clean);

      toast.success("Profile updated");
      setEditing(false);
      fetchSchoolProfile();

    } catch (e) {
      console.error("FULL ERROR:", e?.response?.data || e?.message);

      let errorMessage = "Operation failed";

      const detail = e?.response?.data?.detail;

      if (typeof detail === "string") {
        errorMessage = detail;
      } else if (Array.isArray(detail)) {
        errorMessage = detail.map(err => err?.msg).join(", ");
      } else if (detail) {
        errorMessage = JSON.stringify(detail);
      }

      toast.error(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">School Profile</h1>
          <p className="text-gray-500">Manage your institution</p>
        </div>

        {!editing ? (
          <Button onClick={() => setEditing(true)}>Edit Profile</Button>
        ) : (
          <Button variant="outline" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        )}
      </div>

      {/* ================= VIEW MODE ================= */}
      {!editing && (
        <div className="space-y-6">

          {/* HERO CARD */}
          <Card className="border-2 border-primary/20">
            {formData.banner_url && (
              <img
                src={formData.banner_url}
                alt={`${formData.name} banner`}
                className="w-full h-48 object-cover rounded-t-xl"
              />
            )}
            <CardContent className="p-10 text-center space-y-6">

              {logoPreview ? (
                <img src={logoPreview} className="w-32 h-32 mx-auto rounded-xl object-contain" />
              ) : (
                <Building2 className="w-20 h-20 mx-auto text-primary" />
              )}

              <h1 className="text-4xl font-bold">{formData.name || "School Name"}</h1>
              <p className="italic text-gray-500">"{formData.motto}"</p>

              <span className="px-4 py-1 bg-primary/10 text-primary rounded-full text-sm capitalize">
                {(formData.operation_type || "day").replaceAll("_", " ")} school
              </span>

              <div className="grid md:grid-cols-2 gap-4 text-left">
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">School Code</p>
                  <div className="flex gap-2">
                    <Input value={formData.school_code} readOnly />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => copyText(formData.school_code, "School code")}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">School Login Link</p>
                  <div className="flex gap-2">
                    <Input value={loginLink} readOnly />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => copyText(loginLink, "Login link")}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <p className="text-sm text-gray-500">Invite Link</p>
                  <div className="flex gap-2">
                    <Input value={inviteLink} readOnly />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => copyText(inviteLink, "Invite link")}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* CONTACT GRID */}
          <div className="grid md:grid-cols-3 gap-4">

            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500">Address</p>
                <p className="font-medium">{formData.address || "Not set"}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium">{formData.phone || "Not set"}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{formData.email || "Not set"}</p>
              </CardContent>
            </Card>

          </div>

          {/* VISION & MISSION */}
          <div className="grid md:grid-cols-2 gap-4">

            {formData.vision && (
              <Card className="bg-blue-50 text-slate-900">
                <CardContent className="p-5">
                  <h3 className="font-bold mb-2 text-slate-950">Vision</h3>
                  <p className="text-slate-800">{formData.vision}</p>
                </CardContent>
              </Card>
            )}

            {formData.mission && (
              <Card className="bg-green-50 text-slate-900">
                <CardContent className="p-5">
                  <h3 className="font-bold mb-2 text-slate-950">Mission</h3>
                  <p className="text-slate-800">{formData.mission}</p>
                </CardContent>
              </Card>
            )}

          </div>

        </div>
      )}

      {/* ================= EDIT MODE ================= */}
      {editing && (
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* LOGO */}
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Upload Logo</Label>
                <Input type="file" accept="image/*" onChange={handleLogoUpload} />
              </div>
              <div>
                <Label>Logo URL</Label>
                <Input
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Banner URL</Label>
                <Input
                  value={formData.banner_url}
                  onChange={(e) => setFormData({ ...formData, banner_url: e.target.value })}
                />
              </div>
              <div>
                <Label>Primary Theme Color</Label>
                <Input
                  type="color"
                  value={formData.theme_primary}
                  onChange={(e) => setFormData({ ...formData, theme_primary: e.target.value })}
                />
              </div>
              <div>
                <Label>Secondary Theme Color</Label>
                <Input
                  type="color"
                  value={formData.theme_secondary}
                  onChange={(e) => setFormData({ ...formData, theme_secondary: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* BASIC INFO */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">

              <Input
                placeholder="School Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />

              <Input
                placeholder="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />

              <Input
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />

              <Textarea
                placeholder="Address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />

              <Input
                placeholder="Motto"
                value={formData.motto}
                onChange={(e) => setFormData({ ...formData, motto: e.target.value })}
              />

              <div className="grid md:grid-cols-3 gap-3">
                <select
                  className="h-10 rounded-md border bg-transparent px-3"
                  value={formData.school_type}
                  onChange={(e) => setFormData({ ...formData, school_type: e.target.value })}
                >
                  <option value="">School type</option>
                  <option value="primary">Primary</option>
                  <option value="junior_secondary">Junior Secondary</option>
                  <option value="senior_secondary">Senior Secondary</option>
                  <option value="secondary">Secondary</option>
                  <option value="college">College</option>
                  <option value="university">University</option>
                  <option value="other">Other</option>
                </select>
                <select
                  className="h-10 rounded-md border bg-transparent px-3"
                  value={formData.school_classification}
                  onChange={(e) =>
                    setFormData({ ...formData, school_classification: e.target.value })
                  }
                >
                  <option value="">Classification</option>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                  <option value="international">International</option>
                  <option value="special">Special</option>
                </select>
                <select
                  className="h-10 rounded-md border bg-transparent px-3"
                  value={formData.operation_type}
                  onChange={(e) => setFormData({ ...formData, operation_type: e.target.value })}
                >
                  <option value="day">Day School</option>
                  <option value="boarding">Boarding School</option>
                  <option value="mixed">Mixed Day & Boarding</option>
                </select>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <Textarea
                  placeholder="Mission"
                  value={formData.mission}
                  onChange={(e) => setFormData({ ...formData, mission: e.target.value })}
                />
                <Textarea
                  placeholder="Vision"
                  value={formData.vision}
                  onChange={(e) => setFormData({ ...formData, vision: e.target.value })}
                />
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <Input
                  placeholder="Principal name"
                  value={formData.principal_name}
                  onChange={(e) => setFormData({ ...formData, principal_name: e.target.value })}
                />
                <Input
                  type="email"
                  placeholder="Principal email"
                  value={formData.principal_email}
                  onChange={(e) => setFormData({ ...formData, principal_email: e.target.value })}
                />
                <Input
                  placeholder="Principal phone"
                  value={formData.principal_phone}
                  onChange={(e) => setFormData({ ...formData, principal_phone: e.target.value })}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <Input
                  placeholder="Website"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
                <Input
                  placeholder="Established year"
                  value={formData.established_year}
                  onChange={(e) => setFormData({ ...formData, established_year: e.target.value })}
                />
                <Input
                  placeholder="School registration number"
                  value={formData.school_registration_number}
                  onChange={(e) =>
                    setFormData({ ...formData, school_registration_number: e.target.value })
                  }
                />
                <Input
                  placeholder="Ministry registration number"
                  value={formData.ministry_registration_number}
                  onChange={(e) =>
                    setFormData({ ...formData, ministry_registration_number: e.target.value })
                  }
                />
                <Input
                  placeholder="KRA PIN"
                  value={formData.kra_pin}
                  onChange={(e) => setFormData({ ...formData, kra_pin: e.target.value })}
                />
                <Input
                  placeholder="Stamp URL"
                  value={formData.stamp_url}
                  onChange={(e) => setFormData({ ...formData, stamp_url: e.target.value })}
                />
              </div>

            </CardContent>
          </Card>

          <Button type="submit" className="w-full bg-emerald-600">
            Save Changes
          </Button>

        </form>
      )}

    </div>
  );
};

export default SchoolProfilePage;
