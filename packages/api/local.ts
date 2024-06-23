if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require("express");
  const app = express();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  // const bodyParser = require("body-parser");
  const port = 8080;

  app.use(express.json());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use("/api/hello", (req: any, res: any) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("./api/hello").default(req, res);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use("/api/uploadFile", (req: any, res: any) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("./api/uploadFile").default(req, res);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use("/api/uploadMetadata", (req: any, res: any) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("./api/uploadMetadata").default(req, res);
  });

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
} else {
  throw new Error("local.js should not be used in production");
}
