import SwiftUI

@main
@MainActor
struct PymesHubApp: App {
    @State private var environment = AppEnvironment.live()

    var body: some Scene {
        WindowGroup {
            AppView()
                .environment(environment)
                .task {
                    await environment.session.restoreSession()
                }
        }
    }
}
