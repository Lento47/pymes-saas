-- CRC has no minor unit. The launch book was inserted as if it had cents
-- (₡10 900 stored as 1 090 000), so the picker billed in millions. Divide the
-- known 100× figures on the book and on any captured invoice that still holds
-- them. A later book with a different price is left alone.
UPDATE `price_book_price` SET `minor` = `minor` / 100
WHERE `minor` IN (
	1090000, 10900000,
	1990000, 19900000,
	2990000, 29900000,
	5990000, 59900000
);
--> statement-breakpoint
UPDATE `subscription` SET `price_minor` = `price_minor` / 100
WHERE `price_minor` IN (
	1090000, 10900000,
	1990000, 19900000,
	2990000, 29900000,
	5990000, 59900000
);
