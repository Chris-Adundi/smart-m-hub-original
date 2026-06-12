import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* HEADER */}
      <header className="flex items-center justify-between px-6 py-4 bg-white shadow-sm">
        <h1 className="text-xl font-bold cursor-pointer" onClick={() => navigate("/")}>
          Smart M Hub
        </h1>

        <div className="space-x-3">
          <Button variant="outline" onClick={() => navigate("/join-school")}>
            Join School
          </Button>

          <Button onClick={() => navigate("/setup-school")}>
            Create School
          </Button>
        </div>
      </header>

      {/* HERO SECTION */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-5xl w-full grid md:grid-cols-2 gap-10 items-center">

          {/* LEFT */}
          <div>
            <h2 className="text-4xl font-bold mb-4 leading-tight">
              Smart School Management System
            </h2>

            <p className="text-gray-600 mb-6">
              Manage students, staff, exams, fees, attendance, and school operations
              from one centralized platform designed for modern schools.
            </p>

            <div className="flex gap-3 flex-wrap">

              <Button onClick={() => navigate("/login")}>
                Login to System
              </Button>

              <Button
                variant="outline"
                onClick={() => navigate("/join-school")}
              >
                Join School
              </Button>

              <Button
                variant="outline"
                onClick={() => navigate("/setup-school")}
              >
                Create School
              </Button>

            </div>
          </div>

          {/* RIGHT CARD */}
          <Card className="shadow-lg">
            <CardContent className="p-6 space-y-4">

              <h3 className="text-lg font-semibold">Quick Access</h3>

              <Button
                className="w-full"
                onClick={() => navigate("/login")}
              >
                Login (All Roles)
              </Button>

              <Button
                className="w-full"
                variant="outline"
                onClick={() => navigate("/join-school")}
              >
                Join Existing School
              </Button>

              <Button
                className="w-full"
                variant="outline"
                onClick={() => navigate("/setup-school")}
              >
                Create New School
              </Button>

              <Button
                className="w-full"
                variant="ghost"
                onClick={() => navigate("/app/dashboard")}
              >
                Skip to Dashboard (Dev Mode)
              </Button>

            </CardContent>
          </Card>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="text-center py-4 text-sm text-gray-500">
        © {new Date().getFullYear()} Smart M Hub. All rights reserved.
      </footer>

    </div>
  );
}