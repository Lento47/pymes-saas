import Foundation

@MainActor
@Observable
final class AppEnvironment {
    let api: APIClient
    let keychain: KeychainStore
    let session: SessionStore

    init(api: APIClient, keychain: KeychainStore, session: SessionStore) {
        self.api = api
        self.keychain = keychain
        self.session = session
    }

    static func live() -> AppEnvironment {
        let baseURL = AppConfiguration.apiBaseURL
        let keychain = KeychainStore(service: "com.pymeshub.ios")
        let api = APIClient(baseURL: baseURL)
        let session = SessionStore(api: api, keychain: keychain)
        api.authProvider = session
        return AppEnvironment(api: api, keychain: keychain, session: session)
    }
}

enum AppConfiguration {
    static var apiBaseURL: URL {
        if let configURL = Bundle.main.url(forResource: "Configuration", withExtension: "plist"),
           let data = try? Data(contentsOf: configURL),
           let plist = try? PropertyListSerialization.propertyList(from: data, options: [], format: nil),
           let dictionary = plist as? [String: Any],
           let urlString = dictionary["API_BASE_URL"] as? String,
           let url = URL(string: urlString) {
            return url
        }

        guard
            let urlString = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
            !urlString.hasPrefix("$("),
            let url = URL(string: urlString)
        else {
            return URL(string: "http://localhost:4000")!
        }
        return url
    }
}
