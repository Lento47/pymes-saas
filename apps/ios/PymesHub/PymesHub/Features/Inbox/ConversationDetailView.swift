import SwiftUI

struct ConversationDetailView: View {
    @Environment(AppEnvironment.self) private var environment
    let conversationID: String

    @State private var messages: [Message] = []
    @State private var draft = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 0) {
            List {
                if let errorMessage {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                }

                ForEach(messages) { message in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(message.bodyText ?? message.bodyHtml ?? "")
                        Text(message.direction ?? "")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            HStack {
                TextField("Responder", text: $draft, axis: .vertical)
                    .textFieldStyle(.roundedBorder)

                Button {
                    Task { await send() }
                } label: {
                    Image(systemName: "paperplane.fill")
                }
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding()
            .background(.bar)
        }
        .navigationTitle("Conversacion")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            Button("Resolver") {
                Task { await resolve() }
            }
        }
        .overlay {
            if isLoading {
                ProgressView()
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
            messages = try await environment.api.getMessages(conversationID: conversationID)
        } catch {
            errorMessage = APIError.displayMessage(for: error)
        }
    }

    private func send() async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        draft = ""
        do {
            let message = try await environment.api.sendMessage(conversationID: conversationID, text: text)
            messages.append(message)
        } catch {
            errorMessage = APIError.displayMessage(for: error)
        }
    }

    private func resolve() async {
        do {
            try await environment.api.resolveConversation(id: conversationID)
        } catch {
            errorMessage = APIError.displayMessage(for: error)
        }
    }
}
