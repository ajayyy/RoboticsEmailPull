var Promise = require("bluebird");

var express = require("express");
var bodyParser = require("body-parser");
var http = require("http");
var https = require("https");

var fs = Promise.promisifyAll(require("fs"));
var path = require("path");
var crypto = require("crypto");

var app = express();
app.set('env', 'production');

// Accept raw body
app.use(bodyParser.raw({type: "*/*"}));

let config = JSON.parse(fs.readFileSync("config.json"));

let authKey = config.authKey;

http.createServer(app).listen(config.port);

app.post("/newsletter/" + authKey, async function (req, res) {
    let email = req.body.toString();

    let subject = email.match(/Subject: (.*?)<br>/)[1].replace("Fwd: ", "");

    if (email.includes("---------- Forwarded message ---------")) {
        // Remove "Forwarded message text"
        email = email.replace(/---------- Forwarded message ---------.*?Begin forwarded message:/, "");
        email = email.replace(/(<b>)?From:.*?<br>(<b>)?Date:.*?<br>(<b>)?To:.*?<br>(<b>)?Subject:.*?<br>(<b>)?/, "");

        // Remove extra spacing
        email = email.replace('<div dir="ltr"><br><br><div class="gmail_quote"><div dir="ltr" class="gmail_attr"><br><br></div><blockquote type="cite"><div dir="ltr"><br></div></blockquote>', "");
    }

    // Generate an ID for this newsletter
    let id = crypto.randomBytes(5).toString("hex");

    let filePath = "./newsletters/";

    // Save file
    try {
        await fs.mkdirAsync(filePath);
    } catch {
        // Folder already exists
    }

    await fs.writeFileAsync(filePath + id + ".html", email);
    
    // Send to Discord
    let discordRequest = https.request({
        hostname: "discordapp.com",
        path: config.webhookPath,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        }
    });
    discordRequest.write(JSON.stringify({
        content: "<@&500708731064156180> New newsletter posted: " + subject + "\n\n" + config.url + id
    }));
    discordRequest.end();

    res.sendStatus(200);
});

// Host newsletter files
app.use("/", function (req, res, next) {
    if (req.method !== "GET") return next();

    currentPath = req.path.replace(/.|"|'|-|\/|\\/, "");

    res.sendFile(path.join(__dirname, "./newsletters/", currentPath + ".html"), function (err) {
        if (err) {
          res.status(err.status).end();
        }
      });
});