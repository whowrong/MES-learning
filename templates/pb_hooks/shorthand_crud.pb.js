/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/shorthand_crud.pb.js — 独立部署通用简写 CRUD 路由
//
// 背景: 本应用前端数据层用 {PB}/api/<集合名>[/<id>] 的「简写 API」访问
// player_progress(游戏存档) 与 deploy_docs(部署文档库)。在 VibeX 平台部署时,
// 这组路由由平台注入(绕过 collection 规则、经 $app DAO 直读直写); 独立部署的
// 原生 PocketBase 没有这组路由(标准形态是 /api/collections/<名>/records/...),
// 前端会全部 404。本文件按平台契约补齐:
//
//   GET    /api/<集合>          → {page, perPage, totalItems, totalPages, items}
//   GET    /api/<集合>/<id>     → 记录本体
//   POST   /api/<集合>          → 新建, 返回记录本体(含 id)
//   PATCH  /api/<集合>/<id>     → 局部更新, 返回记录本体
//   DELETE /api/<集合>/<id>     → 204
//
// 列表支持 ?page ?perPage ?sort(+字段/-字段, 默认 -created), 以及与「文本字段」
// 同名的查询参数做等值过滤(如 ?doc_type=manual)。
//
// 白名单只有 player_progress 与 deploy_docs 两个集合(本文件按集合逐个注册
// 静态前缀路由, 不会遮蔽 /api/llm、/api/aigc、/api/dblab 等其它路由)。
// 集合不存在时由 onBootstrap 自动创建; 规则全 null —— 标准 collections
// 路由仍只有 superuser 能访问, 数据只经本 hook 出入(与平台的安全模型一致)。
//
// ⚠️ PB hooks 约定: 每个 routerAdd 处理器是独立作用域, 看不到本文件顶层
// 函数/变量, 所以每个处理器都自带字段配置与小工具, 不要抽公共函数到顶层。

onBootstrap(function (e) {
  e.next()
  var DEFS = [
    {
      name: "player_progress",
      fields: [
        { name: "chapter_status", type: "json" },
        { name: "gauges", type: "json" },
        { name: "review_queue", type: "json" },
        { name: "term_mastery", type: "json" },
        { name: "review_state", type: "json" },
        { name: "study_days", type: "json" },
        { name: "interview_history", type: "json" },
        { name: "factory_history", type: "json" },
        { name: "ops_history", type: "json" },
        { name: "db_history", type: "json" },
        { name: "career_history", type: "json" },
        { name: "last_route", type: "text", max: 500 },
        { name: "created", type: "autodate", system: true, onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", system: true, onCreate: true, onUpdate: true },
      ],
    },
    {
      name: "deploy_docs",
      fields: [
        { name: "title", type: "text", required: true, max: 500 },
        { name: "content", type: "text", max: 500000 },
        { name: "commands", type: "text", max: 200000 },
        { name: "doc_type", type: "text", max: 64 },
        { name: "created", type: "autodate", system: true, onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", system: true, onCreate: true, onUpdate: true },
      ],
    },
  ]
  for (var i = 0; i < DEFS.length; i++) {
    try {
      var existing = null
      try { existing = $app.findCollectionByNameOrId(DEFS[i].name) } catch (_) { existing = null }
      if (existing) {
        // 已有集合: 补齐缺失字段。老实例(早期版本建的集合)少了后来新增的字段时,
        // 前端 PATCH 带新字段会被 PocketBase 拒绝 → 整次存档写入失败(读回来也是空的)。
        // 这里按 aigc.pb.js 的同款做法升级 schema, 只加字段, 不动已有数据。
        try {
          var changed = false
          function hasField(name) {
            try { return !!existing.fields.getByName(name) } catch (_) {}
            try {
              for (var k = 0; k < existing.fields.length; k++) {
                if (String(existing.fields[k].name) === String(name)) return true
              }
            } catch (_) {}
            return false
          }
          for (var fi = 0; fi < DEFS[i].fields.length; fi++) {
            var def = DEFS[i].fields[fi]
            if (hasField(def.name)) continue
            try { existing.fields.add(new Field(def)); changed = true } catch (_) {}
          }
          // 只升级集合结构, 不写任何一条记录: 老记录的进度字段一律原样保留,
          // 新字段在老记录上保持空值, 不写入任何默认值(不会覆盖历史进度)。
          if (changed) {
            $app.save(existing)
            try { $app.logger().info("shorthand collection upgraded: " + DEFS[i].name) } catch (_) {}
          }
        } catch (schemaErr) {
          try { $app.logger().error("shorthand schema upgrade " + DEFS[i].name + ": " + String(schemaErr && schemaErr.message || schemaErr)) } catch (_) {}
        }
        continue
      }
      var col = new Collection({
        type: "base",
        name: DEFS[i].name,
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: DEFS[i].fields,
      })
      $app.save(col)
      try { $app.logger().info("shorthand collection created: " + DEFS[i].name) } catch (_) {}
    } catch (err) {
      try { $app.logger().error("shorthand bootstrap " + DEFS[i].name + ": " + String(err && err.message || err)) } catch (_) {}
    }
  }
})

// ---------------------------------------------------------------------------
// player_progress
// ---------------------------------------------------------------------------

// Require a normal MES app account for custom routes. Superusers are intentionally
// excluded from the browser API; collection admin remains local to PocketBase.
function requireMesUser(e) {
  if (!e.auth) throw new UnauthorizedError("Authentication required")
  if (e.auth.isSuperuser() || e.auth.collection().name !== "mes_users") {
    throw new ForbiddenError("MES app account required")
  }
  return e.next()
}

routerAdd("GET", "/api/player_progress", function (e) {
  var JSON_FIELDS = ["chapter_status", "gauges", "review_queue", "term_mastery", "review_state", "study_days", "interview_history", "factory_history", "ops_history", "db_history", "career_history"]
  var TEXT_FIELDS = ["last_route"]
  function recObj(rec) {
    var o = { id: rec.id, created: String(rec.get("created") || ""), updated: String(rec.get("updated") || "") }
    var all = JSON_FIELDS.concat(TEXT_FIELDS)
    for (var i = 0; i < all.length; i++) {
      try { o[all[i]] = rec.get(all[i]) } catch (_) { o[all[i]] = null }
    }
    return o
  }
  try {
    var col = $app.findCollectionByNameOrId("player_progress")
    var q = e.requestInfo().query || {}
    var page = parseInt(q.page || "1", 10); if (!(page > 0)) page = 1
    var perPage = parseInt(q.perPage || "100", 10); if (!(perPage > 0)) perPage = 100; if (perPage > 500) perPage = 500
    // 默认按最近更新排序：老存档是「最后玩过的那条」，
    // 避免新插入的空记录排在最前、让用户看到一片空白的进度。
    var sort = String(q.sort || "-updated")
    var clauses = []
    var params = {}
    for (var i = 0; i < TEXT_FIELDS.length; i++) {
      var fn = TEXT_FIELDS[i]
      if (q[fn] !== undefined && q[fn] !== "") {
        var pk = "f" + i
        clauses.push(fn + " = {:" + pk + "}")
        params[pk] = String(q[fn])
      }
    }
    var filter = clauses.join(" && ")
    var total = filter ? $app.findRecordsByFilter(col, filter, "", 0, 0, params).length : $app.countRecords(col)
    var records = $app.findRecordsByFilter(col, filter, sort, perPage, (page - 1) * perPage, params)
    var items = []
    for (var j = 0; j < records.length; j++) items.push(recObj(records[j]))
    return e.json(200, {
      page: page, perPage: perPage, totalItems: total,
      totalPages: Math.max(1, Math.ceil(total / perPage)), items: items,
    })
  } catch (err) {
    return e.json(500, { error: "shorthand_list_error", message: String(err && err.message || err) })
  }
}, requireMesUser)

routerAdd("GET", "/api/player_progress/{id}", function (e) {
  var JSON_FIELDS = ["chapter_status", "gauges", "review_queue", "term_mastery", "review_state", "study_days", "interview_history", "factory_history", "ops_history", "db_history", "career_history"]
  var TEXT_FIELDS = ["last_route"]
  function recObj(rec) {
    var o = { id: rec.id, created: String(rec.get("created") || ""), updated: String(rec.get("updated") || "") }
    var all = JSON_FIELDS.concat(TEXT_FIELDS)
    for (var i = 0; i < all.length; i++) {
      try { o[all[i]] = rec.get(all[i]) } catch (_) { o[all[i]] = null }
    }
    return o
  }
  try {
    var col = $app.findCollectionByNameOrId("player_progress")
    var rec = $app.findRecordById(col, e.request.pathValue("id"))
    return e.json(200, recObj(rec))
  } catch (err) {
    return e.json(404, { error: "record_not_found", message: String(err && err.message || err) })
  }
}, requireMesUser)

routerAdd("POST", "/api/player_progress", function (e) {
  var JSON_FIELDS = ["chapter_status", "gauges", "review_queue", "term_mastery", "review_state", "study_days", "interview_history", "factory_history", "ops_history", "db_history", "career_history"]
  var TEXT_FIELDS = ["last_route"]
  function recObj(rec) {
    var o = { id: rec.id, created: String(rec.get("created") || ""), updated: String(rec.get("updated") || "") }
    var all = JSON_FIELDS.concat(TEXT_FIELDS)
    for (var i = 0; i < all.length; i++) {
      try { o[all[i]] = rec.get(all[i]) } catch (_) { o[all[i]] = null }
    }
    return o
  }
  try {
    var col = $app.findCollectionByNameOrId("player_progress")
    var body = e.requestInfo().body || {}
    var rec = new Record(col)
    var all = JSON_FIELDS.concat(TEXT_FIELDS)
    var skipped = []
    for (var i = 0; i < all.length; i++) {
      if (body[all[i]] === undefined) continue
      // 逐字段容错: 集合缺这个字段时跳过它, 而不是让整次存档写入 400 失败
      try { rec.set(all[i], body[all[i]]) } catch (err) { skipped.push(all[i]) }
    }
    $app.save(rec)
    var out = recObj(rec)
    if (skipped.length > 0) out.skipped_fields = skipped
    return e.json(200, out)
  } catch (err) {
    return e.json(400, { error: "shorthand_create_error", message: String(err && err.message || err) })
  }
}, requireMesUser)

routerAdd("PATCH", "/api/player_progress/{id}", function (e) {
  var JSON_FIELDS = ["chapter_status", "gauges", "review_queue", "term_mastery", "review_state", "study_days", "interview_history", "factory_history", "ops_history", "db_history", "career_history"]
  var TEXT_FIELDS = ["last_route"]
  function recObj(rec) {
    var o = { id: rec.id, created: String(rec.get("created") || ""), updated: String(rec.get("updated") || "") }
    var all = JSON_FIELDS.concat(TEXT_FIELDS)
    for (var i = 0; i < all.length; i++) {
      try { o[all[i]] = rec.get(all[i]) } catch (_) { o[all[i]] = null }
    }
    return o
  }
  try {
    var col = $app.findCollectionByNameOrId("player_progress")
    var rec = null
    try { rec = $app.findRecordById(col, e.request.pathValue("id")) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "record_not_found", message: "player_progress record not found" })
    var body = e.requestInfo().body || {}
    var all = JSON_FIELDS.concat(TEXT_FIELDS)
    var skipped = []
    for (var i = 0; i < all.length; i++) {
      if (body[all[i]] === undefined) continue
      // 逐字段容错: 集合缺这个字段时跳过它, 而不是让整次存档写入 400 失败
      try { rec.set(all[i], body[all[i]]) } catch (err) { skipped.push(all[i]) }
    }
    $app.save(rec)
    var out = recObj(rec)
    if (skipped.length > 0) out.skipped_fields = skipped
    return e.json(200, out)
  } catch (err) {
    return e.json(400, { error: "shorthand_update_error", message: String(err && err.message || err) })
  }
}, requireMesUser)

routerAdd("DELETE", "/api/player_progress/{id}", function (e) {
  try {
    var col = $app.findCollectionByNameOrId("player_progress")
    var rec = null
    try { rec = $app.findRecordById(col, e.request.pathValue("id")) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "record_not_found", message: "player_progress record not found" })
    $app.delete(rec)
    return e.noContent(204)
  } catch (err) {
    return e.json(400, { error: "shorthand_delete_error", message: String(err && err.message || err) })
  }
}, requireMesUser)

// ---------------------------------------------------------------------------
// deploy_docs
// ---------------------------------------------------------------------------

routerAdd("GET", "/api/deploy_docs", function (e) {
  var TEXT_FIELDS = ["title", "content", "commands", "doc_type"]
  function recObj(rec) {
    var o = { id: rec.id, created: String(rec.get("created") || ""), updated: String(rec.get("updated") || "") }
    for (var i = 0; i < TEXT_FIELDS.length; i++) {
      try { o[TEXT_FIELDS[i]] = rec.get(TEXT_FIELDS[i]) } catch (_) { o[TEXT_FIELDS[i]] = null }
    }
    return o
  }
  try {
    var col = $app.findCollectionByNameOrId("deploy_docs")
    var q = e.requestInfo().query || {}
    var page = parseInt(q.page || "1", 10); if (!(page > 0)) page = 1
    var perPage = parseInt(q.perPage || "100", 10); if (!(perPage > 0)) perPage = 100; if (perPage > 500) perPage = 500
    var sort = String(q.sort || "-created")
    var clauses = []
    var params = {}
    for (var i = 0; i < TEXT_FIELDS.length; i++) {
      var fn = TEXT_FIELDS[i]
      if (q[fn] !== undefined && q[fn] !== "") {
        var pk = "f" + i
        clauses.push(fn + " = {:" + pk + "}")
        params[pk] = String(q[fn])
      }
    }
    var filter = clauses.join(" && ")
    var total = filter ? $app.findRecordsByFilter(col, filter, "", 0, 0, params).length : $app.countRecords(col)
    var records = $app.findRecordsByFilter(col, filter, sort, perPage, (page - 1) * perPage, params)
    var items = []
    for (var j = 0; j < records.length; j++) items.push(recObj(records[j]))
    return e.json(200, {
      page: page, perPage: perPage, totalItems: total,
      totalPages: Math.max(1, Math.ceil(total / perPage)), items: items,
    })
  } catch (err) {
    return e.json(500, { error: "shorthand_list_error", message: String(err && err.message || err) })
  }
}, requireMesUser)

routerAdd("GET", "/api/deploy_docs/{id}", function (e) {
  var TEXT_FIELDS = ["title", "content", "commands", "doc_type"]
  function recObj(rec) {
    var o = { id: rec.id, created: String(rec.get("created") || ""), updated: String(rec.get("updated") || "") }
    for (var i = 0; i < TEXT_FIELDS.length; i++) {
      try { o[TEXT_FIELDS[i]] = rec.get(TEXT_FIELDS[i]) } catch (_) { o[TEXT_FIELDS[i]] = null }
    }
    return o
  }
  try {
    var col = $app.findCollectionByNameOrId("deploy_docs")
    var rec = $app.findRecordById(col, e.request.pathValue("id"))
    return e.json(200, recObj(rec))
  } catch (err) {
    return e.json(404, { error: "record_not_found", message: String(err && err.message || err) })
  }
}, requireMesUser)

routerAdd("POST", "/api/deploy_docs", function (e) {
  var TEXT_FIELDS = ["title", "content", "commands", "doc_type"]
  function recObj(rec) {
    var o = { id: rec.id, created: String(rec.get("created") || ""), updated: String(rec.get("updated") || "") }
    for (var i = 0; i < TEXT_FIELDS.length; i++) {
      try { o[TEXT_FIELDS[i]] = rec.get(TEXT_FIELDS[i]) } catch (_) { o[TEXT_FIELDS[i]] = null }
    }
    return o
  }
  try {
    var col = $app.findCollectionByNameOrId("deploy_docs")
    var body = e.requestInfo().body || {}
    var rec = new Record(col)
    for (var i = 0; i < TEXT_FIELDS.length; i++) {
      if (body[TEXT_FIELDS[i]] !== undefined) rec.set(TEXT_FIELDS[i], body[TEXT_FIELDS[i]])
    }
    $app.save(rec)
    return e.json(200, recObj(rec))
  } catch (err) {
    return e.json(400, { error: "shorthand_create_error", message: String(err && err.message || err) })
  }
}, requireMesUser)

routerAdd("PATCH", "/api/deploy_docs/{id}", function (e) {
  var TEXT_FIELDS = ["title", "content", "commands", "doc_type"]
  function recObj(rec) {
    var o = { id: rec.id, created: String(rec.get("created") || ""), updated: String(rec.get("updated") || "") }
    for (var i = 0; i < TEXT_FIELDS.length; i++) {
      try { o[TEXT_FIELDS[i]] = rec.get(TEXT_FIELDS[i]) } catch (_) { o[TEXT_FIELDS[i]] = null }
    }
    return o
  }
  try {
    var col = $app.findCollectionByNameOrId("deploy_docs")
    var rec = null
    try { rec = $app.findRecordById(col, e.request.pathValue("id")) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "record_not_found", message: "deploy_docs record not found" })
    var body = e.requestInfo().body || {}
    for (var i = 0; i < TEXT_FIELDS.length; i++) {
      if (body[TEXT_FIELDS[i]] !== undefined) rec.set(TEXT_FIELDS[i], body[TEXT_FIELDS[i]])
    }
    $app.save(rec)
    return e.json(200, recObj(rec))
  } catch (err) {
    return e.json(400, { error: "shorthand_update_error", message: String(err && err.message || err) })
  }
}, requireMesUser)

routerAdd("DELETE", "/api/deploy_docs/{id}", function (e) {
  try {
    var col = $app.findCollectionByNameOrId("deploy_docs")
    var rec = null
    try { rec = $app.findRecordById(col, e.request.pathValue("id")) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "record_not_found", message: "deploy_docs record not found" })
    $app.delete(rec)
    return e.noContent(204)
  } catch (err) {
    return e.json(400, { error: "shorthand_delete_error", message: String(err && err.message || err) })
  }
}, requireMesUser)
