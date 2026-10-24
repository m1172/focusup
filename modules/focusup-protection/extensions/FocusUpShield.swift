import ManagedSettings
import ManagedSettingsUI
import FamilyControls
import UIKit

private extension UIColor {
  convenience init(hex: UInt32) { self.init(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1) }
}

/** Styled like FocusUp's own "Open Instagram in FocusUp" page, so the shield is that page rather than a step before it. */
final class FocusUpShield: ShieldConfigurationDataSource {
  /** FocusUp's mark (src/components/FocusLogo.tsx), drawn here so the extension needs no image resources. */
  private static let logo: UIImage = UIGraphicsImageRenderer(size: CGSize(width: 84, height: 84)).image { context in
    let scale: CGFloat = 84 / 64
    let cg = context.cgContext
    cg.scaleBy(x: scale, y: scale)
    let tile = UIBezierPath(roundedRect: CGRect(x: 0, y: 0, width: 64, height: 64), cornerRadius: 19)
    cg.saveGState(); tile.addClip()
    if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: [UIColor(hex: 0x7A6DFF).cgColor, UIColor(hex: 0x4338CA).cgColor] as CFArray, locations: [0, 1]) {
      cg.drawLinearGradient(gradient, start: .zero, end: CGPoint(x: 64, y: 64), options: [])
    }
    cg.restoreGState()
    let ring = UIBezierPath(arcCenter: CGPoint(x: 32, y: 33), radius: 15, startAngle: -50 * .pi / 180, endAngle: 230 * .pi / 180, clockwise: true)
    ring.lineWidth = 5; ring.lineCapStyle = .round
    UIColor.white.setStroke(); ring.stroke()
    UIColor.white.setFill(); UIBezierPath(ovalIn: CGRect(x: 27.5, y: 28.5, width: 9, height: 9)).fill()
    UIColor(hex: 0x6EF0C8).setFill(); UIBezierPath(ovalIn: CGRect(x: 28.8, y: 14.3, width: 6.4, height: 6.4)).fill()
  }.withRenderingMode(.alwaysOriginal)

  /// Without an explicit style iOS picks a blur matching the system appearance, which turns the purple light grey.
  private static let blur: UIBlurEffect.Style = .systemUltraThinMaterialDark

  private func platformName(_ token: ApplicationToken?) -> String? {
    guard let token = token else { return nil }
    if ProtectionShared.selection("instagram").applicationTokens.contains(token) { return "Instagram" }
    if ProtectionShared.selection("youtube").applicationTokens.contains(token) { return "YouTube" }
    return nil
  }

  private func configuration(_ name: String? = nil) -> ShieldConfiguration {
    let locale = ProtectionShared.plan()?.locale ?? "en"
    let background = UIColor(hex: 0x302538)
    let title: String
    if let name = name, !name.isEmpty { title = locale == "uz" ? "\(name)’ni FocusUp’da oching" : locale == "ru" ? "Откройте \(name) в FocusUp" : "Open \(name) in FocusUp" }
    else { title = locale == "uz" ? "FocusUp’da davom eting" : locale == "ru" ? "Продолжите в FocusUp" : "Continue in FocusUp" }
    guard #available(iOS 26.5, *) else {
      // Older iOS cannot open FocusUp from a shield; the user opens it from the Home Screen instead.
      let body = locale == "uz" ? "Bu ilova bloklangan. Tozalangan versiya uchun bosh ekrandan FocusUp’ni oching." : locale == "ru" ? "Это приложение заблокировано. Откройте FocusUp с главного экрана для чистой версии." : "This app is blocked. Open FocusUp from your Home Screen for the cleaner version."
      let back = locale == "uz" ? "Orqaga" : locale == "ru" ? "Назад" : "Go back"
      return ShieldConfiguration(backgroundBlurStyle: Self.blur, backgroundColor: background, icon: Self.logo, title: .init(text: title, color: .white), subtitle: .init(text: body, color: UIColor(hex: 0xB5ACBD)), primaryButtonLabel: .init(text: back, color: UIColor(hex: 0x32223F)), primaryButtonBackgroundColor: UIColor(hex: 0xD7C3EA))
    }
    let body = locale == "uz" ? "Ijtimoiy tarmoqdan ongliroq foydalaning." : locale == "ru" ? "Пользуйтесь соцсетями осознаннее." : "Your social app. A little more intentional."
    let open: String
    if let name = name, !name.isEmpty { open = locale == "uz" ? "\(name)’ni ochish" : locale == "ru" ? "Открыть \(name)" : "Open \(name)" }
    else { open = locale == "uz" ? "FocusUp’ni ochish" : locale == "ru" ? "Открыть FocusUp" : "Open FocusUp" }
    // One action, styled like the primary button on FocusUp's own page.
    return ShieldConfiguration(backgroundBlurStyle: Self.blur, backgroundColor: background, icon: Self.logo, title: .init(text: title, color: .white), subtitle: .init(text: body, color: UIColor(hex: 0xB5ACBD)), primaryButtonLabel: .init(text: open, color: UIColor(hex: 0x32223F)), primaryButtonBackgroundColor: UIColor(hex: 0xD7C3EA))
  }

  override func configuration(shielding application: Application) -> ShieldConfiguration { configuration(platformName(application.token) ?? application.localizedDisplayName) }
  override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration { configuration(platformName(application.token) ?? application.localizedDisplayName) }
  override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration { configuration() }
  override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ShieldConfiguration { configuration() }
}
