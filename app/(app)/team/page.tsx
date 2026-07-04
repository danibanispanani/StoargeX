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

export default async function TeamPage() {
  const { db, membership, userId } = await requireOrg();
  const canManage = hasMinRole(membership.role, "ADMIN");

  const [members, invitations] = await Promise.all([
    db.membership.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.invitation.findMany({
      where: { status: "PENDING", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Team</h1>
          <p className="text-sm text-muted-foreground">
            Mitglieder und offene Einladungen verwalten
          </p>
        </div>
        {canManage && <InviteMemberDialog isOwner={membership.role === "OWNER"} />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mitglieder</CardTitle>
          <CardDescription>{members.length} Mitglied(er)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Rolle</TableHead>
                {canManage && <TableHead className="w-40" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    {member.user.name ?? "–"}
                    {member.userId === userId && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (du)
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{member.user.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ROLE_LABELS[member.role]}</Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell>
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
        <Card>
          <CardHeader>
            <CardTitle>Offene Einladungen</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Gültig bis</TableHead>
                  {canManage && <TableHead className="w-32" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>{invitation.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ROLE_LABELS[invitation.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {invitation.expiresAt.toLocaleDateString("de-DE")}
                    </TableCell>
                    {canManage && (
                      <TableCell>
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
    </div>
  );
}
