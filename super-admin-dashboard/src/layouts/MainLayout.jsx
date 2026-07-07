import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

export default function MainLayout() {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#070b14",
        color: "#e5edf8",
      }}
    >
      <Sidebar />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Topbar />

        <div
          style={{
          flex: 1,
          padding: "24px",
          overflowX: "hidden",
        }}
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
}
