const fs = require("fs")
const path = require("path")
const zlib = require("zlib")

const root = __dirname
const repoOwner = "Soopyboo32"
const repoName = "private-ext-repo"
const repoBranch = "master"
const rawBaseUrl = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/${repoBranch}`

const outputMetadata = JSON.parse(
  fs.readFileSync(path.join(root, "apk", "output-metadata.json"), "utf8"),
)
const legacyIndex = JSON.parse(
  fs.readFileSync(path.join(root, "index.min.json"), "utf8"),
)

if (legacyIndex.length !== 1 || outputMetadata.elements.length !== 1) {
  throw new Error("Expected exactly one extension and one APK output")
}

const extension = legacyIndex[0]
const apkOutput = outputMetadata.elements[0]
const publishedApk = apkOutput.outputFile.replace("-release", "")

extension.code = apkOutput.versionCode
extension.version = apkOutput.versionName
extension.apk = publishedApk

const sourceApk = path.join(root, "apk", apkOutput.outputFile)
const destinationApk = path.join(root, "apk", publishedApk)
if (fs.existsSync(sourceApk)) {
  fs.copyFileSync(sourceApk, destinationApk)
  fs.unlinkSync(sourceApk)
} else if (!fs.existsSync(destinationApk)) {
  throw new Error(`APK not found: ${sourceApk}`)
}

const contentWarning = extension.nsfw
  ? "CONTENT_WARNING_NSFW"
  : "CONTENT_WARNING_SAFE"
const extensionLib = extension.version.split(".").slice(0, -1).join(".")

const index = {
  name: "SoopyManga",
  badgeLabel: "SOOPY",
  signingKey: "2a104627b6ed61a00c3709e66673c45bb7a35c104d897072d58d73b4ea6cca5b",
  contact: {
    website: `https://github.com/${repoOwner}/${repoName}`,
  },
  extensionList: {
    extensions: [
      {
        name: extension.name.replace(/^Tachiyomi:\s*/, ""),
        packageName: extension.pkg,
        resources: {
          apkUrl: `${rawBaseUrl}/apk/${extension.apk}`,
          iconUrl: `${rawBaseUrl}/icon/${extension.pkg}.png`,
        },
        extensionLib,
        versionCode: String(extension.code),
        versionName: extension.version,
        contentWarning,
        sources: extension.sources.map((source) => ({
          id: String(source.id),
          name: source.name,
          language: source.lang,
          homeUrl: source.baseUrl,
        })),
      },
    ],
  },
}

function encodeVarint(value) {
  let remaining = BigInt(value)
  if (remaining < 0n) {
    remaining = BigInt.asUintN(64, remaining)
  }

  const bytes = []
  do {
    let byte = Number(remaining & 0x7fn)
    remaining >>= 7n
    if (remaining !== 0n) byte |= 0x80
    bytes.push(byte)
  } while (remaining !== 0n)

  return Buffer.from(bytes)
}

function fieldKey(fieldNumber, wireType) {
  return encodeVarint((BigInt(fieldNumber) << 3n) | BigInt(wireType))
}

function bytesField(fieldNumber, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8")
  return Buffer.concat([fieldKey(fieldNumber, 2), encodeVarint(bytes.length), bytes])
}

function intField(fieldNumber, value) {
  return Buffer.concat([fieldKey(fieldNumber, 0), encodeVarint(value)])
}

function message(fields) {
  return Buffer.concat(fields.filter(Boolean))
}

function encodeSource(source) {
  return message([
    intField(1, source.id),
    bytesField(2, source.name),
    bytesField(3, source.language),
    bytesField(4, source.homeUrl),
  ])
}

function encodeExtension(item) {
  const resources = message([
    bytesField(1, item.resources.apkUrl),
    bytesField(2, item.resources.iconUrl),
  ])
  const warning = item.contentWarning === "CONTENT_WARNING_NSFW" ? 3 : 1

  return message([
    bytesField(1, item.name),
    bytesField(2, item.packageName),
    bytesField(3, resources),
    bytesField(4, item.extensionLib),
    intField(5, item.versionCode),
    bytesField(6, item.versionName),
    intField(7, warning),
    ...item.sources.map((source) => bytesField(8, encodeSource(source))),
  ])
}

function encodeIndex(store) {
  const contact = message([
    bytesField(1, store.contact.website),
    store.contact.discord ? bytesField(2, store.contact.discord) : null,
  ])
  const extensionList = message(
    store.extensionList.extensions.map((item) => bytesField(1, encodeExtension(item))),
  )

  return message([
    bytesField(1, store.name),
    bytesField(2, store.badgeLabel),
    bytesField(3, store.signingKey),
    bytesField(4, contact),
    bytesField(101, extensionList),
  ])
}

fs.writeFileSync(
  path.join(root, "index.min.json"),
  `${JSON.stringify(legacyIndex)}\n`,
)
fs.writeFileSync(
  path.join(root, "index.json"),
  `${JSON.stringify(index, undefined, 2)}\n`,
)
fs.writeFileSync(
  path.join(root, "index.pb"),
  zlib.gzipSync(encodeIndex(index), { level: 9 }),
)
