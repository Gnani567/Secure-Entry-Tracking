import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { createVisitor, createEntryLog, ID_PROOF_TYPES } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, UserPlus } from "lucide-react";

const registrationSchema = z.object({
  visitorName: z.string().min(2, "Name is required"),
  phoneNumber: z.string().min(10, "Valid phone number required"),
  idProofType: z.string().min(1, "ID type is required"),
  idProofNumber: z.string().min(4, "ID number is required"),
  department: z.string().optional(),
  purposeOfVisit: z.string().min(3, "Purpose is required"),
  hostName: z.string().optional(),
  gateNumber: z.string().optional(),
});

export default function RegisterVisitor() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      visitorName: "",
      phoneNumber: "",
      idProofType: "Aadhar",
      idProofNumber: "",
      department: "",
      purposeOfVisit: "",
      hostName: "",
      gateNumber: "",
    },
  });

  const { formState: { isSubmitting } } = form;

  const onSubmit = async (values) => {
    try {
      const visitorPayload = {
        visitorName: values.visitorName,
        phoneNumber: values.phoneNumber,
        idProofType: values.idProofType,
        idProofNumber: values.idProofNumber,
      };
      if (values.department) visitorPayload.department = values.department;

      const visitor = await createVisitor(visitorPayload);

      await createEntryLog({
        visitorId: visitor.id,
        purposeOfVisit: values.purposeOfVisit,
        hostName: values.hostName,
        gateNumber: values.gateNumber,
      });

      toast({ title: "Visitor registered successfully", description: "Entry log recorded." });
      setLocation(`/visitors/${visitor.id}`);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error.message || "An error occurred during registration",
      });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Register Visitor</h1>
        <p className="text-muted-foreground mt-1">Record a new visitor entry into the campus.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Personal Details
              </CardTitle>
              <CardDescription>Verify and enter the visitor's identification.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <FormField control={form.control} name="visitorName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl><Input placeholder="10-digit number" type="tel" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="idProofType" render={({ field }) => (
                <FormItem>
                  <FormLabel>ID Proof Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select ID type" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ID_PROOF_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="idProofNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>ID Proof Number</FormLabel>
                  <FormControl><Input placeholder="Enter ID number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="department" render={({ field }) => (
                <FormItem>
                  <FormLabel>Department / Organisation <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                  <FormControl><Input placeholder="e.g. Computer Science, Admin Office" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRight className="h-5 w-5 text-primary" />
                Visit Details
              </CardTitle>
              <CardDescription>Information about the current entry.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <FormField control={form.control} name="hostName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Host Name / Department</FormLabel>
                  <FormControl><Input placeholder="Whom to meet" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="gateNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Gate Number</FormLabel>
                  <FormControl><Input placeholder="e.g. Gate 1" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="purposeOfVisit" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Purpose of Visit</FormLabel>
                  <FormControl>
                    <Textarea placeholder="State the reason for visit..." className="resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={isSubmitting} className="w-full md:w-auto">
              {isSubmitting ? "Recording Entry..." : "Register & Allow Entry"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
