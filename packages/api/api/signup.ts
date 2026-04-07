import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Request, Response } from "express";
import { addContact, sendWelcomeEmail } from "../lib/emailService.js";
import { setCors } from "../lib/cors.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function signup(req: VercelRequest, res: VercelResponse): Promise<unknown>;
export default async function signup(req: Request, res: Response): Promise<unknown>;
export default async function signup(req: VercelRequest | Request, res: VercelResponse | Response) {
  const request = req as VercelRequest & Request;
  const response = res as VercelResponse & Response;
  if (setCors(request, response)) return response.status(204).end();

  if (request.method !== "POST") {
    return response.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { email } = request.body ?? {};

    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
      return response.status(400).json({ success: false, error: "Valid email address required" });
    }

    // Add to Resend Audience
    const contactOk = await addContact(email);
    if (!contactOk) {
      return response.status(500).json({ success: false, error: "Failed to save signup" });
    }

    // Send welcome email (await so errors are visible in logs)
    const emailOk = await sendWelcomeEmail(email);

    return response.status(200).json({ success: true, emailSent: emailOk });
  } catch (error: unknown) {
    console.error('Error in signup:', error);
    return response.status(500).json({ success: false, error: "Signup failed" });
  }
}
