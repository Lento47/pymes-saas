import SwiftUI

enum AppTab: String, CaseIterable, Identifiable {
    case inbox
    case contacts
    case tasks
    case invoices
    case settings

    var id: String { rawValue }

    @ViewBuilder
    var rootView: some View {
        switch self {
        case .inbox:
            InboxView()
        case .contacts:
            ContactsView()
        case .tasks:
            TasksView()
        case .invoices:
            InvoicesView()
        case .settings:
            SettingsView()
        }
    }

    @ViewBuilder
    var label: some View {
        switch self {
        case .inbox:
            Label("Inbox", systemImage: "tray.full")
        case .contacts:
            Label("Contactos", systemImage: "person.2")
        case .tasks:
            Label("Tareas", systemImage: "checklist")
        case .invoices:
            Label("Facturas", systemImage: "doc.text")
        case .settings:
            Label("Mas", systemImage: "ellipsis.circle")
        }
    }
}
