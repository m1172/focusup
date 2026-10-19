import ActivityKit
import Foundation

struct FocusUpActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable { let title: String; let endsAt: Date }
  let brand: String
}
