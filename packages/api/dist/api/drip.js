import { DRIP_SCHEDULE, listContacts, sendDripEmail } from "../lib/emailService.js";
export default async function drip(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }
    // Verify cron secret — Vercel sends this automatically for cron invocations
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    try {
        const contacts = await listContacts();
        if (contacts.length === 0) {
            return res.status(200).json({ success: true, processed: 0, sent: 0 });
        }
        const now = Date.now();
        let sent = 0;
        for (const contact of contacts) {
            const createdAt = new Date(contact.created_at).getTime();
            const daysSinceSignup = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
            // Find the drip email to send: the highest-day drip that matches exactly.
            // We only send on the exact day (not retroactively) to keep the cadence natural.
            // A daily cron means we'll hit each day once (with +/- 1 day tolerance).
            for (const dripEmail of DRIP_SCHEDULE) {
                // Send if they're on the right day (allow 1-day tolerance for cron timing)
                if (daysSinceSignup >= dripEmail.day && daysSinceSignup <= dripEmail.day + 1) {
                    const ok = await sendDripEmail(contact.email, dripEmail);
                    if (ok)
                        sent++;
                    break; // Only send one drip per contact per cron run
                }
            }
        }
        console.log(`Drip cron: processed ${contacts.length} contacts, sent ${sent} emails`);
        return res.status(200).json({ success: true, processed: contacts.length, sent });
    }
    catch (error) {
        console.error('Error in drip cron:', error);
        return res.status(500).json({ success: false, error: "Drip processing failed" });
    }
}
