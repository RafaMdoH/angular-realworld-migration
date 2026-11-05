import { TestBed } from "@angular/core/testing";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { provideLocationMocks } from "@angular/common/testing";
import { Router } from "@angular/router";
import { BehaviorSubject } from "rxjs";
import { AppRoutingModule } from "./app-routing.module";
import { UserService } from "./core/services/user.service";
import {
  provideHttpClient,
  withInterceptorsFromDi,
  withXhr,
} from "@angular/common/http";

describe("AppRoutingModule guards (characterization)", () => {
  let router: Router;
  let isAuthenticated: BehaviorSubject<boolean>;

  beforeEach(() => {
    isAuthenticated = new BehaviorSubject<boolean>(false);
    TestBed.configureTestingModule({
      imports: [AppRoutingModule],
      providers: [
        provideLocationMocks(),
        { provide: UserService, useValue: { isAuthenticated } },
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    router = TestBed.inject(Router);
  });

  // Real (non fake-async) time is required: lazy chunks are loaded by webpack.
  function navigate(url: string): Promise<boolean> {
    return router.navigateByUrl(url);
  }

  describe("when NOT authenticated", () => {
    it("allows /login", async () => {
      expect(await navigate("/login")).toBe(true);
      expect(router.url).toBe("/login");
    });

    it("allows /register", async () => {
      expect(await navigate("/register")).toBe(true);
      expect(router.url).toBe("/register");
    });

    it("blocks /settings and stays on the previous url", async () => {
      expect(await navigate("/settings")).toBe(false);
      expect(router.url).toBe("/");
    });

    it("blocks /editor", async () => {
      expect(await navigate("/editor")).toBe(false);
      expect(router.url).toBe("/");
    });

    it("blocks /editor/:slug", async () => {
      expect(await navigate("/editor/some-slug")).toBe(false);
      expect(router.url).toBe("/");
    });

    it("allows public routes (home and article)", async () => {
      expect(await navigate("/")).toBe(true);
      expect(await navigate("/article/some-slug")).toBe(true);
      expect(router.url).toBe("/article/some-slug");
    });
  });

  describe("when authenticated", () => {
    beforeEach(() => isAuthenticated.next(true));

    it("blocks /login", async () => {
      expect(await navigate("/login")).toBe(false);
      expect(router.url).toBe("/");
    });

    it("blocks /register", async () => {
      expect(await navigate("/register")).toBe(false);
      expect(router.url).toBe("/");
    });

    it("allows /settings", async () => {
      expect(await navigate("/settings")).toBe(true);
      expect(router.url).toBe("/settings");
    });

    it("allows /editor", async () => {
      expect(await navigate("/editor")).toBe(true);
      expect(router.url).toBe("/editor");
    });

    it("allows /editor/:slug", async () => {
      expect(await navigate("/editor/some-slug")).toBe(true);
      expect(router.url).toBe("/editor/some-slug");
    });
  });
});
