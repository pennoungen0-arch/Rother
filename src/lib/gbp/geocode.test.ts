import { describe, it, expect } from "vitest";
import { geocodeFromGmapsUrl } from "./geocode";

describe("geocodeFromGmapsUrl", () => {
  it("extracts !3d/!4d coordinates", () => {
    expect(
      geocodeFromGmapsUrl("https://maps.google.com/?q=place_id:ChIJ&!3d-8.69!4d115.17"),
    ).toEqual({ lat: -8.69, lng: 115.17 });
  });

  it("extracts @lat,lng from a place path", () => {
    expect(
      geocodeFromGmapsUrl("https://www.google.com/maps/place/X/@-8.6905,115.1702,15z"),
    ).toEqual({ lat: -8.6905, lng: 115.1702 });
  });

  it("handles negative and positive coordinates", () => {
    expect(geocodeFromGmapsUrl("!3d40.7128!4d-74.0060")).toEqual({
      lat: 40.7128,
      lng: -74.0060,
    });
  });

  it("returns null for undefined", () => {
    expect(geocodeFromGmapsUrl(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(geocodeFromGmapsUrl("")).toBeNull();
  });

  it("returns null for a URL with no coordinates", () => {
    expect(geocodeFromGmapsUrl("https://maps.google.com/place/x")).toBeNull();
  });

  it("returns null for malformed coordinate fragments", () => {
    expect(geocodeFromGmapsUrl("!3dabc!4ddef")).toBeNull();
  });
});