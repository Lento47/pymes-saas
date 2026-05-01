import SwiftUI

@MainActor
@Observable
final class AppRouter {
    var inboxPath: [AppRoute] = []
    var contactsPath: [AppRoute] = []
    var tasksPath: [AppRoute] = []
    var invoicesPath: [AppRoute] = []
    var settingsPath: [AppRoute] = []

    func pathBinding(for tab: AppTab) -> Binding<[AppRoute]> {
        Binding(
            get: {
                switch tab {
                case .inbox: self.inboxPath
                case .contacts: self.contactsPath
                case .tasks: self.tasksPath
                case .invoices: self.invoicesPath
                case .settings: self.settingsPath
                }
            },
            set: { newValue in
                switch tab {
                case .inbox: self.inboxPath = newValue
                case .contacts: self.contactsPath = newValue
                case .tasks: self.tasksPath = newValue
                case .invoices: self.invoicesPath = newValue
                case .settings: self.settingsPath = newValue
                }
            }
        )
    }
}

enum AppRoute: Hashable {
    case conversation(id: String)

    @ViewBuilder
    var destination: some View {
        switch self {
        case .conversation(let id):
            ConversationDetailView(conversationID: id)
        }
    }
}
