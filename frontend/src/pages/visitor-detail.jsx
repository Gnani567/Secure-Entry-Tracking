import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { format } from "date-fns";
import { getVisitor, listEntryLogs } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, User, Fingerprint, CalendarDays } from "lucide-react";

export default function VisitorDetail() {
  const [, params] = useRoute("/visitors/:id");
  const visitorId = parseInt(params?.id || "0", 10);
  const [visitor, setVisitor] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isLoadingVisitor, setIsLoadingVisitor] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  useEffect(() => {
    if (!visitorId) return;
    setIsLoadingVisitor(true);
    getVisitor(visitorId)
      .then(setVisitor)
      .catch(() => setVisitor(null))
      .finally(() => setIsLoadingVisitor(false));

    setIsLoadingLogs(true);
    listEntryLogs({ visitorId })
      .then((d) => setLogs(d?.logs || []))
      .catch(() => setLogs([]))
      .finally(() => setIsLoadingLogs(false));
  }, [visitorId]);

  if (isLoadingVisitor) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!visitor) {
    return <div className="text-center py-12 text-muted-foreground">Visitor not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Visitor Details</h1>
        <p className="text-muted-foreground mt-1">Detailed information and entry history.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              {visitor.visitorName}
            </CardTitle>
            <Badge variant={visitor.visitorStatus === "active" ? "default" : "secondary"}>
              {visitor.visitorStatus}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <p className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" /> Phone
            </p>
            <p className="font-semibold">{visitor.phoneNumber}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Fingerprint className="h-4 w-4" /> ID Proof
            </p>
            <p className="font-semibold">{visitor.idProofType}</p>
            <p className="text-sm text-muted-foreground">{visitor.idProofNumber}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-4 w-4" /> Registered
            </p>
            <p className="font-semibold">{format(new Date(visitor.createdAt), "PPP")}</p>
            <p className="text-sm text-muted-foreground">{format(new Date(visitor.createdAt), "p")}</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Entry Logs</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Time (In/Out)</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Gate</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingLogs ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No entry logs found.</TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{format(new Date(log.visitDate), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="text-emerald-500 font-medium">In:</span> {format(new Date(log.entryTime), "HH:mm")}
                      </div>
                      {log.exitTime && (
                        <div className="text-sm">
                          <span className="text-rose-500 font-medium">Out:</span> {format(new Date(log.exitTime), "HH:mm")}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{log.purposeOfVisit}</TableCell>
                    <TableCell>{log.hostName || "-"}</TableCell>
                    <TableCell>{log.gateNumber || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === "inside" ? "destructive" : "outline"}>{log.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
