import { useEffect, useState } from "react";
import { apiClient, authService } from "@/App";
import { toast } from "sonner";

export default function InviteCodeCard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const res = await apiClient.get("/school/invite");

        setData(res.data);
      } catch (err) {
        console.error("Invite fetch error:", err);
      }
    };

    fetchInvite();
  }, []);

  const copyToClipboard = () => {
    if (!data) return;

    const text = `Invite Code: ${data.invite_code}\nJoin Link: ${data.join_link}`;

    navigator.clipboard.writeText(text);
    toast.success("Invite details copied");
  };

  if (!data) return null;

  return (
    <div className="p-4 bg-[#1A2332] border border-[#1E3A4F] rounded-xl">
      <h3 className="text-white font-semibold mb-2">School Invite</h3>

      <p className="text-slate-300 text-sm">
        <strong>Code:</strong> {data.invite_code}
      </p>

      <p className="text-slate-300 text-sm mt-1 break-all">
        <strong>Link:</strong> {data.join_link}
      </p>

      <button
        onClick={copyToClipboard}
        className="mt-3 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg"
      >
        Copy Invite Info
      </button>
    </div>
  );
}