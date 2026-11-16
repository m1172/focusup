package expo.modules.focusupprotection
import org.junit.Assert.*
import org.junit.Test
class SecureCookieSnapshotTest {
  private fun normalize(raw: String) = SecureCookieSnapshot.normalize(raw, "instagram.com")
  @Test fun preservesSecurityAttributesAndSessionLifetime() {
    val raw = "sessionid=test; Domain=.instagram.com; Path=/; Secure; HttpOnly; SameSite=Lax"
    assertEquals(raw, normalize(raw))
    assertFalse(normalize(raw).contains("Expires"))
  }
  @Test fun relativeLifetimeNeverRestarts() {
    val raw = "sessionid=test; Secure; HttpOnly; Max-Age=100; Expires=Wed, 01 Jan 2031 00:00:00 GMT"
    assertFalse(normalize(raw).contains("Max-Age"))
    assertTrue(normalize(raw).contains("Expires=Wed, 01 Jan 2031 00:00:00 GMT"))
  }
  @Test fun rejectsUnsafeSnapshots() {
    for (raw in listOf("sessionid=test; Secure", "sessionid=test; HttpOnly", "name=test; Domain=evil.test", "name=test; Max-Age=100", "name=test; Partitioned", "name=test\r\nInjected: x")) {
      try { normalize(raw); fail("Accepted unsafe cookie") } catch (_: IllegalArgumentException) { }
    }
  }
}
