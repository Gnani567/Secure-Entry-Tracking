// =============================================================================
// staff.jsx — Security Staff Management Page (Admin only)
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import { useForm }                           from "react-hook-form";
import { zodResolver }                       from "@hookform/resolvers/zod";
import * as z                                from "zod";
import { useAuth }                           from "@/contexts/AuthContext";
import { Shield, Plus, Trash2 }              from "lucide-react";
import { useLocation }                       from "wouter";
import { format }                            from "date-fns";

import { listSecurityStaff, createSecurityStaff, deleteSecurityStaff } from "@/lib/api";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button }       from "@/components/ui/button";
import { Input }        from "@/components/ui/input";
import { Skeleton }     from "@/components/ui/skeleton";
import { useToast }     from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// ─── Validation Schema ────────────────────────────────────────────────────────
const staffSchema = z.object({
  staffName:    z.string().min(2, "Name must be at least 2 characters"),
  password:     z.string().min(6, "Password must be at least 6 characters"),
  gateAssigned: z.string().optional(),
});

// =============================================================================
// Component
// =============================================================================
export default function Staff() {
  const { user }          = useAuth();
  const [, setLocation]   = useLocation();
  const { toast }         = useToast();

  const [isAddOpen,   setIsAddOpen]   = useState(false);
  const [staff,       setStaff]       = useState([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [isCreating,  setIsCreating]  = useState(false);
  const [deletingId,  setDeletingId]  = useState(null);

  // BUG FIX: Role check moved into useEffect.
  // Previously it called setLocation() directly in the render body (before
  // useCallback / useEffect declarations), which breaks React's Rules of Hooks
  // and causes "cannot update a component during the render of a different
  // component" warnings.
  useEffect(() => {
    if (user && user.role !== "admin") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  // ─── Data Fetching ──────────────────────────────────────────────────────────
  const fetchStaff = useCallback(() => {
    setIsLoading(true);
    listSecurityStaff()
      .then((d) => setStaff(d?.staff || []))
      .catch(() => setStaff([]))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  // ─── Form ───────────────────────────────────────────────────────────────────
  const form = useForm({
    resolver:      zodResolver(staffSchema),
    defaultValues: { staffName: "", password: "", gateAssigned: "" },
  });

  const onSubmit = async (values) => {
    setIsCreating(true);
    try {
      await createSecurityStaff(values);
      toast({ title: "Staff member added successfully" });
      setIsAddOpen(false);
      form.reset();
      fetchStaff();
    } catch (err) {
      toast({
        variant:     "destructive",
        title:       "Error adding staff",
        description: err.message,
      });
    } finally {
      setIsCreating(false);
    }
  };

  // ─── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to remove this staff member?")) return;
    setDeletingId(id);
    try {
      await deleteSecurityStaff(id);
      toast({ title: "Staff member removed" });
      fetchStaff();
    } catch (err) {
      toast({
        variant:     "destructive",
        title:       "Error removing staff",
        description: err.message,
      });
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Staff</h1>
          <p className="text-muted-foreground mt-1">
            Manage security officers and gate assignments.
          </p>
        </div>

        {/* Add Staff Dialog */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Staff
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Security Staff</DialogTitle>
              <DialogDescription>
                Create a new login account for a security officer.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="staffName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gateAssigned"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gate Assignment (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Main Gate" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temporary Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? "Creating..." : "Create Account"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Staff Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Login ID</TableHead>
              <TableHead>Gate Assigned</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : staff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No security staff found.
                </TableCell>
              </TableRow>
            ) : (
              staff.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-primary">
                    <span className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {s.staffId}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{s.staffName}</TableCell>
                  <TableCell className="font-mono text-sm">{s.userId}</TableCell>
                  <TableCell>
                    {s.gateAssigned || (
                      <span className="text-muted-foreground italic">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>{format(new Date(s.createdAt), "MMM d, yyyy")}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(s.id)}
                      disabled={deletingId === s.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
