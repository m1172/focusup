import ManagedSettings
import ManagedSettingsUI
import UIKit

final class FocusUpShield: ShieldConfigurationDataSource {
  private func configuration() -> ShieldConfiguration {
    let locale = ProtectionShared.plan()?.locale ?? "en"
    let title = locale == "uz" ? "FocusUp’da davom eting" : locale == "ru" ? "Продолжите в FocusUp" : "Continue in FocusUp"
    let canOpenFocusUp: Bool
    if #available(iOS 26.5, *) { canOpenFocusUp = true } else { canOpenFocusUp = false }
    let body = canOpenFocusUp
      ? (locale == "uz" ? "Bu ilova bloklangan. Ijtimoiy tarmoqdan FocusUp ichida foydalanish uchun davom eting." : locale == "ru" ? "Это приложение заблокировано. Продолжите, чтобы пользоваться соцсетью внутри FocusUp." : "This app is blocked. Continue to use the social website inside FocusUp.")
      : (locale == "uz" ? "Bu ilova bloklangan. Tozalangan versiya uchun bosh ekrandan FocusUp’ni oching." : locale == "ru" ? "Это приложение заблокировано. Откройте FocusUp с главного экрана для чистой версии." : "This app is blocked. Open FocusUp from your Home Screen for the cleaner version.")
    let back = locale == "uz" ? "Orqaga" : locale == "ru" ? "Назад" : "Go back"
    let open = locale == "uz" ? "FocusUp’ni ochish" : locale == "ru" ? "Открыть FocusUp" : "Open FocusUp"
    return ShieldConfiguration(backgroundBlurStyle: .systemMaterial, backgroundColor: UIColor(red: 0.19, green: 0.145, blue: 0.22, alpha: 1), icon: UIImage(systemName: "shield.lefthalf.filled"), title: .init(text: title, color: .white), subtitle: .init(text: body, color: .lightGray), primaryButtonLabel: .init(text: canOpenFocusUp ? open : back, color: .white), primaryButtonBackgroundColor: UIColor(red: 0.42, green: 0.28, blue: 1, alpha: 1), secondaryButtonLabel: canOpenFocusUp ? .init(text: back, color: .lightGray) : nil)
  }
  override func configuration(shielding application: Application) -> ShieldConfiguration { configuration() }
  override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration { configuration() }
  override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration { configuration() }
  override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ShieldConfiguration { configuration() }
}
