import { VercelRequest, VercelResponse } from "@vercel/node";

export default async function sessionBooting(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");

  if (!(req.method === "POST" || req.method == "OPTIONS")) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    return res.status(200).json({ message: "hi" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
