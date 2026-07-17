import { requireOrg } from "@/lib/org";
import { hasMinRole, ROLE_LABELS } from "@/lib/roles";
import { InviteMemberDialog } from "@/components/team/invite-member-dialog";
import { MemberActions } from "@/components/team/member-actions";
import { RevokeInvitationButton } from "@/components/team/revoke-invitation-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { CompactTableShell } from "@/components/table/compact-table-shell";
import {
  OPERATIONAL_MODULES,
  operationalSearchParams,
  parseOperationalSearchQuery,
  parseOperationalModuleView,
} from "@/lib/operational-modules";
import { OperationalSearchToolbar } from "@/components/table/operational-search-toolbar";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; q?: string }>;
}) {
  const { db, membership, userId, organization } = await requireOrg();
  const { preset, q: rawQuery } = await searchParams;
  const q = parseOperationalSearchQuery(rawQuery);
  const requestedView = parseOperationalModuleView(OPERATIONAL_MODULES.team, preset);
  const canManage = hasMinRole(membership.role, "ADMIN");

  const [members, invitations] = await Promise.all([
    db.membership.findMany({
      where: q
        ? {
            user: {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            },
          }
        : undefined,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.invitation.findMany({
      where: {
        status: "PENDING",
        expiresAt: { gt: new Date() },
        ...(q ? { email: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const visibleTeamCount = requestedView === "invitations"
    ? invitations.length
    : requestedView === "all"
      ? members.length + invitations.length
      : members.length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Verwaltung"
        title="Team"
        description="Mitglieder, Rollen und offene Einladungen der aktiven Organisation."
        actions={canManage ? <InviteMemberDialog isOwner={membership.role === "OWNER"} /> : undefined}
      />
      <OperationalSearchToolbar
        basePath="/team"
        query={q ?? ""}
        placeholder="Name oder E-Mail"
        hiddenParams={{ preset: requestedView === "members" ? undefined : requestedView }}
      />

      <CompactTableShell
        definition={OPERATIONAL_MODULES.team}
        scope={{ organizationId: organization.id, userId }}
        requestedView={requestedView}
        currentQuery={operationalSearchParams({
          preset: requestedView === "members" ? undefined : requestedView,
          q,
        })}
        totalResults={visibleTeamCount}
      >
      <Card
        className="rounded-none border-0 shadow-none"
        data-table-view-row
        data-row-view-members
        data-row-view-roles
        data-row-view-all
      >
        <CardHeader>
          <CardTitle>Mitglieder</CardTitle>
          <CardDescription>{members.length} Mitglied(er)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead data-column data-column-key="name" data-view-members data-view-roles data-view-all>Name</TableHead>
                <TableHead data-column data-column-key="email" data-view-members data-view-roles data-view-all>E-Mail</TableHead>
                <TableHead data-column data-column-key="role" data-view-members data-view-roles data-view-all>Rolle</TableHead>
                <TableHead data-column data-column-key="status" data-view-members data-view-all>Status</TableHead>
                {canManage && <TableHead data-column data-column-key="actions" data-view-members data-view-roles data-view-all className="w-40">Aktionen</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell data-column data-column-key="name" data-view-members data-view-roles data-view-all>
                    {member.user.name ?? "–"}
                    {member.userId === userId && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (du)
                      </span>
                    )}
                  </TableCell>
                  <TableCell data-column data-column-key="email" data-view-members data-view-roles data-view-all>{member.user.email}</TableCell>
                  <TableCell data-column data-column-key="role" data-view-members data-view-roles data-view-all>
                    <Badge variant="secondary">{ROLE_LABELS[member.role]}</Badge>
                  </TableCell>
                  <TableCell data-column data-column-key="status" data-view-members data-view-all>
                    <Badge variant="outline">Aktiv</Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell data-column data-column-key="actions" data-view-members data-view-roles data-view-all>
                      {member.userId !== userId && (
                        <MemberActions
                          membershipId={member.id}
                          currentRole={member.role}
                          actorIsOwner={membership.role === "OWNER"}
                        />
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <Card
          className="rounded-none border-x-0 border-b-0 shadow-none"
          data-table-view-row
          data-row-view-invitations
          data-row-view-all
        >
          <CardHeader>
            <CardTitle>Offene Einladungen</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead data-column data-column-key="email" data-view-invitations data-view-all>E-Mail</TableHead>
                  <TableHead data-column data-column-key="role" data-view-invitations data-view-all>Rolle</TableHead>
                  <TableHead data-column data-column-key="expires" data-view-invitations data-view-all>Gültig bis</TableHead>
                  <TableHead data-column data-column-key="status" data-view-invitations data-view-all>Status</TableHead>
                  {canManage && <TableHead data-column data-column-key="actions" data-view-invitations data-view-all className="w-32">Aktionen</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell data-column data-column-key="email" data-view-invitations data-view-all>{invitation.email}</TableCell>
                    <TableCell data-column data-column-key="role" data-view-invitations data-view-all>
                      <Badge variant="outline">
                        {ROLE_LABELS[invitation.role]}
                      </Badge>
                    </TableCell>
                    <TableCell data-column data-column-key="expires" data-view-invitations data-view-all>
                      {invitation.expiresAt.toLocaleDateString("de-DE")}
                    </TableCell>
                    <TableCell data-column data-column-key="status" data-view-invitations data-view-all>
                      <Badge variant="outline">Ausstehend</Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell data-column data-column-key="actions" data-view-invitations data-view-all>
                        <RevokeInvitationButton invitationId={invitation.id} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      </CompactTableShell>
    </div>
  );
}
