import Foundation

struct LoginRequest: Encodable {
    let email: String
    let password: String
}

struct RefreshRequest: Encodable {
    let refreshToken: String
}

struct AuthResponse: Decodable {
    let accessToken: String
    let refreshToken: String?
    let user: AuthUser
}

struct RefreshResponse: Decodable {
    let accessToken: String
    let refreshToken: String?
}

struct AuthUser: Codable, Identifiable, Hashable {
    let id: String
    let email: String
    let name: String
    let role: String
    let isPlatformAdmin: Bool?
    let workspace: WorkspaceSummary
}

struct WorkspaceSummary: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let slug: String
    let plan: String?
    let timezone: String?
    let locale: String?
    let status: String?
}
