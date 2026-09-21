import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Link } from "wouter";
import { listEntryLogs, recordExit, resetPass } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { LogOut, RefreshCw } from "lucide-react";

export default function Logs() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [exitingId, setExitingId] = useState(null);
  const [resettingId, setResettingId] = useState(null);
  const { toast } = useToast();

  const fetchLogs = useCallback(() => {
    setIsLoading(true);
    listEntryLogs({ status: statusFilter, date: dateFilter })
      .then((d) => setLogs(d?.logs || []))
      .catch(() => setLogs([]))
      .finally(() => setIsLoading(false));
  }, [statusFilter, dateFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleRecordExit = async (logId) => {
    setExitingId(logId);
    try {
      await recordExit(logId);
      toast({ title: "Exit recorded successfully" });
      fetchLogs();
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to record exit", description: err.message });
    } finally {
      setExitingId(null);
    }
  };

  const handleResetPass = async (logId) => {
    setResettingId(logId);
    try {
      const result = await resetPass(logId);
      toast({ title: "Pass reissued", description: `New pass number: ${result.passNumber}` });
      fetchLogs();
    } catch (err) {
      toast({ variant: "destructive", title: "Reset failed", description: err.message });
    } finally {
      setResettingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Entry Logs</h1>
        <p className="text-muted-foreground mt-1">Master logbook of all campus entries and exits.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center">
        <div className="w-full sm:w-48">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
            <SelectTrigger><SelectValue placeholder="Filter by status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="inside">Currently Inside</SelectItem>
              <SelectItem value="exited">Exited</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-auto">
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full sm:w-48" />
        </div>
        {(statusFilter !== "all" || dateFilter) && (
          <Button variant="ghost" onClick={() => { setStatusFilter("all"); setDateFilter(""); }}>
            Clear Filters
          </Button>
        )}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Visitor</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Gate / Host</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Pass No.</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No entry logs found matching the criteria.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {format(new Date(log.visitDate), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <Link href={`/visitors/${log.visitorId}`} className="hover:underline text-primary font-medium">
                      {log.visitorName || `Visitor #${log.visitorId}`}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate" title={log.purposeOfVisit}>
                    {log.purposeOfVisit}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">Gate {log.gateNumber || "—"}</div>
                    <div className="text-xs text-muted-foreground">{log.hostName || "No Host"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium text-emerald-500">
                      In: {format(new Date(log.entryTime), "HH:mm")}
                    </div>
                    {log.exitTime && (
                      <div className="text-sm font-medium text-rose-500">
                        Out: {format(new Date(log.exitTime), "HH:mm")}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">{log.passNumber ?? "—"}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={log.status === "inside" ? "destructive" : "outline"}>
                      {log.status === "inside" ? "Inside Campus" : "Exited"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {log.status === "inside" && (
                        <Button size="sm" variant="outline" onClick={() => handleRecordExit(log.id)} disabled={exitingId === log.id}>
                          <LogOut className="h-4 w-4 mr-1" />
                          Exit
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleResetPass(log.id)} disabled={resettingId === log.id} title="Reset / reissue pass">
                        <RefreshCw className={`h-4 w-4 ${resettingId === log.id ? "animate-spin" : ""}`} />
                        <span className="ml-1 hidden sm:inline">Reset Pass</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
