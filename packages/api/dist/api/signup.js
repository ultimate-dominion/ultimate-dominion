import { addContact, sendWelcomeEmail } from "../lib/emailService.js";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export default async function signup(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }
    try {
        const { email } = req.body ?? {};
        if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
            return res.status(400).json({ success: false, error: "Valid email address required" });
        }
        // Add to Resend Audience
        const contactOk = await addContact(email);
        if (!contactOk) {
            return res.status(500).json({ success: false, error: "Failed to save signup" });
        }
        // Send welcome email (await so errors are visible in logs)
        const emailOk = await sendWelcomeEmail(email);
        return res.status(200).json({ success: true, emailSent: emailOk });
    }
    catch (error) {
        console.error('Error in signup:', error);
        return res.status(500).json({ success: false, error: "Signup failed" });
    }
}
