import Foundation

struct Conversation: Codable, Identifiable, Hashable {
    let id: String
    let subject: String?
    let status: String?
    let priority: String?
    let channelId: String?
    let contactId: String?
    let createdAt: String?
    let updatedAt: String?
}

struct Message: Codable, Identifiable, Hashable {
    let id: String
    let bodyText: String?
    let bodyHtml: String?
    let direction: String?
    let createdAt: String?
}

struct SendMessageRequest: Encodable {
    let bodyText: String
}

struct Contact: Codable, Identifiable, Hashable {
    let id: String
    let name: String?
    let email: String?
    let phone: String?
    let company: String?
    let createdAt: String?
    let updatedAt: String?
}

struct TaskItem: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let description: String?
    let status: String?
    let dueDate: String?
    let createdAt: String?
    let updatedAt: String?
}

struct Invoice: Codable, Identifiable, Hashable {
    let id: String
    let number: String?
    let status: String?
    let currency: String?
    let total: Decimal?
    let balanceDue: Decimal?
    let dueDate: String?
    let createdAt: String?
}
