import Foundation

@MainActor
final class APIClient {
    let baseURL: URL
    weak var authProvider: AuthProviding?

    private let session: URLSession
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
        self.encoder = JSONEncoder()
        self.decoder = JSONDecoder()
        self.decoder.keyDecodingStrategy = .convertFromSnakeCase
        self.encoder.keyEncodingStrategy = .convertToSnakeCase
    }

    func login(email: String, password: String, workspaceSlug: String) async throws -> AuthResponse {
        let headers = ["x-workspace-slug": workspaceSlug]
        return try await send(
            method: "POST",
            path: "/api/auth/login",
            body: LoginRequest(email: email, password: password),
            headers: headers,
            requiresAuth: false
        )
    }

    func refresh(refreshToken: String) async throws -> RefreshResponse {
        try await send(
            method: "POST",
            path: "/api/auth/refresh",
            body: RefreshRequest(refreshToken: refreshToken),
            requiresAuth: false
        )
    }

    func getMe() async throws -> AuthUser {
        try await send(method: "GET", path: "/api/auth/me")
    }

    func logout() async throws {
        let _: EmptyResponse = try await send(method: "POST", path: "/api/auth/logout")
    }

    func getConversations() async throws -> [Conversation] {
        try await send(method: "GET", path: "/api/conversations")
    }

    func getMessages(conversationID: String) async throws -> [Message] {
        try await send(method: "GET", path: "/api/conversations/\(conversationID)/messages")
    }

    func sendMessage(conversationID: String, text: String) async throws -> Message {
        try await send(
            method: "POST",
            path: "/api/conversations/\(conversationID)/messages",
            body: SendMessageRequest(bodyText: text)
        )
    }

    func resolveConversation(id: String) async throws {
        let _: EmptyResponse = try await send(method: "POST", path: "/api/conversations/\(id)/resolve")
    }

    func getContacts() async throws -> [Contact] {
        try await send(method: "GET", path: "/api/contacts")
    }

    func getTasks() async throws -> [TaskItem] {
        try await send(method: "GET", path: "/api/tasks")
    }

    func completeTask(id: String) async throws {
        let _: EmptyResponse = try await send(method: "POST", path: "/api/tasks/\(id)/complete")
    }

    func getInvoices() async throws -> [Invoice] {
        try await send(method: "GET", path: "/api/invoices")
    }

    private func send<Response: Decodable>(
        method: String,
        path: String,
        requiresAuth: Bool = true
    ) async throws -> Response {
        try await send(method: method, path: path, body: Optional<String>.none, requiresAuth: requiresAuth)
    }

    private func send<Request: Encodable, Response: Decodable>(
        method: String,
        path: String,
        body: Request?,
        headers: [String: String] = [:],
        requiresAuth: Bool = true,
        didRetry: Bool = false
    ) async throws -> Response {
        let requestURL = url(for: path)
        var request = URLRequest(url: requestURL)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let body {
            request.httpBody = try encoder.encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        headers.forEach { key, value in
            request.setValue(value, forHTTPHeaderField: key)
        }

        if requiresAuth {
            if let token = authProvider?.accessToken {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            if let workspaceSlug = authProvider?.workspaceSlug {
                request.setValue(workspaceSlug, forHTTPHeaderField: "x-workspace-slug")
            }
        }

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if http.statusCode == 401, requiresAuth, !didRetry, await authProvider?.refreshAccessToken() == true {
            return try await send(
                method: method,
                path: path,
                body: body,
                headers: headers,
                requiresAuth: requiresAuth,
                didRetry: true
            )
        }

        guard (200..<300).contains(http.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? HTTPURLResponse.localizedString(forStatusCode: http.statusCode)
            if http.statusCode == 401 {
                authProvider?.clearSession()
            }
            throw APIError.http(status: http.statusCode, message: message)
        }

        if data.isEmpty, Response.self == EmptyResponse.self {
            return EmptyResponse() as! Response
        }

        do {
            return try decoder.decode(Response.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    private func url(for path: String) -> URL {
        let normalizedBase = baseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let normalizedPath = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return URL(string: "\(normalizedBase)/\(normalizedPath)")!
    }
}

struct EmptyResponse: Codable {}
