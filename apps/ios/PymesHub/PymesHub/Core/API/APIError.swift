import Foundation

enum APIError: Error, LocalizedError {
    case invalidResponse
    case http(status: Int, message: String)
    case decoding(Error)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Respuesta invalida del servidor."
        case .http(let status, let message):
            return "\(status): \(message)"
        case .decoding:
            return "No se pudo leer la respuesta del servidor."
        }
    }

    static func displayMessage(for error: Error) -> String {
        if let localized = error as? LocalizedError,
           let description = localized.errorDescription {
            return description
        }
        return error.localizedDescription
    }
}
