"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ListSkeleton, SearchInput, useDebouncedValue } from "@/components/dashboard/admin/admin-helpers";
import { PageHeading, TableCard } from "@/components/dashboard/page-heading";
import { useAuth } from "@/components/providers/auth-provider";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiDelete, apiGet, apiPatch, errorMessage } from "@/lib/api";
import { ROLE_LABELS, formatDate, fullName } from "@/lib/format";
import type { Paginated, Role, User } from "@/lib/types";

const ROLES: Role[] = ["USER", "ORGANIZER", "ADMIN"];

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);

  const query = useQuery({
    queryKey: ["admin", "users", { search: debounced, role, page }],
    queryFn: () => apiGet<Paginated<User>>("/users", { search: debounced, role: role === "ALL" ? undefined : role, page, limit: 10 }),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: Role; isActive?: boolean } }) => apiPatch<{ user: User }>(`/users/${id}`, data),
    onSuccess: (res, vars) => {
      toast.success(
        vars.data.role
          ? `${fullName(res.user)} is now ${ROLE_LABELS[res.user.role].toLowerCase() === "admin" ? "an admin" : `a ${ROLE_LABELS[res.user.role].toLowerCase()}`}`
          : res.user.isActive
            ? `${fullName(res.user)} can sign in again`
            : `${fullName(res.user)} was deactivated and signed out`,
      );
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/users/${id}`),
    onSuccess: () => {
      toast.success("User deleted");
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const data = query.data;

  return (
    <div>
      <PageHeading title="Users" description="Change roles, deactivate accounts or remove people from the platform." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by name or email"
        />
        <Select
          value={role}
          onValueChange={(v) => {
            setRole(v as Role | "ALL");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All roles</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}s
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isLoading ? (
        <ListSkeleton />
      ) : query.error ? (
        <ErrorState message={errorMessage(query.error, "Couldn't load users.")} onRetry={() => query.refetch()} />
      ) : !data?.items.length ? (
        <EmptyState icon={Users} title="No users found" description="Try a different name, email or role." />
      ) : (
        <>
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="hidden lg:table-cell">Activity</TableHead>
                  <TableHead className="hidden md:table-cell">Joined</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((u) => {
                  const isMe = u.id === me?.id;
                  const busy = (update.isPending && update.variables?.id === u.id) || (remove.isPending && remove.variables === u.id);
                  return (
                    <TableRow key={u.id} className={!u.isActive ? "opacity-60" : undefined}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar user={u} />
                          <div className="min-w-0">
                            <p className="font-medium">
                              {fullName(u)}
                              {isMe && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                            </p>
                            <p className="max-w-52 truncate text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={u.role}
                          disabled={isMe || busy}
                          onValueChange={(v) => update.mutate({ id: u.id, data: { role: v as Role } })}
                        >
                          <SelectTrigger size="sm" className="w-32" aria-label={`Role for ${fullName(u)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={u.isActive}
                          disabled={isMe || busy}
                          onCheckedChange={(checked) => update.mutate({ id: u.id, data: { isActive: checked } })}
                          aria-label={u.isActive ? `Deactivate ${fullName(u)}` : `Activate ${fullName(u)}`}
                        />
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                        {u._count ? `${u._count.bookings} bookings, ${u._count.orders} orders${u._count.organizedEvents ? `, ${u._count.organizedEvents} events` : ""}` : "—"}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{formatDate(u.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <ConfirmDialog
                          trigger={
                            <Button variant="ghost" size="icon" disabled={isMe || busy} aria-label={`Delete ${fullName(u)}`}>
                              <Trash2 />
                            </Button>
                          }
                          title={`Delete ${fullName(u)}?`}
                          description="Their bookings, orders and requests are deleted too. This can't be undone. To keep their history, deactivate the account instead."
                          confirmLabel="Delete user"
                          onConfirm={() => remove.mutateAsync(u.id)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableCard>
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} label="users" onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
