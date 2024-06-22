const express = require("express");
const bodyParser = require ("body-parser");
const app = express();

const routes = require("./src/routes/routes");
const config = require("./config.json");

app.use(bodyParser.json({ type: "application/json" }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/", routes);

app.listen(config.web.port, () => {
    console.log(`Server started at the port ${config.web.port}`);
});
