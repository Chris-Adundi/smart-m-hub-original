import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { authService, API } from "@/App";
import axios from "axios";
import { GraduationCap, Building2, BookOpen, CreditCard, Users, FileText, ArrowLeft, Eye, EyeOff } from "lucide-react";

const roles = [
  { key: "school_admin", label: "School Admin", desc: "Full school management access", icon: Building2 },
  { key: "teacher", label: "Teacher", desc: "Academics, attendance & results", icon: BookOpen },
  { key: "finance", label: "Finance / Accounts", desc: "Fee collection & financial records", icon: CreditCard },
  { key: "secretary", label: "Secretary", desc: "Student records & announcements", icon: FileText },
  { key: "student", label: "Student / Parent", desc: "View records, fees & results", icon: Users },
];

const LoginPage = () => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState(null);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/login`, formData);
      authService.setAuth(response.data.token, response.data.user);
      toast.success("Login successful!");
      navigate("/");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-600/20">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white" data-testid="app-title">Smart-M Hub</h1>
          <p className="text-slate-400 mt-2">
            {selectedRole ? `Logging in as ${roles.find(r => r.key === selectedRole)?.label}` : "Select how you want to sign in"}
          </p>
        </div>

        {!selectedRole ? (
          /* Role Selection */
          <div className="space-y-3" data-testid="role-selection">
            {roles.map(role => {
              const Icon = role.icon;
              return (
                <button
                  key={role.key}
                  data-testid={`role-${role.key}`}
                  onClick={() => setSelectedRole(role.key)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-[#1A2332] border border-[#1E3A4F]/40 hover:border-emerald-500/40 hover:bg-[#1E2A3A] transition-all group"
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-600/15 flex items-center justify-center group-hover:bg-emerald-600/25 transition-colors">
                    <Icon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-medium">{role.label}</p>
                    <p className="text-slate-500 text-sm">{role.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* Login Form */
          <div className="bg-[#1A2332] border border-[#1E3A4F]/40 rounded-2xl p-8" data-testid="login-form">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-slate-300">Email</Label>
                <Input
                  data-testid="login-email-input"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-[#0F1A2A] border-[#1E3A4F] text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Password</Label>
                <div className="relative">
                  <Input
                    data-testid="login-password-input"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="bg-[#0F1A2A] border-[#1E3A4F] text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20 pr-10"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    data-testid="toggle-password-btn">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button
                data-testid="login-submit-btn"
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-medium h-11 shadow-lg shadow-emerald-600/20"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
            <div className="mt-5 text-center space-y-2">
              <button
                onClick={() => setSelectedRole(null)}
                className="text-slate-400 hover:text-slate-300 text-sm flex items-center justify-center gap-1 mx-auto"
                data-testid="back-to-roles-btn"
              >
                <ArrowLeft className="w-3 h-3" /> Back to role selection
              </button>
              <p className="text-sm text-slate-500">
                Don't have an account?{" "}
                <Link to="/register" className="text-emerald-400 hover:text-emerald-300 font-medium" data-testid="register-link">
                  Register here
                </Link>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
