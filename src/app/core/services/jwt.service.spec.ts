import { TestBed } from "@angular/core/testing";
import { JwtService } from "./jwt.service";

describe("JwtService (characterization)", () => {
  let service: JwtService;

  beforeEach(() => {
    window.localStorage.clear();
    service = TestBed.inject(JwtService);
  });

  afterEach(() => window.localStorage.clear());

  it("returns undefined when no token is stored", () => {
    expect(service.getToken()).toBeUndefined();
  });

  it("stores the token under the jwtToken localStorage key", () => {
    service.saveToken("abc");

    expect(window.localStorage.getItem("jwtToken")).toBe("abc");
    expect(service.getToken()).toBe("abc");
  });

  it("overwrites a previously stored token", () => {
    service.saveToken("first");
    service.saveToken("second");

    expect(service.getToken()).toBe("second");
  });

  it("removes the token on destroy", () => {
    service.saveToken("abc");

    service.destroyToken();

    expect(window.localStorage.getItem("jwtToken")).toBeNull();
    expect(service.getToken()).toBeUndefined();
  });
});
