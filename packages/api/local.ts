if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require("express");
  const app = express();
  const port = 3000;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use("/api/hello", (req: any, res: any) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("./api/hello").default(req, res);
  });

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
} else {
  throw new Error("local.js should not be used in production");
}
