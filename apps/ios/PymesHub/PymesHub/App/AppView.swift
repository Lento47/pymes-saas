import SwiftUI

struct AppView: View {
    @Environment(AppEnvironment.self) private var environment
    @State private var selectedTab: AppTab = .inbox
    @State private var router = AppRouter()

    var body: some View {
        Group {
            if environment.session.isAuthenticated {
                TabView(selection: $selectedTab) {
                    ForEach(AppTab.allCases) { tab in
                        NavigationStack(path: router.pathBinding(for: tab)) {
                            tab.rootView
                                .navigationDestination(for: AppRoute.self) { route in
                                    route.destination
                                }
                        }
                        .tabItem { tab.label }
                        .tag(tab)
                    }
                }
                .environment(router)
            } else {
                LoginView()
            }
        }
    }
}

#Preview {
    AppView()
        .environment(AppEnvironment.live())
}
