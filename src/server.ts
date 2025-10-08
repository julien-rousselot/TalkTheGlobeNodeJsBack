import express from "express";
import dotenv from "dotenv";
import r2Routes from "./routes/r2.routes";

dotenv.config();

const app = express();
app.use(express.json());

app.use("/r2", r2Routes);

app.listen(process.env.PORT, () => {
  console.log(`✅ Server running on port ${process.env.PORT}`);
});
