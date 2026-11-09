import SwiftUI
import WidgetKit

// Home Screen quick launch: opens Vaqtim's clean Instagram, YouTube or TikTok. Taps go through the app's
// normal checks (sign-in, age, family rules, downtime, limits), so the widget can't open anything the app wouldn't.
// It shows no names, usage or other personal data.

struct QuickLaunchEntry: TimelineEntry { let date: Date }

struct QuickLaunchProvider: TimelineProvider {
  func placeholder(in context: Context) -> QuickLaunchEntry { QuickLaunchEntry(date: Date()) }
  func getSnapshot(in context: Context, completion: @escaping (QuickLaunchEntry) -> Void) { completion(QuickLaunchEntry(date: Date())) }
  func getTimeline(in context: Context, completion: @escaping (Timeline<QuickLaunchEntry>) -> Void) { completion(Timeline(entries: [QuickLaunchEntry(date: Date())], policy: .never)) }
}

private struct QuickApp: Identifiable { let id: String; let name: String; let symbol: String; let color: Color }
private let apps = [
  QuickApp(id: "instagram", name: "Instagram", symbol: "camera", color: Color(red: 0.85, green: 0.31, blue: 0.58)),
  QuickApp(id: "youtube", name: "YouTube", symbol: "play.rectangle", color: Color(red: 0.94, green: 0.27, blue: 0.27)),
  QuickApp(id: "tiktok", name: "TikTok", symbol: "music.note", color: Color(red: 0.07, green: 0.09, blue: 0.15)),
]

struct QuickLaunchView: View {
  @Environment(\.widgetFamily) var family
  var body: some View {
    let content = HStack(spacing: 10) {
      ForEach(apps) { app in
        let tile = VStack(spacing: 6) {
          Image(systemName: app.symbol).font(.title2).foregroundStyle(.white).frame(width: 46, height: 46).background(app.color).clipShape(RoundedRectangle(cornerRadius: 12))
          if family != .systemSmall { Text(app.name).font(.caption2).lineLimit(1) }
        }.frame(maxWidth: .infinity)
        if family == .systemSmall { tile } else { Link(destination: URL(string: "focusup://browser/\(app.id)")!) { tile } }
      }
    }.padding(family == .systemSmall ? 8 : 14)
    // A small widget has one tap target, so it opens Vaqtim itself.
    if #available(iOSApplicationExtension 17.0, *) {
      content.containerBackground(.fill.tertiary, for: .widget).widgetURL(family == .systemSmall ? URL(string: "focusup://") : nil)
    } else {
      content.widgetURL(family == .systemSmall ? URL(string: "focusup://") : nil)
    }
  }
}

@main struct FocusUpQuickLaunch: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "FocusUpQuickLaunch", provider: QuickLaunchProvider()) { _ in QuickLaunchView() }
      .configurationDisplayName("Vaqtim")
      .description(Text("quickLaunchDescription", tableName: nil, bundle: .main, comment: "Widget picker description"))
      .supportedFamilies([.systemSmall, .systemMedium])
  }
}
