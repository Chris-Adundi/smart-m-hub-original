import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/App";
import { toast } from "sonner";
import { LifeBuoy, Plus } from "lucide-react";

const initialTicket = {
  subject: "",
  message: "",
  priority: "normal",
};

export default function SupportPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [replyText, setReplyText] = useState({});
  const [form, setForm] = useState(initialTicket);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await apiClient.get("/support-tickets");
      setTickets(Array.isArray(res?.data) ? res.data : res?.data?.tickets || []);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to load support tickets");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const createTicket = async (event) => {
    event.preventDefault();
    try {
      await apiClient.post("/support-tickets", form);
      toast.success("Support ticket submitted");
      setOpen(false);
      setForm(initialTicket);
      fetchTickets();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to create ticket");
    }
  };

  const updateTicket = async (ticket, payload) => {
    try {
      await apiClient.patch(`/support-tickets/${ticket.id}`, payload);
      toast.success("Ticket updated");
      setReplyText((prev) => ({ ...prev, [ticket.id]: "" }));
      fetchTickets();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to update ticket");
    }
  };

  const statusClass = (status) => {
    if (status === "closed" || status === "resolved") return "bg-green-500/10 text-green-400";
    return "bg-yellow-500/10 text-yellow-400";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Support</h1>
          <p className="text-slate-400 mt-1">Submit issues to the Smart M Hub platform team and track replies.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Ticket
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Support Ticket</DialogTitle>
            </DialogHeader>
            <form onSubmit={createTicket} className="space-y-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
              </div>
              <Button type="submit" className="w-full">Submit Ticket</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tickets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-slate-400 py-8 text-center">Loading support tickets...</div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <LifeBuoy className="w-16 h-16 mb-4" />
              <p>No support tickets yet</p>
            </div>
          ) : (
            tickets.map((ticket) => (
              <div key={ticket.id} className="border border-[#1E293B] rounded-lg p-4 space-y-3 bg-[#0F172A]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-white font-semibold">{ticket.subject}</h3>
                    <p className="text-slate-400 text-sm whitespace-pre-wrap">{ticket.message}</p>
                  </div>
                  <Badge className={statusClass(ticket.status)}>{ticket.status || "open"}</Badge>
                </div>
                {(ticket.replies || []).map((reply, index) => (
                  <div key={`${ticket.id}-${index}`} className="rounded border border-[#1E293B] p-3">
                    <p className="text-slate-200 text-sm">{reply.message}</p>
                    <p className="text-slate-500 text-xs mt-1">{reply.by} | {reply.created_at}</p>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    placeholder="Reply..."
                    value={replyText[ticket.id] || ""}
                    onChange={(e) => setReplyText({ ...replyText, [ticket.id]: e.target.value })}
                  />
                  <Button variant="outline" onClick={() => updateTicket(ticket, { reply: replyText[ticket.id] })} disabled={!replyText[ticket.id]}>
                    Reply
                  </Button>
                  <Button variant="outline" onClick={() => updateTicket(ticket, { status: "closed" })}>
                    Close
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
