import SwiftUI

struct ContactsView: View {
    @Environment(AppEnvironment.self) private var environment
    @State private var contacts: [Contact] = []
    @State private var searchText = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    var filteredContacts: [Contact] {
        guard !searchText.isEmpty else { return contacts }
        return contacts.filter { contact in
            [contact.name, contact.email, contact.phone, contact.company]
                .compactMap { $0?.localizedCaseInsensitiveContains(searchText) }
                .contains(true)
        }
    }

    var body: some View {
        List(filteredContacts) { contact in
            VStack(alignment: .leading, spacing: 4) {
                Text(contact.name ?? "Sin nombre")
                    .font(.headline)
                Text(contact.email ?? contact.phone ?? "Sin contacto")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .searchable(text: $searchText)
        .overlay {
            if isLoading {
                ProgressView()
            } else if contacts.isEmpty && errorMessage == nil {
                ContentUnavailableView("Sin contactos", systemImage: "person.2")
            }
        }
        .navigationTitle("Contactos")
        .toolbar {
            Button {
                Task { await load() }
            } label: {
                Image(systemName: "arrow.clockwise")
            }
        }
        .task {
            await load()
        }
        .alert("Error", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            contacts = try await environment.api.getContacts()
        } catch {
            errorMessage = APIError.displayMessage(for: error)
        }
    }
}
