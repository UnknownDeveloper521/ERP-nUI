import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useParams } from "wouter";
import { Scale } from "lucide-react";

export default function Weighment() {
  const { id } = useParams();
  const [formData, setFormData] = useState({
    tripId: id || "TRP-001",
    weightBefore: "",
    weightAfter: "",
    notes: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const netWeight = formData.weightBefore && formData.weightAfter 
      ? (parseFloat(formData.weightAfter) - parseFloat(formData.weightBefore)).toFixed(2)
      : "0";
    console.log("Weighment recorded:", { ...formData, netWeight });
    alert(`Weighment recorded! Net weight: ${netWeight} kg`);
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Trip Weighment</h1>
        <p className="text-muted-foreground mt-2">Record incoming and outgoing weight for trip {formData.tripId}</p>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Scale className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle>Weight Recording</CardTitle>
              <CardDescription>Document vehicle weight before and after delivery</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="tripId">Trip ID</Label>
              <Input
                id="tripId"
                value={formData.tripId}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="weightBefore">Weight Before (kg)</Label>
                <Input
                  id="weightBefore"
                  name="weightBefore"
                  type="number"
                  placeholder="0"
                  value={formData.weightBefore}
                  onChange={handleChange}
                  step="0.1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weightAfter">Weight After (kg)</Label>
                <Input
                  id="weightAfter"
                  name="weightAfter"
                  type="number"
                  placeholder="0"
                  value={formData.weightAfter}
                  onChange={handleChange}
                  step="0.1"
                  required
                />
              </div>
            </div>

            {formData.weightBefore && formData.weightAfter && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm font-medium text-green-900">
                  Net Weight: <span className="text-xl font-bold">{(parseFloat(formData.weightAfter) - parseFloat(formData.weightBefore)).toFixed(2)} kg</span>
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <textarea
                id="notes"
                name="notes"
                placeholder="Any observations or issues..."
                value={formData.notes}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md text-sm border-input bg-background"
                rows={4}
              />
            </div>

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline">
                Cancel
              </Button>
              <Button type="submit">Record Weighment</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
