import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient, authService } from "@/App";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

const SchoolProfilePage = () => {
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [inviteLink, setInviteLink] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    school_type: "",
    logo_url: "",
    motto: "",
    vision: "",
    mission: "",
    principal_name: "",
    website: "",
    established_year: ""
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
          logo_url: data.logo || "",
          motto: data.motto || "",
          vision: data.vision || "",
          mission: data.mission || "",
          principal_name: data.principal_name || "",
          website: data.website || "",
          established_year: data.established_year || ""
        });

        setLogoPreview(data.logo || null);
        setInviteLink(data.invite_link || "");
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
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result);
      setFormData((prev) => ({
        ...prev,
        logo_url: reader.result
      }));
    };
    reader.readAsDataURL(file);
  };

  // =========================
  // SUBMIT (CREATE OR UPDATE)
  // =========================
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        ...formData,
        email: formData.email || user?.email || "admin@test.com",
        admin_name: user?.full_name || "Admin",
        admin_email: user?.email || formData.email || "admin@test.com",
        admin_password: "12345678",
        admin_phone: user?.phone || formData.phone || ""
      };

      // =========================
      // CREATE SCHOOL
      // =========================
      if (!user?.school_id) {
        const res = await apiClient.post("/auth/register-school", payload);
        toast.success("School created successfully");

        const schoolId = res?.data?.school_id;
        const token = res?.data?.token || authService.getToken();

        if (!token) {
          toast.error("Authentication expired. Please login again.");
          window.location.href = "/login";
          return;
        }

        const updatedUser = {
          ...user,
          school_id: schoolId
        };

        authService.setAuth(token, updatedUser);

        window.location.href = "/app/dashboard";
        return;
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
            <CardContent className="p-10 text-center space-y-6">

              {logoPreview ? (
                <img src={logoPreview} className="w-32 h-32 mx-auto rounded-xl object-contain" />
              ) : (
                <Building2 className="w-20 h-20 mx-auto text-primary" />
              )}

              <h1 className="text-4xl font-bold">{formData.name || "School Name"}</h1>
              <p className="italic text-gray-500">"{formData.motto}"</p>

              <span className="px-4 py-1 bg-primary/10 text-primary rounded-full text-sm capitalize">
                {formData.school_type || "Institution"}
              </span>

              {/* INVITE LINK */}
              {inviteLink && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-gray-500">Invite Link</p>

                  <Input value={inviteLink} readOnly />

                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(inviteLink);
                      toast.success("Invite link copied");
                    }}
                  >
                    Copy Invite Link
                  </Button>
                </div>
              )}

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
              <Card className="bg-blue-50">
                <CardContent className="p-5">
                  <h3 className="font-bold mb-2">Vision</h3>
                  <p>{formData.vision}</p>
                </CardContent>
              </Card>
            )}

            {formData.mission && (
              <Card className="bg-green-50">
                <CardContent className="p-5">
                  <h3 className="font-bold mb-2">Mission</h3>
                  <p>{formData.mission}</p>
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
              <CardTitle>Logo</CardTitle>
            </CardHeader>
            <CardContent>
              <Input type="file" onChange={handleLogoUpload} />
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