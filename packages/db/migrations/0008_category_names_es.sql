-- Spanish becomes the name, English the second locale.
--
-- `0006_category_taxonomy.sql` inserted this taxonomy with the source file's own words in
-- `name` — the list arrived in English — and `0007` added the empty `name_en` column beside
-- it. `SUPPORTED_LOCALES` is `["es","en"]` with Spanish first, and `name` is the column
-- every existing reader draws, so the two facts this migration writes are: `name` is the
-- Spanish name, `name_en` is the English one.
--
-- Written as `update` rather than by rewriting 0006, because 0006 is already applied to the
-- local and the staging database. A migration that has run is a fact; the correction is a
-- new file. `where slug = ...` and not `where id = ...` because the slug is what the reader
-- recognises and the index on it is unique, so a slug that is not there changes nothing
-- rather than silently rewriting the wrong row.
--
-- The six demo categories `packages/db/src/seed.ts` writes keep a NULL `name_en`: they are
-- seeded with Spanish names already, the seed owns them, and a client showing `en` falls
-- back to `name` — which is the behaviour the schema documents for exactly this case.

update `category` set `name` = 'Impresión 3D / Makers', `name_en` = '3D Printing / Makers' where `slug` = '3d-printing-makers';--> statement-breakpoint
update `category` set `name` = 'Accesorios', `name_en` = 'Accessories' where `slug` = 'accessories';--> statement-breakpoint
update `category` set `name` = 'Adultos / Íntimo', `name_en` = 'Adult / Intimate' where `slug` = 'adult-intimate';--> statement-breakpoint
update `category` set `name` = 'Agro, Industria y B2B', `name_en` = 'Agriculture, Industrial & B2B' where `slug` = 'agriculture-industrial-b2b';--> statement-breakpoint
update `category` set `name` = 'Aerolíneas / Vuelos', `name_en` = 'Airlines / Flights' where `slug` = 'airlines-flights';--> statement-breakpoint
update `category` set `name` = 'Antigüedades / Vintage', `name_en` = 'Antique / Vintage' where `slug` = 'antique-vintage';--> statement-breakpoint
update `category` set `name` = 'Electrodomésticos', `name_en` = 'Appliances' where `slug` = 'appliances';--> statement-breakpoint
update `category` set `name` = 'Electrodomésticos (DIY)', `name_en` = 'Appliances (DIY)' where `slug` = 'appliances-diy';--> statement-breakpoint
update `category` set `name` = 'Arte / Coleccionables', `name_en` = 'Art / Collectibles' where `slug` = 'art-collectibles';--> statement-breakpoint
update `category` set `name` = 'Arte y Galerías', `name_en` = 'Art & Galleries' where `slug` = 'art-galleries';--> statement-breakpoint
update `category` set `name` = 'Manualidades', `name_en` = 'Arts & Crafts' where `slug` = 'arts-crafts';--> statement-breakpoint
update `category` set `name` = 'Subasta / Pujas', `name_en` = 'Auction / Bid' where `slug` = 'auction-bid';--> statement-breakpoint
update `category` set `name` = 'Audio', `name_en` = 'Audio' where `slug` = 'audio';--> statement-breakpoint
update `category` set `name` = 'Seguros de Auto', `name_en` = 'Auto Insurance' where `slug` = 'auto-insurance';--> statement-breakpoint
update `category` set `name` = 'Servicio y Reparación', `name_en` = 'Auto Service & Repair' where `slug` = 'auto-service-repair';--> statement-breakpoint
update `category` set `name` = 'Automotriz', `name_en` = 'Automotive' where `slug` = 'automotive';--> statement-breakpoint
update `category` set `name` = 'Panadería', `name_en` = 'Bakery' where `slug` = 'bakery';--> statement-breakpoint
update `category` set `name` = 'Banca', `name_en` = 'Banking' where `slug` = 'banking';--> statement-breakpoint
update `category` set `name` = 'Baño', `name_en` = 'Bath' where `slug` = 'bath';--> statement-breakpoint
update `category` set `name` = 'Belleza, Salud y Cuidado Personal', `name_en` = 'Beauty, Health & Personal Care' where `slug` = 'beauty-health-personal-care';--> statement-breakpoint
update `category` set `name` = 'Ropa de Cama', `name_en` = 'Bedding & Linens' where `slug` = 'bedding-linens';--> statement-breakpoint
update `category` set `name` = 'Bebidas', `name_en` = 'Beverages' where `slug` = 'beverages';--> statement-breakpoint
update `category` set `name` = 'Hojalatería y Pintura', `name_en` = 'Body & Paint' where `slug` = 'body-paint';--> statement-breakpoint
update `category` set `name` = 'Libros', `name_en` = 'Books' where `slug` = 'books';--> statement-breakpoint
update `category` set `name` = 'Libros / Académico', `name_en` = 'Books / Academic' where `slug` = 'books-academic';--> statement-breakpoint
update `category` set `name` = 'Libros, Medios y Entretenimiento', `name_en` = 'Books, Media & Entertainment' where `slug` = 'books-media-entertainment';--> statement-breakpoint
update `category` set `name` = 'Novias / Formal', `name_en` = 'Bridal / Formal' where `slug` = 'bridal-formal';--> statement-breakpoint
update `category` set `name` = 'Servicios Empresariales', `name_en` = 'Business Services' where `slug` = 'business-services';--> statement-breakpoint
update `category` set `name` = 'Carnicería / Pescadería', `name_en` = 'Butcher / Fishmonger' where `slug` = 'butcher-fishmonger';--> statement-breakpoint
update `category` set `name` = 'Cámaras y Fotografía', `name_en` = 'Cameras & Photography' where `slug` = 'cameras-photography';--> statement-breakpoint
update `category` set `name` = 'Camping y Senderismo', `name_en` = 'Camping & Hiking' where `slug` = 'camping-hiking';--> statement-breakpoint
update `category` set `name` = 'Camping / Parques RV', `name_en` = 'Camping / RV Parks' where `slug` = 'camping-rv-parks';--> statement-breakpoint
update `category` set `name` = 'Cannabis / Cáñamo (donde sea legal)', `name_en` = 'Cannabis / Hemp (where legal)' where `slug` = 'cannabis-hemp-where-legal';--> statement-breakpoint
update `category` set `name` = 'Alquiler de Autos', `name_en` = 'Car Rental' where `slug` = 'car-rental';--> statement-breakpoint
update `category` set `name` = 'Lavado / Detallado', `name_en` = 'Car Wash / Detailing' where `slug` = 'car-wash-detailing';--> statement-breakpoint
update `category` set `name` = 'Juegos de Cartas / Mesa', `name_en` = 'Card Games / Board Games' where `slug` = 'card-games-board-games';--> statement-breakpoint
update `category` set `name` = 'Químicos / Laboratorio', `name_en` = 'Chemicals / Lab' where `slug` = 'chemicals-lab';--> statement-breakpoint
update `category` set `name` = 'Niños / Bebés', `name_en` = 'Children''s / Infants' where `slug` = 'children-s-infants';--> statement-breakpoint
update `category` set `name` = 'Puros / Tabaco', `name_en` = 'Cigar / Tobacco' where `slug` = 'cigar-tobacco';--> statement-breakpoint
update `category` set `name` = 'Puros / Tabaco', `name_en` = 'Cigars / Tobacco' where `slug` = 'cigars-tobacco';--> statement-breakpoint
update `category` set `name` = 'Escalada y Montañismo', `name_en` = 'Climbing & Mountaineering' where `slug` = 'climbing-mountaineering';--> statement-breakpoint
update `category` set `name` = 'Ropa y Moda', `name_en` = 'Clothing & Fashion' where `slug` = 'clothing-fashion';--> statement-breakpoint
update `category` set `name` = 'Coleccionables', `name_en` = 'Collectibles' where `slug` = 'collectibles';--> statement-breakpoint
update `category` set `name` = 'Computadoras y Periféricos', `name_en` = 'Computers & Peripherals' where `slug` = 'computers-peripherals';--> statement-breakpoint
update `category` set `name` = 'Confitería', `name_en` = 'Confectionery' where `slug` = 'confectionery';--> statement-breakpoint
update `category` set `name` = 'Materiales de Construcción', `name_en` = 'Construction Materials' where `slug` = 'construction-materials';--> statement-breakpoint
update `category` set `name` = 'Electrónica de Consumo', `name_en` = 'Consumer Electronics' where `slug` = 'consumer-electronics';--> statement-breakpoint
update `category` set `name` = 'Capacitación Corporativa', `name_en` = 'Corporate Training' where `slug` = 'corporate-training';--> statement-breakpoint
update `category` set `name` = 'Cosméticos', `name_en` = 'Cosmetics' where `slug` = 'cosmetics';--> statement-breakpoint
update `category` set `name` = 'Tarjetas de Crédito', `name_en` = 'Credit Cards' where `slug` = 'credit-cards';--> statement-breakpoint
update `category` set `name` = 'Cruceros', `name_en` = 'Cruise Lines' where `slug` = 'cruise-lines';--> statement-breakpoint
update `category` set `name` = 'Cripto / Activos Digitales', `name_en` = 'Crypto / Digital Assets' where `slug` = 'crypto-digital-assets';--> statement-breakpoint
update `category` set `name` = 'Ciclismo', `name_en` = 'Cycling' where `slug` = 'cycling';--> statement-breakpoint
update `category` set `name` = 'Lácteos', `name_en` = 'Dairy' where `slug` = 'dairy';--> statement-breakpoint
update `category` set `name` = 'Delicatessen / Especialidad', `name_en` = 'Delicatessen / Specialty' where `slug` = 'delicatessen-specialty';--> statement-breakpoint
update `category` set `name` = 'Venta Directa / Telemarketing', `name_en` = 'Direct / Telemarketing' where `slug` = 'direct-telemarketing';--> statement-breakpoint
update `category` set `name` = 'Drones / UAVs', `name_en` = 'Drones / UAVs' where `slug` = 'drones-uavs';--> statement-breakpoint
update `category` set `name` = 'Duty-Free / Aeropuerto', `name_en` = 'Duty-Free / Airport Retail' where `slug` = 'duty-free-airport-retail';--> statement-breakpoint
update `category` set `name` = 'Educación y Capacitación', `name_en` = 'Education & Training' where `slug` = 'education-training';--> statement-breakpoint
update `category` set `name` = 'Electricidad', `name_en` = 'Electrical' where `slug` = 'electrical';--> statement-breakpoint
update `category` set `name` = 'Electrónica y Tecnología', `name_en` = 'Electronics & Technology' where `slug` = 'electronics-technology';--> statement-breakpoint
update `category` set `name` = 'Energía / Servicios Públicos', `name_en` = 'Energy / Utilities' where `slug` = 'energy-utilities';--> statement-breakpoint
update `category` set `name` = 'Ecuestre', `name_en` = 'Equestrian' where `slug` = 'equestrian';--> statement-breakpoint
update `category` set `name` = 'Eventos / Entretenimiento', `name_en` = 'Events / Entertainment' where `slug` = 'events-entertainment';--> statement-breakpoint
update `category` set `name` = 'Exóticas / Especiales', `name_en` = 'Exotic / Special' where `slug` = 'exotic-special';--> statement-breakpoint
update `category` set `name` = 'Lentes y Gafas', `name_en` = 'Eyewear' where `slug` = 'eyewear';--> statement-breakpoint
update `category` set `name` = 'Agricultura / Cultivos', `name_en` = 'Farming / Crop' where `slug` = 'farming-crop';--> statement-breakpoint
update `category` set `name` = 'Bisutería', `name_en` = 'Fashion Jewelry' where `slug` = 'fashion-jewelry';--> statement-breakpoint
update `category` set `name` = 'Cine / TV', `name_en` = 'Film / TV' where `slug` = 'film-tv';--> statement-breakpoint
update `category` set `name` = 'Servicios Financieros y Seguros', `name_en` = 'Financial & Insurance Services' where `slug` = 'financial-insurance-services';--> statement-breakpoint
update `category` set `name` = 'Joyería Fina', `name_en` = 'Fine Jewelry' where `slug` = 'fine-jewelry';--> statement-breakpoint
update `category` set `name` = 'Chimeneas y Calefacción', `name_en` = 'Fireplaces & Heating' where `slug` = 'fireplaces-heating';--> statement-breakpoint
update `category` set `name` = 'Pesca', `name_en` = 'Fishing' where `slug` = 'fishing';--> statement-breakpoint
update `category` set `name` = 'Pesca / Acuicultura', `name_en` = 'Fishing / Aquaculture' where `slug` = 'fishing-aquaculture';--> statement-breakpoint
update `category` set `name` = 'Equipo de Fitness', `name_en` = 'Fitness Equipment' where `slug` = 'fitness-equipment';--> statement-breakpoint
update `category` set `name` = 'Pisos', `name_en` = 'Flooring' where `slug` = 'flooring';--> statement-breakpoint
update `category` set `name` = 'Pisos', `name_en` = 'Flooring' where `slug` = 'flooring-garden-diy-home-improvement';--> statement-breakpoint
update `category` set `name` = 'Floristerías', `name_en` = 'Florists' where `slug` = 'florists';--> statement-breakpoint
update `category` set `name` = 'Alimentos y Bebidas', `name_en` = 'Food & Beverage' where `slug` = 'food-beverage';--> statement-breakpoint
update `category` set `name` = 'Servicio de Alimentos', `name_en` = 'Food Service' where `slug` = 'food-service';--> statement-breakpoint
update `category` set `name` = 'Calzado', `name_en` = 'Footwear' where `slug` = 'footwear';--> statement-breakpoint
update `category` set `name` = 'Fragancias', `name_en` = 'Fragrance' where `slug` = 'fragrance';--> statement-breakpoint
update `category` set `name` = 'Fragancias (Lujo)', `name_en` = 'Fragrance (Luxury)' where `slug` = 'fragrance-luxury';--> statement-breakpoint
update `category` set `name` = 'Combustible y Carga', `name_en` = 'Fuel & Charging' where `slug` = 'fuel-charging';--> statement-breakpoint
update `category` set `name` = 'Funerarias / Memorial', `name_en` = 'Funeral / Memorial' where `slug` = 'funeral-memorial';--> statement-breakpoint
update `category` set `name` = 'Muebles', `name_en` = 'Furniture' where `slug` = 'furniture';--> statement-breakpoint
update `category` set `name` = 'Videojuegos', `name_en` = 'Gaming' where `slug` = 'gaming';--> statement-breakpoint
update `category` set `name` = 'Gaming / Esports', `name_en` = 'Gaming / Esports' where `slug` = 'gaming-esports';--> statement-breakpoint
update `category` set `name` = 'Gaming / Esports', `name_en` = 'Gaming / Esports' where `slug` = 'gaming-esports-miscellaneous-specialty';--> statement-breakpoint
update `category` set `name` = 'Jardín, DIY y Mejoras del Hogar', `name_en` = 'Garden, DIY & Home Improvement' where `slug` = 'garden-diy-home-improvement';--> statement-breakpoint
update `category` set `name` = 'Jardín / Paisajismo', `name_en` = 'Garden / Landscaping' where `slug` = 'garden-landscaping';--> statement-breakpoint
update `category` set `name` = 'Regalos / Novedades / Tarjetas', `name_en` = 'Gift / Novelty / Card' where `slug` = 'gift-novelty-card';--> statement-breakpoint
update `category` set `name` = 'Golf', `name_en` = 'Golf' where `slug` = 'golf';--> statement-breakpoint
update `category` set `name` = 'Campos de Golf / Clubes', `name_en` = 'Golf Courses / Country Clubs' where `slug` = 'golf-courses-country-clubs';--> statement-breakpoint
update `category` set `name` = 'Gobierno / Servicios Públicos', `name_en` = 'Government / Public Services' where `slug` = 'government-public-services';--> statement-breakpoint
update `category` set `name` = 'Gobierno / Impuestos', `name_en` = 'Government / Taxes' where `slug` = 'government-taxes';--> statement-breakpoint
update `category` set `name` = 'Abarrotes', `name_en` = 'Groceries' where `slug` = 'groceries';--> statement-breakpoint
update `category` set `name` = 'Aseo Personal', `name_en` = 'Grooming' where `slug` = 'grooming';--> statement-breakpoint
update `category` set `name` = 'Transporte Terrestre', `name_en` = 'Ground Transport' where `slug` = 'ground-transport';--> statement-breakpoint
update `category` set `name` = 'Cuidado del Cabello', `name_en` = 'Hair Care' where `slug` = 'hair-care';--> statement-breakpoint
update `category` set `name` = 'Ferretería', `name_en` = 'Hardware' where `slug` = 'hardware';--> statement-breakpoint
update `category` set `name` = 'Alimentos Saludables', `name_en` = 'Health Foods' where `slug` = 'health-foods';--> statement-breakpoint
update `category` set `name` = 'Aparatos Auditivos', `name_en` = 'Hearing Aids' where `slug` = 'hearing-aids';--> statement-breakpoint
update `category` set `name` = 'Educación Superior', `name_en` = 'Higher Education' where `slug` = 'higher-education';--> statement-breakpoint
update `category` set `name` = 'Tiendas de Pasatiempos', `name_en` = 'Hobby Shops' where `slug` = 'hobby-shops';--> statement-breakpoint
update `category` set `name` = 'Decoración', `name_en` = 'Home Décor' where `slug` = 'home-decor';--> statement-breakpoint
update `category` set `name` = 'Hogar, Muebles y Decoración', `name_en` = 'Home, Furniture & Décor' where `slug` = 'home-furniture-decor';--> statement-breakpoint
update `category` set `name` = 'Textiles del Hogar', `name_en` = 'Home Textiles' where `slug` = 'home-textiles';--> statement-breakpoint
update `category` set `name` = 'Hoteles / Resorts', `name_en` = 'Hotels / Resorts' where `slug` = 'hotels-resorts';--> statement-breakpoint
update `category` set `name` = 'Caza', `name_en` = 'Hunting' where `slug` = 'hunting';--> statement-breakpoint
update `category` set `name` = 'Equipo Industrial', `name_en` = 'Industrial Equipment' where `slug` = 'industrial-equipment';--> statement-breakpoint
update `category` set `name` = 'Seguros', `name_en` = 'Insurance' where `slug` = 'insurance';--> statement-breakpoint
update `category` set `name` = 'Inversión / Bolsa', `name_en` = 'Investment / Brokerage' where `slug` = 'investment-brokerage';--> statement-breakpoint
update `category` set `name` = 'Servicios de TI', `name_en` = 'IT Services' where `slug` = 'it-services';--> statement-breakpoint
update `category` set `name` = 'Limpieza / Aseo', `name_en` = 'Janitorial / Cleaning' where `slug` = 'janitorial-cleaning';--> statement-breakpoint
update `category` set `name` = 'Limpieza / Comercial', `name_en` = 'Janitorial / Commercial' where `slug` = 'janitorial-commercial';--> statement-breakpoint
update `category` set `name` = 'Joyería, Relojes y Lujo', `name_en` = 'Jewelry, Watches & Luxury' where `slug` = 'jewelry-watches-luxury';--> statement-breakpoint
update `category` set `name` = 'K-12', `name_en` = 'K-12' where `slug` = 'k-12';--> statement-breakpoint
update `category` set `name` = 'Cocina y Comedor', `name_en` = 'Kitchen & Dining' where `slug` = 'kitchen-dining';--> statement-breakpoint
update `category` set `name` = 'Tejidos', `name_en` = 'Knitwear' where `slug` = 'knitwear';--> statement-breakpoint
update `category` set `name` = 'Idiomas / Música / Arte', `name_en` = 'Language / Music / Arts' where `slug` = 'language-music-arts';--> statement-breakpoint
update `category` set `name` = 'Artículos de Cuero', `name_en` = 'Leather Goods' where `slug` = 'leather-goods';--> statement-breakpoint
update `category` set `name` = 'Servicios Legales', `name_en` = 'Legal' where `slug` = 'legal';--> statement-breakpoint
update `category` set `name` = 'Iluminación', `name_en` = 'Lighting' where `slug` = 'lighting';--> statement-breakpoint
update `category` set `name` = 'Lencería / Trajes de Baño', `name_en` = 'Lingerie / Swimwear' where `slug` = 'lingerie-swimwear';--> statement-breakpoint
update `category` set `name` = 'Ganadería / Aves', `name_en` = 'Livestock / Poultry' where `slug` = 'livestock-poultry';--> statement-breakpoint
update `category` set `name` = 'Logística / Carga', `name_en` = 'Logistics / Freight' where `slug` = 'logistics-freight';--> statement-breakpoint
update `category` set `name` = 'Lotería / Apuestas', `name_en` = 'Lotteries / Gambling' where `slug` = 'lotteries-gambling';--> statement-breakpoint
update `category` set `name` = 'Madera / Materiales', `name_en` = 'Lumber / Building Materials' where `slug` = 'lumber-building-materials';--> statement-breakpoint
update `category` set `name` = 'Bolsos de Lujo / Carteras', `name_en` = 'Luxury Bags / Handbags' where `slug` = 'luxury-bags-handbags';--> statement-breakpoint
update `category` set `name` = 'Autos de Lujo / Yates', `name_en` = 'Luxury Cars / Yachts' where `slug` = 'luxury-cars-yachts';--> statement-breakpoint
update `category` set `name` = 'Lujo / Concierge', `name_en` = 'Luxury / Concierge' where `slug` = 'luxury-concierge';--> statement-breakpoint
update `category` set `name` = 'Revistas / Periódicos', `name_en` = 'Magazines / Newspapers' where `slug` = 'magazines-newspapers';--> statement-breakpoint
update `category` set `name` = 'Correo / Envíos', `name_en` = 'Mailing / Shipping' where `slug` = 'mailing-shipping';--> statement-breakpoint
update `category` set `name` = 'Marino / Botes', `name_en` = 'Marine / Boats' where `slug` = 'marine-boats';--> statement-breakpoint
update `category` set `name` = 'Artes Marciales / Combate', `name_en` = 'Martial Arts / Combat' where `slug` = 'martial-arts-combat';--> statement-breakpoint
update `category` set `name` = 'Maternidad', `name_en` = 'Maternity' where `slug` = 'maternity';--> statement-breakpoint
update `category` set `name` = 'Colchones y Descanso', `name_en` = 'Mattresses & Sleep' where `slug` = 'mattresses-sleep';--> statement-breakpoint
update `category` set `name` = 'Servicios Médicos / Dentales', `name_en` = 'Medical / Dental Services' where `slug` = 'medical-dental-services';--> statement-breakpoint
update `category` set `name` = 'Dispositivos Médicos', `name_en` = 'Medical Devices' where `slug` = 'medical-devices';--> statement-breakpoint
update `category` set `name` = 'Ropa de Hombre', `name_en` = 'Menswear' where `slug` = 'menswear';--> statement-breakpoint
update `category` set `name` = 'Salud Mental', `name_en` = 'Mental Health' where `slug` = 'mental-health';--> statement-breakpoint
update `category` set `name` = 'Minería / Extracción', `name_en` = 'Mining / Extraction' where `slug` = 'mining-extraction';--> statement-breakpoint
update `category` set `name` = 'Varios y Especialidad', `name_en` = 'Miscellaneous & Specialty' where `slug` = 'miscellaneous-specialty';--> statement-breakpoint
update `category` set `name` = 'Dispositivos Móviles', `name_en` = 'Mobile Devices' where `slug` = 'mobile-devices';--> statement-breakpoint
update `category` set `name` = 'Modelos a Escala', `name_en` = 'Model Kits' where `slug` = 'model-kits';--> statement-breakpoint
update `category` set `name` = 'Transferencias / Remesas', `name_en` = 'Money Transfer / Remittance' where `slug` = 'money-transfer-remittance';--> statement-breakpoint
update `category` set `name` = 'Motos / ATVs / Powersports', `name_en` = 'Motorcycles / ATVs / Powersports' where `slug` = 'motorcycles-atvs-powersports';--> statement-breakpoint
update `category` set `name` = 'Música', `name_en` = 'Music' where `slug` = 'music';--> statement-breakpoint
update `category` set `name` = 'Instrumentos Musicales', `name_en` = 'Musical Instruments' where `slug` = 'musical-instruments';--> statement-breakpoint
update `category` set `name` = 'Redes', `name_en` = 'Networking' where `slug` = 'networking';--> statement-breakpoint
update `category` set `name` = 'Vehículos Nuevos', `name_en` = 'New Vehicles' where `slug` = 'new-vehicles';--> statement-breakpoint
update `category` set `name` = 'Noticias / Prensa', `name_en` = 'News / Print' where `slug` = 'news-print';--> statement-breakpoint
update `category` set `name` = 'Muebles de Oficina', `name_en` = 'Office Furniture' where `slug` = 'office-furniture';--> statement-breakpoint
update `category` set `name` = 'Oficina, Papelería y Suministros', `name_en` = 'Office, Stationery & Business Supplies' where `slug` = 'office-stationery-business-supplies';--> statement-breakpoint
update `category` set `name` = 'Tecnología de Oficina', `name_en` = 'Office Technology' where `slug` = 'office-technology';--> statement-breakpoint
update `category` set `name` = 'Cursos en Línea', `name_en` = 'Online Learning' where `slug` = 'online-learning';--> statement-breakpoint
update `category` set `name` = 'Cuidado Oral', `name_en` = 'Oral Care' where `slug` = 'oral-care';--> statement-breakpoint
update `category` set `name` = 'Ortopédicos', `name_en` = 'Orthopedic' where `slug` = 'orthopedic';--> statement-breakpoint
update `category` set `name` = 'Vida al Aire Libre', `name_en` = 'Outdoor Living' where `slug` = 'outdoor-living';--> statement-breakpoint
update `category` set `name` = 'Abrigos', `name_en` = 'Outerwear' where `slug` = 'outerwear';--> statement-breakpoint
update `category` set `name` = 'Empaque / Envíos', `name_en` = 'Packaging / Shipping' where `slug` = 'packaging-shipping';--> statement-breakpoint
update `category` set `name` = 'Pintura y Suministros', `name_en` = 'Paint & Supplies' where `slug` = 'paint-supplies';--> statement-breakpoint
update `category` set `name` = 'Pintura y Revestimiento', `name_en` = 'Paint & Wall Covering' where `slug` = 'paint-wall-covering';--> statement-breakpoint
update `category` set `name` = 'Papel y Escritura', `name_en` = 'Paper & Writing' where `slug` = 'paper-writing';--> statement-breakpoint
update `category` set `name` = 'Parqueos', `name_en` = 'Parking' where `slug` = 'parking';--> statement-breakpoint
update `category` set `name` = 'Parques y Atracciones', `name_en` = 'Parks & Attractions' where `slug` = 'parks-attractions';--> statement-breakpoint
update `category` set `name` = 'Repuestos y Accesorios', `name_en` = 'Parts & Accessories' where `slug` = 'parts-accessories';--> statement-breakpoint
update `category` set `name` = 'Empeño / Consignación', `name_en` = 'Pawn / Consignment' where `slug` = 'pawn-consignment';--> statement-breakpoint
update `category` set `name` = 'Servicios de Pago', `name_en` = 'Payment Services' where `slug` = 'payment-services';--> statement-breakpoint
update `category` set `name` = 'Guardería / Hospedaje', `name_en` = 'Pet Boarding / Daycare' where `slug` = 'pet-boarding-daycare';--> statement-breakpoint
update `category` set `name` = 'Alimento para Mascotas', `name_en` = 'Pet Food' where `slug` = 'pet-food';--> statement-breakpoint
update `category` set `name` = 'Estética de Mascotas', `name_en` = 'Pet Grooming' where `slug` = 'pet-grooming';--> statement-breakpoint
update `category` set `name` = 'Salud de Mascotas', `name_en` = 'Pet Health' where `slug` = 'pet-health';--> statement-breakpoint
update `category` set `name` = 'Mascotas: Productos y Servicios', `name_en` = 'Pet Supplies & Services' where `slug` = 'pet-supplies-services';--> statement-breakpoint
update `category` set `name` = 'Juguetes y Accesorios para Mascotas', `name_en` = 'Pet Toys & Accessories' where `slug` = 'pet-toys-accessories';--> statement-breakpoint
update `category` set `name` = 'Adiestramiento', `name_en` = 'Pet Training' where `slug` = 'pet-training';--> statement-breakpoint
update `category` set `name` = 'Farmacia / OTC', `name_en` = 'Pharmacy / OTC' where `slug` = 'pharmacy-otc';--> statement-breakpoint
update `category` set `name` = 'Fotografía / Filmación', `name_en` = 'Photography / Film' where `slug` = 'photography-film';--> statement-breakpoint
update `category` set `name` = 'Plomería', `name_en` = 'Plumbing' where `slug` = 'plumbing';--> statement-breakpoint
update `category` set `name` = 'Piscina y Spa', `name_en` = 'Pool & Spa' where `slug` = 'pool-spa';--> statement-breakpoint
update `category` set `name` = 'Pop-Up / Temporal', `name_en` = 'Pop-Up / Temporary' where `slug` = 'pop-up-temporary';--> statement-breakpoint
update `category` set `name` = 'Impresión / Copias', `name_en` = 'Print / Copy' where `slug` = 'print-copy';--> statement-breakpoint
update `category` set `name` = 'Imprenta / Editorial', `name_en` = 'Printing / Publishing' where `slug` = 'printing-publishing';--> statement-breakpoint
update `category` set `name` = 'Imprenta / Rotulación', `name_en` = 'Printing / Signage' where `slug` = 'printing-signage';--> statement-breakpoint
update `category` set `name` = 'Rompecabezas y Juegos de Ingenio', `name_en` = 'Puzzles & Brain Games' where `slug` = 'puzzles-brain-games';--> statement-breakpoint
update `category` set `name` = 'Carreras / Alto Rendimiento', `name_en` = 'Racing / Performance' where `slug` = 'racing-performance';--> statement-breakpoint
update `category` set `name` = 'Materias Primas', `name_en` = 'Raw Materials' where `slug` = 'raw-materials';--> statement-breakpoint
update `category` set `name` = 'Bienes Raíces', `name_en` = 'Real Estate' where `slug` = 'real-estate';--> statement-breakpoint
update `category` set `name` = 'Artículos Religiosos', `name_en` = 'Religious Goods' where `slug` = 'religious-goods';--> statement-breakpoint
update `category` set `name` = 'RV / Recreativos', `name_en` = 'RV / Recreational' where `slug` = 'rv-recreational';--> statement-breakpoint
update `category` set `name` = 'Seguridad', `name_en` = 'Safety / Security' where `slug` = 'safety-security';--> statement-breakpoint
update `category` set `name` = 'Uniformes Escolares', `name_en` = 'Schoolwear' where `slug` = 'schoolwear';--> statement-breakpoint
update `category` set `name` = 'Bienestar Sexual', `name_en` = 'Sexual Wellness' where `slug` = 'sexual-wellness';--> statement-breakpoint
update `category` set `name` = 'Cuidado de la Piel', `name_en` = 'Skincare' where `slug` = 'skincare';--> statement-breakpoint
update `category` set `name` = 'Dispositivos Inteligentes / Conectados', `name_en` = 'Smart / Connected Devices' where `slug` = 'smart-connected-devices';--> statement-breakpoint
update `category` set `name` = 'Casa Inteligente', `name_en` = 'Smart Home' where `slug` = 'smart-home';--> statement-breakpoint
update `category` set `name` = 'Snacks y Conveniencia', `name_en` = 'Snacks & Convenience' where `slug` = 'snacks-convenience';--> statement-breakpoint
update `category` set `name` = 'Servicios Sociales / ONG', `name_en` = 'Social Services / Nonprofit' where `slug` = 'social-services-nonprofit';--> statement-breakpoint
update `category` set `name` = 'Software y Contenido Digital', `name_en` = 'Software & Digital Content' where `slug` = 'software-digital-content';--> statement-breakpoint
update `category` set `name` = 'Spas y Estética', `name_en` = 'Spas & Aesthetics' where `slug` = 'spas-aesthetics';--> statement-breakpoint
update `category` set `name` = 'Clubes Deportivos / Gimnasios', `name_en` = 'Sports Clubs / Gyms' where `slug` = 'sports-clubs-gyms';--> statement-breakpoint
update `category` set `name` = 'Deportes, Aire Libre y Recreación', `name_en` = 'Sports, Outdoors & Recreation' where `slug` = 'sports-outdoors-recreation';--> statement-breakpoint
update `category` set `name` = 'Ropa Deportiva', `name_en` = 'Sportswear / Activewear' where `slug` = 'sportswear-activewear';--> statement-breakpoint
update `category` set `name` = 'Almacenaje y Organización', `name_en` = 'Storage & Organization' where `slug` = 'storage-organization';--> statement-breakpoint
update `category` set `name` = 'Almacenaje y Organización', `name_en` = 'Storage & Organization' where `slug` = 'storage-organization-office-stationery-business-supplies';--> statement-breakpoint
update `category` set `name` = 'Streaming / Suscripciones', `name_en` = 'Streaming / Subscriptions' where `slug` = 'streaming-subscriptions';--> statement-breakpoint
update `category` set `name` = 'Suscripción / Recurrente', `name_en` = 'Subscription / Recurring' where `slug` = 'subscription-recurring';--> statement-breakpoint
update `category` set `name` = 'Sostenible / Eco', `name_en` = 'Sustainable / Eco' where `slug` = 'sustainable-eco';--> statement-breakpoint
update `category` set `name` = 'Deportes de Equipo', `name_en` = 'Team Sports' where `slug` = 'team-sports';--> statement-breakpoint
update `category` set `name` = 'Tecnología / AV', `name_en` = 'Tech / AV' where `slug` = 'tech-av';--> statement-breakpoint
update `category` set `name` = 'Telecom / ISPs', `name_en` = 'Telecom / ISPs' where `slug` = 'telecom-isps';--> statement-breakpoint
update `category` set `name` = 'Carpas / Toldos / Sombra', `name_en` = 'Tent / Awning / Shade' where `slug` = 'tent-awning-shade';--> statement-breakpoint
update `category` set `name` = 'Preparación de Exámenes', `name_en` = 'Test Prep' where `slug` = 'test-prep';--> statement-breakpoint
update `category` set `name` = 'Textil / Telas', `name_en` = 'Textile / Fabric' where `slug` = 'textile-fabric';--> statement-breakpoint
update `category` set `name` = 'Boletos / Eventos', `name_en` = 'Ticketing / Events' where `slug` = 'ticketing-events';--> statement-breakpoint
update `category` set `name` = 'Tiempo Compartido', `name_en` = 'Timeshares / Vacation Ownership' where `slug` = 'timeshares-vacation-ownership';--> statement-breakpoint
update `category` set `name` = 'Herramientas (Eléctricas)', `name_en` = 'Tools (Power)' where `slug` = 'tools-power';--> statement-breakpoint
update `category` set `name` = 'Grúa y Asistencia Vial', `name_en` = 'Towing & Roadside' where `slug` = 'towing-roadside';--> statement-breakpoint
update `category` set `name` = 'Juguetes', `name_en` = 'Toys' where `slug` = 'toys';--> statement-breakpoint
update `category` set `name` = 'Juguetes, Pasatiempos y Coleccionables', `name_en` = 'Toys, Hobbies & Collectibles' where `slug` = 'toys-hobbies-collectibles';--> statement-breakpoint
update `category` set `name` = 'Agencias de Viajes / Tours', `name_en` = 'Travel Agencies / Tours' where `slug` = 'travel-agencies-tours';--> statement-breakpoint
update `category` set `name` = 'Viajes, Hotelería y Turismo', `name_en` = 'Travel, Hospitality & Tourism' where `slug` = 'travel-hospitality-tourism';--> statement-breakpoint
update `category` set `name` = 'Seguros de Viaje', `name_en` = 'Travel Insurance' where `slug` = 'travel-insurance';--> statement-breakpoint
update `category` set `name` = 'Uniformes / Ropa de Trabajo', `name_en` = 'Uniforms / Workwear' where `slug` = 'uniforms-workwear';--> statement-breakpoint
update `category` set `name` = 'Usado / Segunda Mano', `name_en` = 'Used / Secondhand / Thrift' where `slug` = 'used-secondhand-thrift';--> statement-breakpoint
update `category` set `name` = 'Vehículos Usados', `name_en` = 'Used Vehicles' where `slug` = 'used-vehicles';--> statement-breakpoint
update `category` set `name` = 'Servicios Veterinarios', `name_en` = 'Veterinary Services' where `slug` = 'veterinary-services';--> statement-breakpoint
update `category` set `name` = 'Videojuegos', `name_en` = 'Video Games / Gaming' where `slug` = 'video-games-gaming';--> statement-breakpoint
update `category` set `name` = 'Bienes Virtuales / Digitales', `name_en` = 'Virtual / Digital Goods' where `slug` = 'virtual-digital-goods';--> statement-breakpoint
update `category` set `name` = 'Vitaminas y Suplementos', `name_en` = 'Vitamins & Supplements' where `slug` = 'vitamins-supplements';--> statement-breakpoint
update `category` set `name` = 'Técnico / Vocacional', `name_en` = 'Vocational / Trade' where `slug` = 'vocational-trade';--> statement-breakpoint
update `category` set `name` = 'Relojes', `name_en` = 'Watches' where `slug` = 'watches';--> statement-breakpoint
update `category` set `name` = 'Deportes Acuáticos', `name_en` = 'Water Sports' where `slug` = 'water-sports';--> statement-breakpoint
update `category` set `name` = 'Gestión de Patrimonio', `name_en` = 'Wealth Management' where `slug` = 'wealth-management';--> statement-breakpoint
update `category` set `name` = 'Bodas / Eventos', `name_en` = 'Wedding / Event' where `slug` = 'wedding-event';--> statement-breakpoint
update `category` set `name` = 'Cortinas y Persianas', `name_en` = 'Window Treatments' where `slug` = 'window-treatments';--> statement-breakpoint
update `category` set `name` = 'Ventanas y Puertas', `name_en` = 'Windows & Doors' where `slug` = 'windows-doors';--> statement-breakpoint
update `category` set `name` = 'Deportes de Invierno', `name_en` = 'Winter Sports' where `slug` = 'winter-sports';--> statement-breakpoint
update `category` set `name` = 'Ropa de Mujer', `name_en` = 'Womenswear' where `slug` = 'womenswear';--> statement-breakpoint
update `category` set `name` = 'Ropa de Trabajo / Uniformes', `name_en` = 'Workwear / Uniforms' where `slug` = 'workwear-uniforms';--> statement-breakpoint
update `category` set `name` = 'Demolición / Salvamento', `name_en` = 'Wrecking / Salvage' where `slug` = 'wrecking-salvage';--> statement-breakpoint
