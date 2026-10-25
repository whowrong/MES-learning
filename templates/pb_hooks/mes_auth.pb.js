/// <reference path="../pb_data/types.d.ts" />
// Private local-login account for the standalone MES-learning deployment.
// No public signup, profile edits, OAuth, OTP, password management, or superuser tokens.
// On a fresh install, provision exactly one app account via server-scoped env values.
// These variables are consumed only by this bootstrap; custom shell executors must use
// a sanitized environment and must never inherit them.

onBootstrap(function (e) {
  e.next()
  var collection = null
  try { collection = $app.findCollectionByNameOrId("mes_users") } catch (_) {}
  if (!collection) {
    try {
      collection = new Collection({
        type: "auth",
        name: "mes_users",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        manageRule: null,
        authRule: "",
        passwordAuth: { enabled: true, identityFields: ["email"] },
        oauth2: { enabled: false, providers: [] },
        otp: { enabled: false },
        mfa: { enabled: false },
      })
      $app.save(collection)
      try { $app.logger().info("MES private auth collection created; public signup is disabled") } catch (_) {}
    } catch (err) {
      try { $app.logger().error("MES auth collection bootstrap failed: " + String(err && err.message || err)) } catch (_) {}
      return
    }
  }

  // Idempotently seed one owner account on a clean deployment. Never overwrite an
  // existing account's password on restart. Both values must be supplied together.
  var email = String($os.getenv("MES_APP_LOGIN_EMAIL") || "").trim()
  var password = String($os.getenv("MES_APP_LOGIN_PASSWORD") || "")
  if (!email && !password) return
  if (!email || !password || email.length > 320 || password.length < 12) {
    try { $app.logger().error("MES app account bootstrap requires an email and a password of at least 12 characters") } catch (_) {}
    return
  }
  // Keep this deployment single-account: changing the injected email later must not
  // silently create another app account with the same access to shared progress.
  try {
    // Fail closed if the existing account state cannot be read: a transient DB
    // or schema error must never be interpreted as an empty collection.
    if ($app.countRecords(collection) > 0) return
  } catch (err) {
    try { $app.logger().error("MES app account bootstrap stopped because existing accounts could not be checked") } catch (_) {}
    return
  }
  try {
    var account = new Record(collection)
    account.set("email", email)
    account.setPassword(password)
    $app.save(account)
    try { $app.logger().info("MES initial app account created") } catch (_) {}
  } catch (err) {
    try { $app.logger().error("MES app account bootstrap failed: " + String(err && err.message || err)) } catch (_) {}
  }
})
