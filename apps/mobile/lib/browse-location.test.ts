import { describe, expect, test } from "bun:test";

import { parseBrowseLocation } from "./browse-location";

describe("parseBrowseLocation", () => {
	test("restores valid map coordinates, including zero", () => {
		expect(parseBrowseLocation('{"lat":0,"lng":0}')).toEqual({
			lat: 0,
			lng: 0,
		});
	});

	test("rejects malformed and out-of-range stored values", () => {
		expect(parseBrowseLocation(null)).toBeNull();
		expect(parseBrowseLocation("not json")).toBeNull();
		expect(parseBrowseLocation('{"lat":91,"lng":0}')).toBeNull();
		expect(parseBrowseLocation('{"lat":0,"lng":181}')).toBeNull();
		expect(parseBrowseLocation('{"lat":"1","lng":2}')).toBeNull();
	});
});
