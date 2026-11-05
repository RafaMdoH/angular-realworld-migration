import type { MockedObject } from "vitest";
import { TestBed } from "@angular/core/testing";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { Router } from "@angular/router";
import { User } from "../models/user.model";
import { JwtService } from "./jwt.service";
import { UserService } from "./user.service";
import {
  provideHttpClient,
  withInterceptorsFromDi,
  withXhr,
} from "@angular/common/http";

describe("UserService (characterization)", () => {
  const user: User = {
    email: "a@b.c",
    token: "tok-1",
    username: "alice",
    bio: "",
    image: "",
  };

  let service: UserService;
  let jwt: JwtService;
  let http: HttpTestingController;
  let router: MockedObject<Router>;

  beforeEach(() => {
    window.localStorage.clear();
    router = {
      navigate: vi.fn().mockName("Router.navigate"),
    } as unknown as MockedObject<Router>;
    router.navigate.mockResolvedValue(true);
    TestBed.configureTestingModule({
      imports: [],
      providers: [
        { provide: Router, useValue: router },
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(UserService);
    jwt = TestBed.inject(JwtService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    window.localStorage.clear();
  });

  function latestUser(): User | null | undefined {
    let value: User | null | undefined;
    service.currentUser.subscribe((u) => (value = u)).unsubscribe();
    return value;
  }

  function latestAuth(): boolean | undefined {
    let value: boolean | undefined;
    service.isAuthenticated.subscribe((a) => (value = a)).unsubscribe();
    return value;
  }

  it("starts unauthenticated with a null user", () => {
    expect(latestUser()).toBeNull();
    expect(latestAuth()).toBe(false);
  });

  it("login posts credentials wrapped in { user } and sets auth", () => {
    const credentials = { email: "a@b.c", password: "pw" };
    let result:
      | {
          user: User;
        }
      | undefined;

    service.login(credentials).subscribe((r) => (result = r));
    const req = http.expectOne("/users/login");
    expect(req.request.method).toBe("POST");
    expect(req.request.body).toEqual({ user: credentials });
    req.flush({ user });

    expect(result).toEqual({ user });
    expect(jwt.getToken()).toBe("tok-1");
    expect(latestUser()).toEqual(user);
    expect(latestAuth()).toBe(true);
  });

  it("register posts credentials wrapped in { user } and sets auth", () => {
    const credentials = { username: "alice", email: "a@b.c", password: "pw" };

    service.register(credentials).subscribe();
    const req = http.expectOne("/users");
    expect(req.request.method).toBe("POST");
    expect(req.request.body).toEqual({ user: credentials });
    req.flush({ user });

    expect(jwt.getToken()).toBe("tok-1");
    expect(latestUser()).toEqual(user);
  });

  it("login failure does not set auth", () => {
    let error: unknown;
    service
      .login({ email: "a@b.c", password: "bad" })
      .subscribe({ error: (e) => (error = e) });

    http
      .expectOne("/users/login")
      .flush({ errors: {} }, { status: 422, statusText: "Unprocessable" });

    expect(error).toBeDefined();
    expect(jwt.getToken()).toBeUndefined();
    expect(latestAuth()).toBe(false);
  });

  it("logout purges auth and navigates to /", () => {
    service.setAuth(user);

    service.logout();

    expect(jwt.getToken()).toBeUndefined();
    expect(latestUser()).toBeNull();
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(["/"]);
  });

  it("getCurrentUser GETs /user and sets auth on success", () => {
    service.getCurrentUser().subscribe();
    const req = http.expectOne("/user");
    expect(req.request.method).toBe("GET");
    req.flush({ user });

    expect(jwt.getToken()).toBe("tok-1");
    expect(latestUser()).toEqual(user);
  });

  it("getCurrentUser purges auth on error", () => {
    service.setAuth(user);

    service.getCurrentUser().subscribe({ error: () => undefined });
    http
      .expectOne("/user")
      .flush({}, { status: 401, statusText: "Unauthorized" });

    expect(jwt.getToken()).toBeUndefined();
    expect(latestUser()).toBeNull();
  });

  it("getCurrentUser shares one request between subscribers (shareReplay)", () => {
    const obs = service.getCurrentUser();
    let emissions = 0;
    obs.subscribe(() => emissions++);
    obs.subscribe(() => emissions++);

    http.expectOne("/user").flush({ user });

    expect(emissions).toBe(2);
  });

  it("update PUTs { user } and updates the subject but does NOT save the token", () => {
    service.setAuth(user);
    const updated = { ...user, bio: "new bio", token: "tok-2" };

    service.update({ bio: "new bio" }).subscribe();
    const req = http.expectOne("/user");
    expect(req.request.method).toBe("PUT");
    expect(req.request.body).toEqual({ user: { bio: "new bio" } });
    req.flush({ user: updated });

    expect(latestUser()).toEqual(updated);
    expect(jwt.getToken()).toBe("tok-1");
  });

  it("setAuth saves the token and emits the user", () => {
    service.setAuth(user);

    expect(jwt.getToken()).toBe("tok-1");
    expect(latestUser()).toEqual(user);
  });

  it("purgeAuth destroys the token and emits null", () => {
    service.setAuth(user);

    service.purgeAuth();

    expect(jwt.getToken()).toBeUndefined();
    expect(latestUser()).toBeNull();
    expect(latestAuth()).toBe(false);
  });

  it("currentUser skips consecutive duplicate emissions", () => {
    const emissions: (User | null)[] = [];
    service.currentUser.subscribe((u) => emissions.push(u));

    service.setAuth(user);
    service.setAuth(user);
    service.purgeAuth();
    service.purgeAuth();

    expect(emissions).toEqual([null, user, null]);
  });
});
