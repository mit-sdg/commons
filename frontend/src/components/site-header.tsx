"use client";

import {
  Bell,
  Bookmark,
  GraduationCap,
  LayoutGrid,
  ListChecks,
  LogOut,
  Menu,
  PenLine,
  Settings,
  Shield,
  Sparkles,
  User,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NotificationBell } from "@/components/forum/notification-bell";
import { Link } from "@/components/link";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth } from "@/lib/auth";
import { useCourse } from "@/lib/course";
import { loadRosterMe } from "@/lib/lms";
import { lmsAccess, lmsNavigation } from "@/lib/lms-navigation";
import { cn } from "@/lib/utils";

const DISCUSSION_NAV = [
  { href: "/", label: "Discussions", icon: Sparkles },
  { href: "/categories", label: "Categories", icon: LayoutGrid },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
];

const COURSE_PATHS = [
  "/assignments",
  "/grades",
  "/calendar",
  "/notes",
  "/staff",
];

export function SiteHeader() {
  const { me, loading, permissions, logout, session } = useAuth();
  const course = useCourse();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resolvedLmsAccess, setResolvedLmsAccess] = useState({
    user: null as string | null,
    hasRosterSeat: false,
    isStaff: false,
  });

  useEffect(() => {
    if (!session || !me) return;
    let current = true;
    const user = String(me.user);
    loadRosterMe().then((roster) => {
      if (!current) return;
      const access = lmsAccess(
        "error" in roster ? null : roster.seat,
        permissions.isStaff,
      );
      setResolvedLmsAccess({ user, ...access });
    });
    return () => {
      current = false;
    };
  }, [session, me, permissions.isStaff]);

  const currentUser = me ? String(me.user) : null;
  const accessIsCurrent =
    Boolean(session) && resolvedLmsAccess.user === currentUser;
  const effectiveHasRosterSeat =
    accessIsCurrent && resolvedLmsAccess.hasRosterSeat;
  const effectiveIsStaff = accessIsCurrent && resolvedLmsAccess.isStaff;
  const courseNav = lmsNavigation(effectiveIsStaff, permissions.can);
  const courseHome = effectiveIsStaff ? "/staff" : "/assignments";
  const isCourseArea = COURSE_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  const isActive = (href: string) =>
    href === "/" || href === "/staff"
      ? pathname === href
      : pathname.startsWith(href);

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary font-display text-lg font-semibold text-primary-foreground shadow-sm">
            C
          </span>
          <span className="hidden font-display text-xl font-semibold tracking-tight sm:inline">
            Commons
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="ml-2 hidden items-center gap-1 lg:flex"
        >
          {DISCUSSION_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isActive(item.href) && "bg-muted text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
          {effectiveHasRosterSeat || effectiveIsStaff ? (
            <Link
              href={courseHome}
              aria-current={isCourseArea ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isCourseArea && "bg-primary/10 text-primary",
              )}
            >
              Course
            </Link>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          {me ? (
            <Button asChild size="sm" className="hidden gap-1.5 sm:inline-flex">
              <Link href="/new">
                <PenLine className="size-4" />
                New discussion
              </Link>
            </Button>
          ) : null}

          {me ? <NotificationBell /> : null}
          <ModeToggle />

          {loading ? null : me ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Account menu"
                >
                  <UserAvatar
                    user={String(me.user)}
                    name={me.profile.displayName}
                    avatar={me.profile.avatar}
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="flex flex-col">
                  <span className="font-semibold">
                    {me.profile.displayName}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    @{me.username}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/u/${me.user}`}>
                    <User className="size-4" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/notifications">
                    <Bell className="size-4" /> Notifications
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/tasks">
                    <ListChecks className="size-4" /> Tasks
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/bookmarks">
                    <Bookmark className="size-4" /> Bookmarks
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/subscriptions">
                    <UsersRound className="size-4" /> Following
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="size-4" /> Settings
                  </Link>
                </DropdownMenuItem>
                {permissions.can("moderate") ? (
                  <DropdownMenuItem asChild>
                    <Link href="/moderation">
                      <Wrench className="size-4" /> Moderation
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                {permissions.can("administer") ? (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <Shield className="size-4" /> Administration
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                {effectiveHasRosterSeat || effectiveIsStaff ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                      Course {effectiveIsStaff ? "staff" : ""}
                    </DropdownMenuLabel>
                    {courseNav.map((item) => (
                      <DropdownMenuItem key={item.href} asChild>
                        <Link href={item.href}>
                          <item.icon className="size-4" /> {item.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()}>
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
            >
              <Link href="/login">Sign in</Link>
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? (
              <X className="size-5" />
            ) : (
              <Menu className="size-5" />
            )}
          </Button>
        </div>
      </div>

      {(effectiveHasRosterSeat || effectiveIsStaff) && isCourseArea ? (
        <nav
          aria-label="Course"
          className="hidden border-t border-border/70 bg-muted/30 lg:block"
        >
          <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6">
            <span className="mr-2 flex shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <GraduationCap className="size-4" />
              {course.code
                ? `${course.code} · ${course.title} · ${course.term}`
                : "Course"}
            </span>
            {courseNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground",
                  isActive(item.href) &&
                    "bg-background text-foreground shadow-xs",
                )}
              >
                <item.icon className="size-4" /> {item.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}

      {mobileOpen ? (
        <nav
          id="mobile-navigation"
          aria-label="Mobile"
          className="border-t border-border bg-background px-4 py-3 lg:hidden"
          onKeyDown={(event) => {
            if (event.key === "Escape") closeMobile();
          }}
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-1">
            {DISCUSSION_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobile}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted",
                  isActive(item.href) && "bg-muted text-foreground",
                )}
              >
                <item.icon className="size-4" /> {item.label}
              </Link>
            ))}
            {effectiveHasRosterSeat || effectiveIsStaff ? (
              <>
                <p className="mt-3 mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Course {effectiveIsStaff ? "staff" : ""}
                </p>
                {courseNav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobile}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted",
                      isActive(item.href) && "bg-primary/10 text-primary",
                    )}
                  >
                    <item.icon className="size-4" /> {item.label}
                  </Link>
                ))}
              </>
            ) : null}
            {me ? (
              <>
                <p className="mt-3 mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Account
                </p>
                <Link
                  href="/new"
                  onClick={closeMobile}
                  className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted"
                >
                  <PenLine className="size-4" /> New discussion
                </Link>
                <Link
                  href="/bookmarks"
                  onClick={closeMobile}
                  className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted"
                >
                  <Bookmark className="size-4" /> Bookmarks
                </Link>
                <Link
                  href="/subscriptions"
                  onClick={closeMobile}
                  className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted"
                >
                  <UsersRound className="size-4" /> Following
                </Link>
                <Link
                  href="/settings"
                  onClick={closeMobile}
                  className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted"
                >
                  <Settings className="size-4" /> Settings
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                onClick={closeMobile}
                className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted"
              >
                <User className="size-4" /> Sign in
              </Link>
            )}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
