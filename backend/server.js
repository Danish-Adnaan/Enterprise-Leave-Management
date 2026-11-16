const express = require("express");
const cors = require("cors");


const authRoutes = require("./routes/authRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
const userRoutes = require("./routes/userRoutes")


const errorHandler = require("./middleware/errorHandler")
const notFound = require("./middleware/notFound");



const app = express();

app.use(
  cors({
    origin: "http://127.0.0.1:5500",
  }),
);

app.use(express.json());

app.use("/api", authRoutes);
app.use("/api", leaveRoutes);
app.use("/api/users", userRoutes)

app.get("/", function (req, res) {
  res.send("Hello from our backend!");
});

app.use(notFound);

app.use(errorHandler);


app.listen(3000, function () {
  console.log("Server is running on port 3000");
});
