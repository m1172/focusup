package expo.modules.focusupprotection

/** Validates native Set-Cookie snapshots without widening scope or renewing relative lifetimes. */
internal object SecureCookieSnapshot {
  fun normalize(raw: String, domain: String): String {
    require(domain == "instagram.com" && raw.length < 16000 && raw.none { it == '\r' || it == '\n' || it == '\u0000' }) { "invalidCookie" }
    val pieces = raw.split(';').map { it.trim() }
    val pair = pieces.first().split('=', limit = 2)
    require(pair.size == 2 && pair[0].matches(Regex("[A-Za-z0-9_!#$%&'*+.^`|~-]+"))) { "invalidCookie" }
    val attributes = pieces.drop(1).filter { it.isNotEmpty() }.associate { attribute ->
      val parts = attribute.split('=', limit = 2)
      parts[0].lowercase() to parts.getOrElse(1) { "" }
    }
    require(attributes.keys.all { it in setOf("domain", "path", "expires", "max-age", "secure", "httponly", "samesite", "priority") }) { "unsupportedCookie" }
    attributes["domain"]?.let { require(it.trimStart('.').lowercase() == domain || it.trimStart('.').lowercase() == "www.$domain") { "invalidCookieDomain" } }
    attributes["path"]?.let { require(it.startsWith('/')) { "invalidCookiePath" } }
    attributes["samesite"]?.let { require(it.lowercase() in setOf("strict", "lax", "none")) { "invalidCookieSameSite" } }
    if (pair[0] == "sessionid") require("httponly" in attributes && "secure" in attributes) { "unsafeLegacySession" }
    // Replaying Max-Age would start its clock again. Only the original absolute expiration is safe.
    if ("max-age" in attributes) require(!attributes["expires"].isNullOrBlank()) { "relativeCookieExpiryUnsupported" }
    return pieces.filterNot { it.substringBefore('=').trim().equals("max-age", ignoreCase = true) }.joinToString("; ")
  }
}
