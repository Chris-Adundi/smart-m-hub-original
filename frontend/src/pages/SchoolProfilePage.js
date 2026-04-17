import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient, authService } from "@/App";
import { toast } from "sonner";
import { Building2, Upload, Save, Image as ImageIcon } from "lucide-react";

const SchoolProfilePage = () => {
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
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
  
  const user = authService.getUser();

  useEffect(() => {
    fetchSchoolProfile();
  }, []);

  const fetchSchoolProfile = async () => {
    try {
      if (user?.school_id) {
        const response = await apiClient.get(`/schools/${user.school_id}`);
        setSchool(response.data);
        setFormData({
          name: response.data.name || "",
          address: response.data.address || "",
          phone: response.data.phone || "",
          email: response.data.email || "",
          school_type: response.data.school_type || "",
          logo_url: response.data.logo_url || "",
          motto: response.data.motto || "",
          vision: response.data.vision || "",
          mission: response.data.mission || "",
          principal_name: response.data.principal_name || "",
          website: response.data.website || "",
          established_year: response.data.established_year || ""
        });
        if (response.data.logo_url) {
          setLogoPreview(response.data.logo_url);
        }
      }
    } catch (error) {
      toast.error("Failed to fetch school profile");
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Logo size should be less than 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
        setFormData({ ...formData, logo_url: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.patch(`/schools/${user.school_id}`, formData);
      toast.success("School profile updated successfully");
      setEditing(false);
      fetchSchoolProfile();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update profile");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">School Profile</h2>
          <p className="text-slate-600 mt-1">Manage your institution's information</p>
        </div>
        {!editing ? (
          <Button onClick={() => setEditing(true)} data-testid="edit-profile-btn">
            Edit Profile
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => {
              setEditing(false);
              fetchSchoolProfile();
            }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} data-testid="save-profile-btn">
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        )}
      </div>

      {/* Cover Page View */}
      {!editing && (
        <Card className="border-2 border-primary/20">
          <CardContent className="p-12">
            <div className="max-w-4xl mx-auto text-center space-y-8">
              {/* Logo */}
              <div className="flex justify-center">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="School Logo"
                    className="w-40 h-40 object-contain rounded-xl shadow-lg"
                  />
                ) : (
                  <div className="w-40 h-40 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Building2 className="w-20 h-20 text-primary" />
                  </div>
                )}
              </div>

              {/* School Name */}
              <div>
                <h1 className="text-5xl font-bold text-slate-900 mb-2">{formData.name || "School Name"}</h1>
                {formData.motto && (
                  <p className="text-xl text-slate-600 italic">"{formData.motto}"</p>
                )}
              </div>

              {/* School Type Badge */}
              <div className="flex justify-center">
                <span className="px-6 py-2 bg-primary/10 text-primary rounded-full font-medium text-sm capitalize">
                  {formData.school_type?.replace('_', ' ') || "Educational Institution"}
                </span>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-slate-200">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Address</p>
                  <p className="text-slate-900 font-medium">{formData.address || "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Phone</p>
                  <p className="text-slate-900 font-medium">{formData.phone || "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Email</p>
                  <p className="text-slate-900 font-medium">{formData.email || "Not set"}</p>
                </div>
              </div>

              {/* Vision & Mission */}
              {(formData.vision || formData.mission) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8">
                  {formData.vision && (
                    <div className="text-left p-6 bg-blue-50 rounded-lg">
                      <h3 className="text-lg font-semibold text-slate-900 mb-3">Our Vision</h3>
                      <p className="text-slate-700">{formData.vision}</p>
                    </div>
                  )}
                  {formData.mission && (
                    <div className="text-left p-6 bg-green-50 rounded-lg">
                      <h3 className="text-lg font-semibold text-slate-900 mb-3">Our Mission</h3>
                      <p className="text-slate-700">{formData.mission}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Additional Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-slate-200">
                {formData.principal_name && (
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Principal</p>
                    <p className="text-slate-900 font-medium">{formData.principal_name}</p>
                  </div>
                )}
                {formData.established_year && (
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Established</p>
                    <p className="text-slate-900 font-medium">{formData.established_year}</p>
                  </div>
                )}
                {formData.website && (
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Website</p>
                    <a href={formData.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                      {formData.website}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Form */}
      {editing && (
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Logo Upload */}
            <Card>
              <CardHeader>
                <CardTitle>School Logo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="flex-shrink-0">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo Preview"
                        className="w-32 h-32 object-contain rounded-lg border-2 border-slate-200"
                      />
                    ) : (
                      <div className="w-32 h-32 bg-slate-100 rounded-lg flex items-center justify-center">
                        <ImageIcon className="w-12 h-12 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="logo-upload" className="cursor-pointer">
                      <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 hover:border-primary transition-colors">
                        <div className="flex items-center justify-center gap-3">
                          <Upload className="w-6 h-6 text-slate-400" />
                          <div>
                            <p className="font-medium text-slate-700">Click to upload logo</p>
                            <p className="text-sm text-slate-500">PNG, JPG up to 5MB</p>
                          </div>
                        </div>
                      </div>
                    </Label>
                    <Input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>School Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>School Type *</Label>
                    <Select
                      value={formData.school_type}
                      onValueChange={(value) => setFormData({ ...formData, school_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="primary">Primary School</SelectItem>
                        <SelectItem value="junior_secondary">Junior Secondary</SelectItem>
                        <SelectItem value="senior_secondary">Senior Secondary</SelectItem>
                        <SelectItem value="college">College</SelectItem>
                        <SelectItem value="university">University</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Motto</Label>
                  <Input
                    value={formData.motto}
                    onChange={(e) => setFormData({ ...formData, motto: e.target.value })}
                    placeholder="Your school's motto"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address *</Label>
                  <Textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone *</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Vision & Mission */}
            <Card>
              <CardHeader>
                <CardTitle>Vision & Mission</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Vision Statement</Label>
                  <Textarea
                    value={formData.vision}
                    onChange={(e) => setFormData({ ...formData, vision: e.target.value })}
                    placeholder="What you aspire to achieve..."
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mission Statement</Label>
                  <Textarea
                    value={formData.mission}
                    onChange={(e) => setFormData({ ...formData, mission: e.target.value })}
                    placeholder="Your purpose and approach..."
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Additional Details */}
            <Card>
              <CardHeader>
                <CardTitle>Additional Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Principal Name</Label>
                    <Input
                      value={formData.principal_name}
                      onChange={(e) => setFormData({ ...formData, principal_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Established Year</Label>
                    <Input
                      type="number"
                      value={formData.established_year}
                      onChange={(e) => setFormData({ ...formData, established_year: e.target.value })}
                      placeholder="e.g., 1995"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://yourschool.com"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      )}
    </div>
  );
};

export default SchoolProfilePage;
