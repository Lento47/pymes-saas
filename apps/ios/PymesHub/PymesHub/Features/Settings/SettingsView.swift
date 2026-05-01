import SwiftUI

struct SettingsView: View {
    @Environment(AppEnvironment.self) private var environment

    var body: some View {
        List {
            if let user = environment.session.user {
                Section("Cuenta") {
                    LabeledContent("Nombre", value: user.name)
                    LabeledContent("Email", value: user.email)
                    LabeledContent("Rol", value: user.role)
                }

                Section("Workspace") {
                    LabeledContent("Nombre", value: user.workspace.name)
                    LabeledContent("Slug", value: user.workspace.slug)
                    if let plan = user.workspace.plan {
                        LabeledContent("Plan", value: plan)
                    }
                }
            }

            Section {
                Button(role: .destructive) {
                    Task { await environment.session.logout() }
                } label: {
                    Text("Cerrar sesion")
                }
            }
        }
        .navigationTitle("Mas")
    }
}
