export const payments = {
	"payments.title": "Order payments",
	"payments.orderTotal": "Order total",
	"payments.merchantAmount": "Shop products",
	"payments.deliveryAmount": "Express delivery",
	"payments.courierCollection": "To courier: products + delivery",
	"payments.courierAdvance": "Advance to shop",
	"payments.courierEarnings": "Your delivery pay",
	"payments.collectFromCustomer": "Collect from customer",
	"payments.cashBusiness":
		"The courier pays you for the products before pickup. The customer pays products + delivery to the courier; do not charge them again.",
	"payments.cashCustomer":
		"Pay the total to the courier on arrival. The courier pays the shop for your products first; that advance is already included in your total.",
	"payments.sinpeCustomer":
		"Pay only the products to the shop first. Once it confirms receipt and a courier is assigned, pay delivery separately.",
	"payments.payShop":
		"Pay the shop for the products. The shop confirms when it receives payment.",
	"payments.cashCourier":
		"Pay the shop for the products before pickup. Then collect products + delivery from the customer; that collection reimburses your advance.",
	"payments.businessDelivery": "Delivery funded by shop",
	"payments.payer": "Paid by: {name}",
	"payments.recipient": "Received by: {name}",
	"payments.role.CUSTOMER": "Customer",
	"payments.role.MERCHANT": "Shop",
	"payments.role.COURIER": "Courier",
	"payments.status.AWAITING_PAYMENT": "Awaiting payment",
	"payments.status.AWAITING_VERIFICATION":
		"Receipt submitted · awaiting verification",
	"payments.status.CONFIRMED": "Payment confirmed by recipient",
	"payments.status.REJECTED": "Receipt rejected",
	"payments.status.NOT_REQUIRED": "No payment required",
	"payments.wait":
		"Available once the shop confirms its payment and a courier is assigned.",
	"payments.awaitCourier":
		"The assigned courier must pay the shop for the products before pickup.",
	"payments.cash": "Cash",
	"payments.sinpe": "SINPE Móvil",
	"payments.noSinpeShort":
		"This recipient has not enabled SINPE. You can pay cash.",
	"payments.copy": "Copy SINPE number",
	"payments.copied": "Number copied",
	"payments.checkoutHelp": "Pay the shop for the products and upload the receipt before placing your order. Delivery is paid separately.",
	"payments.checkoutReady": "Receipt uploaded. You can now place your order.",
	"payments.refusal.proofRequired": "Upload the SINPE receipt before placing your order.",
	"payments.upload": "Upload SINPE receipt",
	"payments.viewProof": "View private receipt",
	"payments.proofLabel": "SINPE receipt for this payment",
	"payments.uploadHelp":
		"Attach a JPG, PNG or WebP image up to 5 MB. Uploading it does not confirm payment.",
	"payments.reference": "Reference number (optional)",
	"payments.verifyNote":
		"Check the deposit and amount in your bank. A screenshot alone does not prove you received the money.",
	"payments.confirmSinpe": "Confirm deposit received",
	"payments.confirmCash": "Confirm cash received",
	"payments.confirmTitle": "Did you receive this payment?",
	"payments.confirmBody":
		"Confirm only if you received {amount}. This records the payment; it does not transfer money.",
	"payments.confirm": "Yes, received",
	"payments.cancel": "Back",
	"payments.reject": "Reject receipt",
	"payments.rejectReason": "Explain what the payer needs to correct",
	"payments.sent": "Receipt sent for verification",
	"payments.retry": "Try again",
	"payments.accountTitle": "Receive SINPE payments",
	"payments.accountName": "Account holder name in bank",
	"payments.accountPhone": "SINPE number (8 digits)",
	"payments.accountHelp":
		"Use the account that will receive payments. Your contact phone is not automatically used for SINPE.",
	"payments.accountSave": "Save SINPE account",
	"payments.accountRemove": "Disable SINPE",
	"payments.accountSaved": "SINPE account saved",
	"payments.accountInvalid":
		"Check the 8-digit number and account holder name.",
	"payments.open": "View payments and receipts",
	"payments.legacy":
		"This order predates receipt verification. Amounts are shown separately; you are not charged again.",
	"payments.refusal.cancelled":
		"This order is cancelled. Do not send another payment.",
	"payments.refusal.waitForMerchant":
		"Wait for the shop to confirm payment and for a courier to be assigned.",
	"payments.refusal.changed":
		"This payment changed. Refresh and review the current receipt before continuing.",
	"payments.refusal.methodLocked":
		"The product payment method was selected when placing the order.",
	"payments.refusal.noSinpe":
		"This recipient has not enabled a SINPE account yet.",
	"payments.refusal.image": "Attach a valid JPG, PNG or WebP image up to 5 MB.",
	"payments.refusal.reusedProof":
		"This receipt has already been used. Each transfer needs its own receipt.",
	"payments.refusal.reason": "Enter a reason for rejecting this receipt.",
	"payments.refusal.businessUnpaid":
		"The shop must confirm payment for the products before continuing.",
	"payments.refusal.collectionUnpaid":
		"Confirm the payments you received before completing delivery.",
} as const;
