// =============================================================================
// Navbar.jsx — Sidebar navigation
// Admin users see additional links for Security Staff and Reports.
// =============================================================================

import { Link, useLocation }   from "wouter";
import { useAuth }              from "@/contexts/AuthContext";
import { Button }               from "@/components/ui/button";
import {
  Shield,
  LayoutDashboard,
  Users,
  UserPlus,
  ClipboardList,
  FileBarChart2,
  LogOut,
} from "lucide-react";

// ─── Nav Link Definitions ─────────────────────────────────────────────────────
const COMMON_LINKS = [
  { href: "/dashboard",        label: "Dashboard",       icon: LayoutDashboard },
  { href: "/visitors",         label: "Visitors",        icon: Users           },
  { href: "/register-visitor", label: "Register Visitor", icon: UserPlus        },
  { href: "/logs",             label: "Entry Logs",      icon: ClipboardList   },
];

const ADMIN_LINKS = [
  { href: "/staff",   label: "Security Staff", icon: Shield       },
  { href: "/reports", label: "Reports",        icon: FileBarChart2 },
];

// =============================================================================
// Component
// =============================================================================
export function Navbar() {
  const [location]       = useLocation();
  const { user, logout } = useAuth();

  const links = user?.role === "admin"
    ? [...COMMON_LINKS, ...ADMIN_LINKS]
    : COMMON_LINKS;

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-screen overflow-y-auto shrink-0">

      {/* Brand */}
      <div className="p-6 border-b border-sidebar-border flex flex-col items-center justify-center">
        <div className="bg-primary/10 p-3 rounded-full mb-3">
          <Shield className="w-8 h-8 text-primary" />
        </div>
        <h1 className="font-bold text-lg text-sidebar-foreground tracking-tight text-center leading-tight">
          Secure Entry Tracking
        </h1>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
          Security Portal
        </p>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-6 px-4 space-y-1">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive =
            location === href || location.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Info + Logout */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="mb-4 px-2">
          <p className="text-sm font-medium truncate">{user?.name}</p>
          <p className="text-xs text-muted-foreground capitalize">
            {user?.role?.replace("_", " ")}
          </p>
          {user?.gateAssigned && (
            <p className="text-xs text-primary mt-1">Gate {user.gateAssigned}</p>
          )}
        </div>

        <Button
          variant="outline"
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={logout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
