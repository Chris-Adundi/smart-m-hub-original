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
  ["Administration", "Keep admissions, staff records, approvals and daily school tasks organized in one place.", Users],
  ["Finance", "Track fees, receipts, balances and payment follow-up with clear student-level records.", CreditCard],
  ["Academics", "Manage attendance, exams, assessments and approved reports without scattered paperwork.", GraduationCap],
  ["Communication", "Share the right notices, updates and student information with the right people securely.", ShieldCheck],
];

const storyboard = [
  "Open with a school administrator reviewing the day from one clear dashboard.",
  "Show admissions, class placement and student records handled smoothly.",
  "Record a fee payment, generate a receipt and send it for approval.",
  "Teacher submits attendance and assessment reports for review.",
  "Parent logs in to view approved notices, fee status, receipts and reports.",
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
              <p className="text-emerald-300 text-sm font-semibold uppercase tracking-wider">Trusted school operations hub</p>
              <h1 className="mt-5 text-5xl md:text-6xl font-bold leading-tight">
                Smart M Hub
              </h1>
              <p className="mt-6 text-lg text-slate-200 max-w-2xl">
                Simplify school administration, academics, finance, communication and student services in one secure, easy-to-use space.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button onClick={() => navigate("/setup-school")} className="gap-2">
                  Register Your School <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => navigate("/login")}>Access Portal</Button>
              </div>
              <div className="mt-10 grid grid-cols-3 gap-4 max-w-2xl">
                {["Secure access", "Clear approvals", "Daily school clarity"].map((item) => (
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
                <h2 className="text-3xl font-bold">See Smart M Hub in Action</h2>
              </div>
              <p className="mt-4 text-slate-300">
                A short walkthrough can help school leaders see how everyday work becomes simpler and better coordinated.
              </p>
              <div className="mt-6 aspect-video rounded-lg border border-dashed border-emerald-400/40 bg-[#070B14] flex flex-col items-center justify-center text-center p-6">
                <Video className="h-12 w-12 text-emerald-300" />
                <p className="mt-4 text-lg font-semibold">Demo video placeholder</p>
                <p className="mt-2 text-sm text-slate-400 max-w-md">
                  Suggested format: 2-3 minutes covering administration, academics, finance, communication and parent access.
                </p>
              </div>
            </div>
            <Card className="bg-[#101827] border-white/10">
              <CardContent className="p-6 space-y-5">
                <div>
                  <h3 className="text-xl font-semibold text-white">Demo Script</h3>
                  <p className="mt-3 text-slate-300">
                    "Smart M Hub helps schools bring administration, academics, finance and communication together. Staff work with clearer records, leaders approve important updates, and parents see only the information meant for their child."
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
              ["Less paperwork", "Admissions, fees, reports and notices stay organized so staff spend less time searching."],
              ["Better parent confidence", "Parents access approved receipts, fee status, announcements and reports for their own child."],
              ["Clearer leadership", "School leaders can review approvals, activity and key records with confidence."],
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
