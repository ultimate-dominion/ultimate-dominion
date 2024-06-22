import { VercelRequest, VercelResponse } from "@vercel/node";

const hello = (req: VercelRequest, res: VercelResponse) => {
  // if (process.env.NODE_ENV === "production") {
  //   const secretToken = process.env.SECRET_TOKEN;
  //   const clientToken = req.headers["authorization"];

  //   if (clientToken !== `Bearer ${secretToken}`) {
  //     return res.status(403).json({ message: "Forbidden" });
  //   }
  // }

  res.status(200).json({ message: "Hello from Vercel!" });
};

export default hello;
