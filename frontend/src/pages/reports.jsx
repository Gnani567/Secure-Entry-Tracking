import { useState } from "react";
import { format } from "date-fns";
import { Download, FileBarChart2, Filter } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchReport } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

function downloadCSV(logs) {
  const headers = [
    "Date", "Visitor Name", "Phone", "Department", "Purpose",
    "Gate", "Host", "Entry Time", "Exit Time", "Pass No.", "Status",
  ];
  const rows = logs.map((l) => [
    l.visitDate,
    l.visitorName ?? "",
    l.phoneNumber ?? "",
    l.department ?? "",
    l.purposeOfVisit,
    l.gateNumber ?? "",
    l.hostName ?? "",
    l.entryTime ? format(new Date(l.entryTime), "dd MMM yyyy HH:mm") : "",
    l.exitTime ? format(new Date(l.exitTime), "dd MMM yyyy HH:mm") : "",
    l.passNumber ?? "",
    l.status,
  ]);
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `uvesms-report-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [gate, setGate] = useState("");
  const [department, setDepartment] = useState("");
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Access restricted to administrators only.
      </div>
    );
  }

  const handleGenerate = async () => {
    setIsLoading(true);
    setSubmitted(true);
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (gate) params.gate = gate;
    if (department) params.department = department;
    try {
      const result = await fetchReport(params);
      setData(result);
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to generate report", description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setStartDate(""); setEndDate(""); setGate(""); setDepartment("");
    setData(null); setSubmitted(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Generate Reports</h1>
        <p className="text-muted-foreground mt-1">Filter and export visitor activity reports.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Gate Number</Label>
              <Input placeholder="e.g. Gate 1" value={gate} onChange={(e) => setGate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input placeholder="e.g. Computer Science" value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3 mt-4 flex-wrap">
            <Button onClick={handleGenerate} disabled={isLoading} className="gap-2">
              <FileBarChart2 className="h-4 w-4" />
              {isLoading ? "Generating…" : "Generate Report"}
            </Button>
            {submitted && <Button variant="ghost" onClick={handleClear}>Clear</Button>}
            {data && data.logs.length > 0 && (
              <Button variant="outline" className="ml-auto gap-2" onClick={() => downloadCSV(data.logs)}>
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {submitted && (
        <>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : data ? (
            <div className="grid gap-4 sm:grid-cols-4">
              {[
                { label: "Total Entries", value: data.summary.total },
                { label: "Currently Inside", value: data.summary.inside },
                { label: "Exited", value: data.summary.exited },
                { label: "Unique Visitors", value: data.summary.uniqueVisitors },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className="text-3xl font-bold mt-1">{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}

          <Card>
            <CardHeader><CardTitle className="text-base">Report Results</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Visitor</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Gate</TableHead>
                      <TableHead>Entry</TableHead>
                      <TableHead>Exit</TableHead>
                      <TableHead>Pass No.</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 10 }).map((_, j) => (
                            <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : !data || data.logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                          No records found for the selected filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">{format(new Date(log.visitDate), "dd MMM yyyy")}</TableCell>
                          <TableCell className="font-medium whitespace-nowrap">{log.visitorName ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{log.phoneNumber ?? "—"}</TableCell>
                          <TableCell>{log.department ?? "—"}</TableCell>
                          <TableCell className="max-w-[160px] truncate" title={log.purposeOfVisit}>{log.purposeOfVisit}</TableCell>
                          <TableCell>{log.gateNumber ?? "—"}</TableCell>
                          <TableCell className="whitespace-nowrap text-emerald-500">
                            {log.entryTime ? format(new Date(log.entryTime), "HH:mm") : "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-rose-500">
                            {log.exitTime ? format(new Date(log.exitTime), "HH:mm") : "—"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{log.passNumber ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant={log.status === "inside" ? "destructive" : "outline"}>
                              {log.status === "inside" ? "Inside" : "Exited"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
