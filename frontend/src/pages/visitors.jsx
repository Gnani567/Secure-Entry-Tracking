import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Plus, Search, ShieldCheck, ShieldX } from "lucide-react";
import { listVisitors, approveVisitor } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function Visitors() {
  const [search, setSearch] = useState("");
  const [visitors, setVisitors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";

  const fetchVisitors = useCallback(() => {
    setIsLoading(true);
    listVisitors({ search })
      .then((d) => setVisitors(d?.visitors || []))
      .catch(() => setVisitors([]))
      .finally(() => setIsLoading(false));
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchVisitors, 300);
    return () => clearTimeout(timer);
  }, [fetchVisitors]);

  const handleApproval = async (visitorId, action) => {
    setActionId(visitorId);
    try {
      await approveVisitor(visitorId, action);
      toast({
        title: action === "approve" ? "Visitor approved" : "Visitor blocked",
        description: action === "approve"
          ? "This visitor is now approved for campus entry."
          : "This visitor has been flagged and blocked.",
      });
      fetchVisitors();
    } catch (err) {
      toast({ variant: "destructive", title: "Action failed", description: err.message });
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Visitors</h1>
          <p className="text-muted-foreground mt-1">Manage and view all registered visitors.</p>
        </div>
        <Link href="/register-visitor" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
          <Plus className="mr-2 h-4 w-4" />
          Register Visitor
        </Link>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, phone, or ID..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>ID Proof</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Registered</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: isAdmin ? 7 : 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : visitors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 7 : 6} className="h-24 text-center text-muted-foreground">No visitors found.</TableCell>
              </TableRow>
            ) : (
              visitors.map((visitor) => (
                <TableRow key={visitor.id}>
                  <TableCell className="font-medium">
                    <Link href={`/visitors/${visitor.id}`} className="hover:underline text-primary">
                      {visitor.visitorName}
                    </Link>
                  </TableCell>
                  <TableCell>{visitor.phoneNumber}</TableCell>
                  <TableCell>{visitor.idProofType} - {visitor.idProofNumber}</TableCell>
                  <TableCell className="text-muted-foreground">{visitor.department || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={visitor.visitorStatus === "active" ? "default" : "secondary"}>
                      {visitor.visitorStatus === "active" ? "Active" : "Blocked"}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(visitor.createdAt), "MMM d, yyyy")}</TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {visitor.visitorStatus !== "active" ? (
                          <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-600 hover:bg-emerald-50"
                            disabled={actionId === visitor.id} onClick={() => handleApproval(visitor.id, "approve")}>
                            <ShieldCheck className="h-4 w-4 mr-1" /> Approve
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="text-destructive border-destructive hover:bg-destructive/10"
                            disabled={actionId === visitor.id} onClick={() => handleApproval(visitor.id, "block")}>
                            <ShieldX className="h-4 w-4 mr-1" /> Block
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
