const fs = require("fs")
let data = JSON.parse(fs.readFileSync("./index.json"))
fs.writeFileSync("./index.min.json", JSON.stringify(data))