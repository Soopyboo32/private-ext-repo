const fs = require("fs")
let outmeta = JSON.parse(fs.readFileSync("./apk/output-metadata.json")).elements[0]
let data = JSON.parse(fs.readFileSync("./index.json"))
data[0].code = outmeta.code
data[0].version = outmeta.versionName
data[0].apk = outmeta.outputFile.replace("-release", "")
fs.writeFileSync("./index.min.json", JSON.stringify(data))
fs.writeFileSync("./index.json", JSON.stringify(data, undefined, 2))
fs.renameSync("./apk/"+outmeta.outputFile, "./apk/"+data[0].apk)