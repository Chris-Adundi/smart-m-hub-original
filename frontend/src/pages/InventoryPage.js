import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

const InventoryPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Inventory & Assets</h2>
        <p className="text-slate-600 mt-1">Track school property and learning materials</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Inventory Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Package className="w-16 h-16 mb-4" />
            <p className="text-lg font-medium">Inventory Tracking</p>
            <p className="text-sm">Coming soon - Track assets and stock levels</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryPage;
