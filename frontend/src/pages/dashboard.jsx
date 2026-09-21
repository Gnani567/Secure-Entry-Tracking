import { useState, useEffect } from "react";
import { getDashboardStats, getRecentActivity, getVisitorsCurrentlyInside } from "@/lib/api";
import { Users, UserCheck, ArrowRightLeft, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

function useFetch(fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchFn()
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, deps);
  return { data, isLoading };
}

export default function Dashboard() {
  const { data: stats, isLoading } = useFetch(getDashboardStats);
  const { data: recentActivity, isLoading: isLoadingActivity } = useFetch(getRecentActivity);
  const { data: visitorsInside, isLoading: isLoadingInside } = useFetch(getVisitorsCurrentlyInside);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of campus security and visitor metrics.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Visitors Inside" value={stats?.visitorsCurrentlyInside} icon={UserCheck} loading={isLoading} />
        <StatCard title="Visitors Today" value={stats?.totalVisitorsToday} icon={Users} loading={isLoading} />
        <StatCard title="Exited Today" value={stats?.totalExitedToday} icon={ArrowRightLeft} loading={isLoading} />
        <StatCard title="Security Staff" value={stats?.totalSecurityStaff} icon={ShieldAlert} loading={isLoading} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col h-full">
          <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {isLoadingActivity ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : recentActivity?.activities?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            ) : (
              <div className="space-y-4">
                {(recentActivity?.activities || []).map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                    <div className="flex flex-col">
                      <p className="text-sm font-medium">{activity.visitorName || "Unknown Visitor"}</p>
                      <p className="text-xs text-muted-foreground">{activity.purposeOfVisit} {activity.gateNumber && `- Gate ${activity.gateNumber}`}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={activity.action === "entered" ? "default" : "outline"} className="text-[10px] px-1.5 py-0">
                        {activity.action}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{format(new Date(activity.timestamp), "dd MMM, HH:mm")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col h-full">
          <CardHeader><CardTitle>Currently Inside</CardTitle></CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Visitor</TableHead>
                  <TableHead>Time In</TableHead>
                  <TableHead>Gate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingInside ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    </TableRow>
                  ))
                ) : visitorsInside?.logs?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">No visitors currently inside.</TableCell>
                  </TableRow>
                ) : (
                  (visitorsInside?.logs || []).slice(0, 5).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.visitorName}</TableCell>
                      <TableCell>{format(new Date(log.entryTime), "HH:mm")}</TableCell>
                      <TableCell>{log.gateNumber || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, loading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{value ?? 0}</div>}
      </CardContent>
    </Card>
  );
}
