import { useEffect, useMemo, useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/App";
import { toast } from "sonner";
import { Package, Plus, Search } from "lucide-react";

const initialForm = {
  name: "",
  quantity: 0,
  category: "",
  location: "",
  condition: "good",
  reorder_level: 0,
  notes: "",
};

const InventoryPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const res = await apiClient.get("/inventory");
      setItems(Array.isArray(res?.data) ? res.data : res?.data?.data || []);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to load inventory");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((item) =>
      String(item.name || "").toLowerCase().includes(q) ||
      String(item.category || "").toLowerCase().includes(q) ||
      String(item.location || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const totals = useMemo(() => {
    return {
      items: items.length,
      quantity: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      lowStock: items.filter((item) => Number(item.quantity || 0) <= Number(item.reorder_level || 0)).length,
    };
  }, [items]);

  const openEditor = (item = null) => {
    setEditing(item);
    setForm(item ? { ...initialForm, ...item } : initialForm);
    setDialogOpen(true);
  };

  const saveItem = async (event) => {
    event.preventDefault();
    const payload = {
      ...form,
      quantity: Number(form.quantity || 0),
      reorder_level: Number(form.reorder_level || 0),
    };

    try {
      if (editing?.id) {
        await apiClient.patch(`/inventory/${editing.id}`, payload);
        toast.success("Inventory item updated");
      } else {
        await apiClient.post("/inventory", payload);
        toast.success("Inventory item saved");
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(initialForm);
      fetchInventory();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Failed to save inventory item");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Inventory & Assets</h1>
          <p className="text-slate-400 mt-1">Track stock, assets, locations and item history</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openEditor()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Inventory Item" : "New Inventory Item"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={saveItem} className="space-y-4">
              {[
                ["name", "Item Name"],
                ["category", "Category"],
                ["location", "Location"],
                ["condition", "Condition"],
              ].map(([field, label]) => (
                <div className="space-y-2" key={field}>
                  <Label>{label}</Label>
                  <Input value={form[field] || ""} onChange={(e) => setForm({ ...form, [field]: e.target.value })} required={field === "name"} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Reorder Level</Label>
                  <Input type="number" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <Button type="submit" className="w-full">Save Item</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-5"><p className="text-slate-400 text-sm">Item Types</p><p className="text-2xl font-bold text-white">{totals.items}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-slate-400 text-sm">Total Quantity</p><p className="text-2xl font-bold text-white">{totals.quantity}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-slate-400 text-sm">Low Stock</p><p className="text-2xl font-bold text-white">{totals.lowStock}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Inventory Register</CardTitle>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <Input className="pl-10" placeholder="Search inventory..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-slate-400">Loading inventory...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Package className="w-16 h-16 mb-4" />
              <p className="text-lg font-medium">No inventory items found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const low = Number(item.quantity || 0) <= Number(item.reorder_level || 0);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.category || "-"}</TableCell>
                      <TableCell>{item.location || "-"}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.condition || "-"}</TableCell>
                      <TableCell><Badge className={low ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}>{low ? "Low stock" : "Available"}</Badge></TableCell>
                      <TableCell><Button size="sm" variant="outline" onClick={() => openEditor(item)}>Edit</Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryPage;
