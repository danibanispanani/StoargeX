import nodemailer from "nodemailer";

// Ohne SMTP_HOST (lokale Entwicklung) werden Mails nur in die Konsole geloggt.

export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  if (!process.env.SMTP_HOST) {
    console.info(
      `[mail] SMTP nicht konfiguriert – Mail an ${options.to}: "${options.subject}"\n${options.text}`
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "StoargeX <noreply@storagex.local>",
    ...options,
  });
}

export async function sendInvitationMail(params: {
  to: string;
  organizationName: string;
  inviterName: string;
  role: string;
  token: string;
}): Promise<void> {
  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";
  const link = `${baseUrl}/einladung/${params.token}`;
  const text = [
    `${params.inviterName} hat dich eingeladen, der Organisation "${params.organizationName}" auf StoargeX beizutreten (Rolle: ${params.role}).`,
    "",
    `Einladung annehmen: ${link}`,
    "",
    "Der Link ist 7 Tage gültig.",
  ].join("\n");

  await sendMail({
    to: params.to,
    subject: `Einladung zu ${params.organizationName} auf StoargeX`,
    text,
    html: `
      <p>${params.inviterName} hat dich eingeladen, der Organisation
      <strong>${params.organizationName}</strong> auf StoargeX beizutreten
      (Rolle: <strong>${params.role}</strong>).</p>
      <p><a href="${link}">Einladung annehmen</a></p>
      <p>Der Link ist 7 Tage gültig.</p>`,
  });
}
