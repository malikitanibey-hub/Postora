import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPasswordResetCode(email, code) {
  const { data, error } = await resend.emails.send({
    from: "Postora <onboarding@resend.dev>",
    to: ["postora.app@gmail.com"],
    subject: "Your Postora password reset code",
html: `
  <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
    <h2 style="color: #2764de;">Postora</h2>

    <p>You requested to reset your Postora password.</p>

    <p>
      This verification code is for the account:
    </p>

    <p>
      <strong>${email}</strong>
    </p>

    <p>Your verification code is:</p>

    <div style="
      font-size: 32px;
      font-weight: bold;
      letter-spacing: 8px;
      margin: 20px 0;
    ">
      ${code}
    </div>

    <p>This code will expire in 10 minutes.</p>

    <p>
      If you did not request a password reset, you can ignore this email.
    </p>

    <p>— The Postora Team</p>
  </div>
`,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}