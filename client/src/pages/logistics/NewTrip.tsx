import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export default function NewTrip() {
  const [formData, setFormData] = useState({
    tripNo: "",
    from: "",
    to: "",
    driverName: "",
    vehicle: "",
    estimatedTime: "",
    notes: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string): void => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("New Trip Created:", formData);
    alert("Trip created successfully!");
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Create New Trip</h1>
        <p className="text-muted-foreground mt-2">Register a new shipment and assign vehicle & driver</p>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>Trip Details</CardTitle>
          <CardDescription>Fill in the shipment information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tripNo">Trip Number</Label>
                <Input
                  id="tripNo"
                  name="tripNo"
                  placeholder="TRP-001"
                  value={formData.tripNo}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driverName">Driver Name</Label>
                <Input
                  id="driverName"
                  name="driverName"
                  placeholder="John Doe"
                  value={formData.driverName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="from">Origin Warehouse</Label>
                <Select value={formData.from} onValueChange={(val) => handleSelectChange("from", val)}>
                  <SelectTrigger id="from">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Warehouse A">Warehouse A</SelectItem>
                    <SelectItem value="Warehouse B">Warehouse B</SelectItem>
                    <SelectItem value="Warehouse C">Warehouse C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="to">Destination</Label>
                <Select value={formData.to} onValueChange={(val) => handleSelectChange("to", val)}>
                  <SelectTrigger id="to">
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Customer A">Customer A</SelectItem>
                    <SelectItem value="Customer B">Customer B</SelectItem>
                    <SelectItem value="Customer C">Customer C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vehicle">Vehicle</Label>
                <Select value={formData.vehicle} onValueChange={(val) => handleSelectChange("vehicle", val)}>
                  <SelectTrigger id="vehicle">
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRK-001">TRK-001 (10 Ton)</SelectItem>
                    <SelectItem value="TRK-002">TRK-002 (15 Ton)</SelectItem>
                    <SelectItem value="VAN-001">VAN-001 (5 Ton)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimatedTime">Estimated Time (hours)</Label>
                <Input
                  id="estimatedTime"
                  name="estimatedTime"
                  type="number"
                  placeholder="2.5"
                  value={formData.estimatedTime}
                  onChange={handleChange}
                  step="0.5"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                placeholder="Add any special instructions or notes..."
                value={formData.notes}
                onChange={handleChange}
                rows={4}
                className="w-full px-3 py-2 border rounded-md text-sm border-input bg-background"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline">
                Cancel
              </Button>
              <Button type="submit">Create Trip</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
