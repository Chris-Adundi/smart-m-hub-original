import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  ShieldCheck,
  Users,
  Video,
} from "lucide-react";

const features = [
  ["Admissions", "Complete admission records with guardians, class assignment, documents and private access codes.", Users],
  ["Finance", "Student-based fee tracking, receipts, balances, approval workflows and payment history.", CreditCard],
  ["Academics", "Teacher attendance, exam uploads, assessment reports and controlled student portal publication.", GraduationCap],
  ["Platform Control", "Super admin oversight for schools, approvals, support, analytics and diagnostics.", ShieldCheck],
];

const storyboard = [
  "Open with a school admin registering a school and receiving approval.",
  "Show the secretary admitting a student and issuing the private access code.",
  "Record fees, generate a receipt and route it to admin approval.",
  "Teacher uploads an assessment report and attendance for approval.",
  "Parent logs in to view announcements, fee status, receipts and downloadable reports.",
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#070B14] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#070B14]/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <button className="flex items-center gap-3" onClick={() => navigate("/")}>
            <span className="h-10 w-10 rounded-lg bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-emerald-300" />
            </span>
            <span className="font-semibold tracking-wide">Smart M Hub</span>
          </button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/login")}>Login</Button>
            <Button onClick={() => navigate("/setup-school")}>Register School</Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="absolute inset-0 opacity-40 bg-[url('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1800&q=80')] bg-cover bg-center" />
          <div className="absolute inset-0 bg-[#070B14]/75" />
          <div className="relative mx-auto max-w-7xl px-6 min-h-[78vh] flex items-center">
            <div className="max-w-3xl py-20">
              <p className="text-emerald-300 text-sm font-semibold uppercase tracking-wider">Commercial school management platform</p>
              <h1 className="mt-5 text-5xl md:text-6xl font-bold leading-tight">
                Smart M Hub
              </h1>
              <p className="mt-6 text-lg text-slate-200 max-w-2xl">
                A secure, tenant-isolated platform for school operations, finance, academics, approvals, parent portals and platform-wide supervision.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button onClick={() => navigate("/setup-school")} className="gap-2">
                  Start School Registration <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => navigate("/login")}>Access Portal</Button>
              </div>
              <div className="mt-10 grid grid-cols-3 gap-4 max-w-2xl">
                {["Tenant isolated", "Approval driven", "Production focused"].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-slate-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid md:grid-cols-4 gap-4">
            {features.map(([title, text, Icon]) => (
              <Card key={title} className="bg-[#101827] border-white/10">
                <CardContent className="p-5">
                  <Icon className="h-6 w-6 text-emerald-300" />
                  <h2 className="mt-4 font-semibold text-white">{title}</h2>
                  <p className="mt-2 text-sm text-slate-400">{text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#0B1220]">
          <div className="mx-auto max-w-7xl px-6 py-16 grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-start">
            <div>
              <div className="flex items-center gap-3">
                <Video className="h-6 w-6 text-emerald-300" />
                <h2 className="text-3xl font-bold">Client Demo Video</h2>
              </div>
              <p className="mt-4 text-slate-300">
                Placeholder for the Smart M Hub product walkthrough. Upload the finished demo video here when ready.
              </p>
              <div className="mt-6 aspect-video rounded-lg border border-dashed border-emerald-400/40 bg-[#070B14] flex flex-col items-center justify-center text-center p-6">
                <Video className="h-12 w-12 text-emerald-300" />
                <p className="mt-4 text-lg font-semibold">Demo video upload area</p>
                <p className="mt-2 text-sm text-slate-400 max-w-md">
                  Suggested format: 2-3 minute MP4 covering registration, approvals, finance, teacher workflows and parent portal access.
                </p>
              </div>
            </div>
            <Card className="bg-[#101827] border-white/10">
              <CardContent className="p-6 space-y-5">
                <div>
                  <h3 className="text-xl font-semibold text-white">Short Marketing Script</h3>
                  <p className="mt-3 text-slate-300">
                    "Smart M Hub gives schools one secure command center for administration, finance, academics and parent communication. From admission to receipts, assessments and approvals, every workflow is organized, auditable and protected by role-based access."
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Storyboard</h3>
                  <ol className="mt-3 space-y-3 text-sm text-slate-300">
                    {storyboard.map((step, index) => (
                      <li key={step} className="flex gap-3">
                        <span className="text-emerald-300 font-semibold">{index + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid md:grid-cols-3 gap-4">
            {[
              ["Operational clarity", "Every dashboard widget, approval and record links to meaningful school workflows."],
              ["Private parent access", "Student portals reveal only the correct child's approved announcements, receipts, fee status and reports."],
              ["Platform supervision", "Super admin analytics, health checks, diagnostics and support keep commercial operations visible."],
            ].map(([title, text]) => (
              <div key={title} className="rounded-lg border border-white/10 bg-[#101827] p-5">
                <BarChart3 className="h-5 w-5 text-emerald-300" />
                <h2 className="mt-4 font-semibold">{title}</h2>
                <p className="mt-2 text-sm text-slate-400">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-6 text-center text-sm text-slate-500">
        &copy; {new Date().getFullYear()} Smart M Hub. All rights reserved.
      </footer>
    </div>
  );
}
