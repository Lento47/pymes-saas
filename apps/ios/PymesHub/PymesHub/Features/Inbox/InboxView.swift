import SwiftUI

struct InboxView: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(AppRouter.self) private var router
    @State private var conversations: [Conversation] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        List {
            if let errorMessage {
                ContentUnavailableView("No se pudo cargar", systemImage: "exclamationmark.triangle", description: Text(errorMessage))
            }

            ForEach(conversations) { conversation in
                Button {
                    router.inboxPath.append(.conversation(id: conversation.id))
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(conversation.subject ?? "Conversacion")
                            .font(.headline)
                        HStack {
                            Text(conversation.status ?? "sin estado")
                            if let priority = conversation.priority {
                                Text(priority)
                            }
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .overlay {
            if isLoading {
                ProgressView()
            } else if conversations.isEmpty && errorMessage == nil {
                ContentUnavailableView("Inbox vacio", systemImage: "tray")
            }
        }
        .navigationTitle("Inbox")
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
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            conversations = try await environment.api.getConversations()
        } catch {
            errorMessage = APIError.displayMessage(for: error)
        }
    }
}
