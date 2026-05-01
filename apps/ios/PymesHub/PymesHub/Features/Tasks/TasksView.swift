import SwiftUI

struct TasksView: View {
    @Environment(AppEnvironment.self) private var environment
    @State private var tasks: [TaskItem] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        List {
            ForEach(tasks) { task in
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(task.title)
                            .font(.headline)
                        if let description = task.description, !description.isEmpty {
                            Text(description)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        if let status = task.status {
                            Text(status)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    Spacer()

                    Button {
                        Task { await complete(task) }
                    } label: {
                        Image(systemName: "checkmark.circle")
                    }
                }
            }
        }
        .overlay {
            if isLoading {
                ProgressView()
            } else if tasks.isEmpty && errorMessage == nil {
                ContentUnavailableView("Sin tareas", systemImage: "checklist")
            }
        }
        .navigationTitle("Tareas")
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
            tasks = try await environment.api.getTasks()
        } catch {
            errorMessage = APIError.displayMessage(for: error)
        }
    }

    private func complete(_ task: TaskItem) async {
        do {
            try await environment.api.completeTask(id: task.id)
            await load()
        } catch {
            errorMessage = APIError.displayMessage(for: error)
        }
    }
}
