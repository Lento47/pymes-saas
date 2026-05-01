import SwiftUI

struct LoginView: View {
    @Environment(AppEnvironment.self) private var environment
    @State private var email = ""
    @State private var password = ""
    @State private var workspaceSlug = ""
    @State private var isSubmitting = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()

                    SecureField("Password", text: $password)

                    TextField("Workspace", text: $workspaceSlug)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }

                if let error = environment.session.errorMessage {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    Button {
                        Task { await submit() }
                    } label: {
                        if isSubmitting {
                            ProgressView()
                        } else {
                            Text("Iniciar sesion")
                        }
                    }
                    .disabled(!canSubmit || isSubmitting)
                }
            }
            .navigationTitle("PymesHub")
        }
    }

    private var canSubmit: Bool {
        !email.isEmpty && !password.isEmpty && !workspaceSlug.isEmpty
    }

    private func submit() async {
        isSubmitting = true
        defer { isSubmitting = false }
        await environment.session.login(email: email, password: password, workspaceSlug: workspaceSlug)
    }
}
