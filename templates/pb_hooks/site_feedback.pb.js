/// <reference path="../pb_data/types.d.ts" />
// Public submission endpoint with a private, owner-readable feedback collection.
// PocketBase uses null (not an empty string) to lock normal REST API access.

onBootstrap(function (e) {
  e.next()
  try {
    $app.findCollectionByNameOrId("site_feedback")
    return
  } catch (_) {}

  try {
    var collection = new Collection({
      type: "base",
      name: "site_feedback",
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: "message", type: "text", required: true, max: 1200 },
        { name: "page_path", type: "text", max: 200 },
        { name: "created", type: "autodate", system: true, onCreate: true, onUpdate: false },
      ],
    })
    $app.save(collection)
  } catch (err) {
    try { $app.logger().error("site_feedback bootstrap failed: " + String(err && err.message || err)) } catch (_) {}
  }
})

// Keep a small abuse guard in this route's closure. The collection itself remains locked
// to the normal REST API; submissions are accepted only through this validated endpoint.
;(function () {
  var lastAcceptedAt = 0

  routerAdd("POST", "/api/site_feedback", function (e) {
    var body = e.requestInfo().body || {}
    // Honeypot: answer like a successful submission, but never persist the bot's payload.
    if (String(body.website || "").trim()) return e.json(200, { ok: true })

    var message = typeof body.message === "string" ? body.message.trim() : ""
    if (!message || message.length > 1200) {
      return e.json(400, { error: "invalid_feedback", message: "反馈内容需为 1–1200 个字符。" })
    }
    var pagePath = typeof body.page_path === "string" ? body.page_path.trim() : ""
    if (pagePath.length > 200 || (pagePath && pagePath.charAt(0) !== "/")) pagePath = ""

    var now = Date.now()
    if (now - lastAcceptedAt < 2000) return e.json(429, { error: "too_many_requests" })

    try {
      var collection = $app.findCollectionByNameOrId("site_feedback")
      var record = new Record(collection)
      record.set("message", message)
      record.set("page_path", pagePath)
      $app.save(record)
      lastAcceptedAt = now
      return e.json(200, { ok: true })
    } catch (err) {
      try { $app.logger().error("site_feedback submit failed: " + String(err && err.message || err)) } catch (_) {}
      return e.json(500, { error: "feedback_unavailable" })
    }
  })
})()

// Only the single private MES app account can review submissions; the raw collection API
// remains locked. The deployed bootstrap refuses to create a second app account.
function requireFeedbackOwner(e) {
  if (!e.auth) throw new UnauthorizedError("Authentication required")
  if (e.auth.isSuperuser() || e.auth.collection().name !== "mes_users") {
    throw new ForbiddenError("MES app account required")
  }
  return e.next()
}

routerAdd("GET", "/api/site_feedback", function (e) {
  try {
    var collection = $app.findCollectionByNameOrId("site_feedback")
    var q = e.requestInfo().query || {}
    var page = parseInt(q.page || "1", 10); if (!(page > 0)) page = 1
    var perPage = parseInt(q.perPage || "50", 10); if (!(perPage > 0)) perPage = 50; if (perPage > 100) perPage = 100
    var records = $app.findRecordsByFilter(collection, "", "-created", perPage, (page - 1) * perPage)
    var total = $app.countRecords(collection)
    var items = []
    for (var i = 0; i < records.length; i++) {
      items.push({ id: records[i].id, message: records[i].get("message"), page_path: records[i].get("page_path"), created: records[i].get("created") })
    }
    return e.json(200, { page: page, perPage: perPage, totalItems: total, items: items })
  } catch (err) {
    try { $app.logger().error("site_feedback read failed: " + String(err && err.message || err)) } catch (_) {}
    return e.json(500, { error: "feedback_unavailable" })
  }
}, requireFeedbackOwner)
