export const payments = {
	"payments.title": "Pagos del pedido",
	"payments.orderTotal": "Total del pedido",
	"payments.merchantAmount": "Productos del comercio",
	"payments.deliveryAmount": "Entrega Express",
	"payments.courierCollection": "Al repartidor: productos + entrega",
	"payments.courierAdvance": "Adelanto al comercio",
	"payments.courierEarnings": "Tu pago por la entrega",
	"payments.collectFromCustomer": "Cobras al cliente",
	"payments.cashBusiness":
		"El repartidor te paga los productos antes de recogerlos. El cliente paga productos + entrega al repartidor; no le cobres otra vez.",
	"payments.cashCustomer":
		"Paga el total al repartidor al recibir. El repartidor adelanta los productos al comercio; ese adelanto ya está incluido en tu total.",
	"payments.sinpeCustomer":
		"Primero paga solo los productos al comercio. Cuando confirme el abono y tengas repartidor, paga la entrega por separado.",
	"payments.payShop":
		"Paga los productos al comercio. El comercio confirma cuando recibe el pago.",
	"payments.cashCourier":
		"Pagas los productos al comercio antes de recogerlos. Después cobras al cliente productos + entrega; el adelanto se recupera en ese cobro.",
	"payments.businessDelivery": "Envío a cargo del comercio",
	"payments.payer": "Paga: {name}",
	"payments.recipient": "Recibe: {name}",
	"payments.role.CUSTOMER": "Cliente",
	"payments.role.MERCHANT": "Comercio",
	"payments.role.COURIER": "Repartidor",
	"payments.status.AWAITING_PAYMENT": "Por pagar",
	"payments.status.AWAITING_VERIFICATION":
		"Comprobante enviado · por verificar",
	"payments.status.CONFIRMED": "Pago confirmado por quien lo recibe",
	"payments.status.REJECTED": "Comprobante rechazado",
	"payments.status.NOT_REQUIRED": "No requiere pago",
	"payments.wait":
		"Disponible cuando el comercio confirme su pago y se asigne un repartidor.",
	"payments.awaitCourier":
		"El repartidor asignado debe pagar los productos al comercio antes de recogerlos.",
	"payments.cash": "Efectivo",
	"payments.sinpe": "SINPE Móvil",
	"payments.noSinpeShort":
		"Este destinatario no tiene SINPE habilitado. Puedes pagar en efectivo.",
	"payments.copy": "Copiar número SINPE",
	"payments.copied": "Número copiado",
	"payments.checkoutHelp": "Paga los productos al comercio y sube el comprobante antes de hacer el pedido. La entrega se paga por separado.",
	"payments.checkoutReady": "Comprobante subido. Ya puedes confirmar el pedido.",
	"payments.refusal.proofRequired": "Sube el comprobante SINPE antes de confirmar el pedido.",
	"payments.upload": "Subir comprobante SINPE",
	"payments.viewProof": "Ver comprobante privado",
	"payments.proofLabel": "Comprobante SINPE de este pago",
	"payments.uploadHelp":
		"Adjunta una imagen JPG, PNG o WebP de hasta 5 MB. Enviarla no confirma el pago.",
	"payments.reference": "Número de referencia (opcional)",
	"payments.verifyNote":
		"Revisa el abono y el monto en tu banco. Una captura por sí sola no comprueba que recibiste el dinero.",
	"payments.confirmSinpe": "Confirmar abono recibido",
	"payments.confirmCash": "Confirmar efectivo recibido",
	"payments.confirmTitle": "¿Recibiste este pago?",
	"payments.confirmBody":
		"Confirma solo si recibiste {amount}. Este paso registra el pago; no hace una transferencia.",
	"payments.confirm": "Sí, lo recibí",
	"payments.cancel": "Volver",
	"payments.reject": "Rechazar comprobante",
	"payments.rejectReason": "Explica qué debe corregir la persona",
	"payments.sent": "Comprobante enviado para verificar",
	"payments.retry": "Intentar de nuevo",
	"payments.accountTitle": "Recibir pagos por SINPE",
	"payments.accountName": "Nombre del titular en el banco",
	"payments.accountPhone": "Número SINPE (8 dígitos)",
	"payments.accountHelp":
		"Usa los datos de la cuenta que recibirá los pagos. El teléfono de contacto no se usa como SINPE automáticamente.",
	"payments.accountSave": "Guardar cuenta SINPE",
	"payments.accountRemove": "Desactivar SINPE",
	"payments.accountSaved": "Cuenta SINPE guardada",
	"payments.accountInvalid":
		"Revisa el número de 8 dígitos y el nombre del titular.",
	"payments.open": "Ver pagos y comprobantes",
	"payments.legacy":
		"Este pedido es anterior a la verificación por comprobantes. Los importes se muestran separados; no se vuelve a cobrar.",
	"payments.refusal.cancelled":
		"Este pedido está cancelado. No envíes otro pago.",
	"payments.refusal.waitForMerchant":
		"Espera la confirmación del comercio y la asignación del repartidor.",
	"payments.refusal.changed":
		"Este pago cambió. Actualiza y revisa el comprobante actual antes de continuar.",
	"payments.refusal.methodLocked":
		"El método de pago de los productos se eligió al hacer el pedido.",
	"payments.refusal.noSinpe":
		"Este destinatario aún no tiene una cuenta SINPE habilitada.",
	"payments.refusal.image":
		"Adjunta una imagen JPG, PNG o WebP válida de hasta 5 MB.",
	"payments.refusal.reusedProof":
		"Este comprobante ya se usó. Cada transferencia necesita su propio comprobante.",
	"payments.refusal.reason":
		"Escribe el motivo para rechazar este comprobante.",
	"payments.refusal.businessUnpaid":
		"El comercio debe confirmar el pago de los productos antes de continuar.",
	"payments.refusal.collectionUnpaid":
		"Confirma los pagos que recibiste antes de completar la entrega.",
} as const;
