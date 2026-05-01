import Foundation

protocol AuthProviding: AnyObject {
    var accessToken: String? { get }
    var workspaceSlug: String? { get }
    func refreshAccessToken() async -> Bool
    func clearSession()
}

@MainActor
@Observable
final class SessionStore: AuthProviding {
    private let api: APIClient
    private let keychain: KeychainStore
    private let refreshTokenKey = "refresh_token"
    private let workspaceSlugKey = "workspace_slug"

    private(set) var accessToken: String?
    private(set) var workspaceSlug: String?
    private(set) var user: AuthUser?
    private(set) var isRestoring = false
    var errorMessage: String?

    var isAuthenticated: Bool {
        accessToken != nil && user != nil
    }

    init(api: APIClient, keychain: KeychainStore) {
        self.api = api
        self.keychain = keychain
        self.workspaceSlug = try? keychain.string(forKey: workspaceSlugKey)
    }

    func restoreSession() async {
        guard !isRestoring else { return }
        guard (try? keychain.string(forKey: refreshTokenKey)) != nil else { return }
        isRestoring = true
        defer { isRestoring = false }

        if await refreshAccessToken() {
            do {
                user = try await api.getMe()
                if let slug = user?.workspace.slug {
                    workspaceSlug = slug
                    try keychain.set(slug, forKey: workspaceSlugKey)
                }
            } catch {
                clearSession()
            }
        }
    }

    func login(email: String, password: String, workspaceSlug: String) async {
        errorMessage = nil
        do {
            let result = try await api.login(email: email, password: password, workspaceSlug: workspaceSlug)
            apply(auth: result)
        } catch {
            errorMessage = APIError.displayMessage(for: error)
        }
    }

    func logout() async {
        do {
            try await api.logout()
        } catch {
            // Best effort logout. Local session still clears below.
        }
        clearSession()
    }

    func refreshAccessToken() async -> Bool {
        guard let refreshToken = try? keychain.string(forKey: refreshTokenKey) else {
            return false
        }

        do {
            let result = try await api.refresh(refreshToken: refreshToken)
            accessToken = result.accessToken
            if let newRefreshToken = result.refreshToken {
                try keychain.set(newRefreshToken, forKey: refreshTokenKey)
            }
            return true
        } catch {
            clearSession()
            return false
        }
    }

    func clearSession() {
        accessToken = nil
        workspaceSlug = nil
        user = nil
        try? keychain.deleteValue(forKey: refreshTokenKey)
        try? keychain.deleteValue(forKey: workspaceSlugKey)
    }

    private func apply(auth: AuthResponse) {
        accessToken = auth.accessToken
        workspaceSlug = auth.user.workspace.slug
        user = auth.user
        if let refreshToken = auth.refreshToken {
            try? keychain.set(refreshToken, forKey: refreshTokenKey)
        }
        try? keychain.set(auth.user.workspace.slug, forKey: workspaceSlugKey)
    }
}
