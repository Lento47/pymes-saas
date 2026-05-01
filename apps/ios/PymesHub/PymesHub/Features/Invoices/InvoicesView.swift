import SwiftUI

struct InvoicesView: View {
    @Environment(AppEnvironment.self) private var environment
    @State private var invoices: [Invoice] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        List(invoices) { invoice in
            VStack(alignment: .leading, spacing: 4) {
                Text(invoice.number ?? "Factura")
                    .font(.headline)
                HStack {
                    Text(invoice.status ?? "sin estado")
                    Spacer()
                    if let total = invoice.total {
                        Text(total, format: .currency(code: invoice.currency ?? "USD"))
                    }
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)
            }
        }
        .overlay {
            if isLoading {
                ProgressView()
            } else if invoices.isEmpty && errorMessage == nil {
                ContentUnavailableView("Sin facturas", systemImage: "doc.text")
            }
        }
        .navigationTitle("Facturas")
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
            invoices = try await environment.api.getInvoices()
        } catch {
            errorMessage = APIError.displayMessage(for: error)
        }
    }
}
