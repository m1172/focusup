import ActivityKit
import WidgetKit
import SwiftUI

@main struct FocusUpLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: FocusUpActivityAttributes.self) { context in
      HStack(spacing: 14) { Image(systemName: "hourglass.circle.fill").font(.largeTitle).foregroundStyle(.purple); VStack(alignment: .leading) { Text("FocusUp").font(.headline); Text(context.state.title).font(.caption) }; Spacer(); Text(timerInterval: Date()...max(Date(), context.state.endsAt), countsDown: true).monospacedDigit().font(.title2) }.padding().foregroundStyle(.white).activityBackgroundTint(Color(red: 0.10, green: 0.08, blue: 0.18)).activitySystemActionForegroundColor(.white).widgetURL(URL(string: "focusup://protection"))
    } dynamicIsland: { context in
      DynamicIsland { DynamicIslandExpandedRegion(.leading) { Text("FocusUp").font(.headline) }; DynamicIslandExpandedRegion(.trailing) { Text(timerInterval: Date()...max(Date(), context.state.endsAt), countsDown: true).monospacedDigit() }; DynamicIslandExpandedRegion(.bottom) { Text(context.state.title) } } compactLeading: { Image(systemName: "hourglass") } compactTrailing: { Text(timerInterval: Date()...max(Date(), context.state.endsAt), countsDown: true).monospacedDigit().frame(width: 52) } minimal: { Image(systemName: "hourglass") }.widgetURL(URL(string: "focusup://protection"))
    }
  }
}
