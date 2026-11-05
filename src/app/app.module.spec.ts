import type { MockedObject } from "vitest";
import { ApplicationInitStatus } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { EMPTY, of } from "rxjs";
import { AppModule, initAuth } from "./app.module";
import { JwtService } from "./core/services/jwt.service";
import { UserService } from "./core/services/user.service";

describe("initAuth (characterization)", () => {
  let jwt: MockedObject<JwtService>;
  let user: MockedObject<UserService>;

  beforeEach(() => {
    jwt = {
      getToken: vi.fn().mockName("JwtService.getToken"),
    } as unknown as MockedObject<JwtService>;
    user = {
      getCurrentUser: vi.fn().mockName("UserService.getCurrentUser"),
    } as unknown as MockedObject<UserService>;
  });

  it("returns a factory and does not touch services until it is invoked", () => {
    const factory = initAuth(jwt, user);

    expect(typeof factory).toBe("function");
    expect(jwt.getToken).not.toHaveBeenCalled();
  });

  it("fetches the current user when a token exists", () => {
    const current$ = of({ user: {} as any });
    jwt.getToken.mockReturnValue("tok");
    user.getCurrentUser.mockReturnValue(current$);

    const result = initAuth(jwt, user)();

    expect(result).toBe(current$);
    expect(user.getCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("returns EMPTY without calling the API when there is no token", () => {
    jwt.getToken.mockReturnValue(undefined as any);

    const result = initAuth(jwt, user)();

    expect(result).toBe(EMPTY);
    expect(user.getCurrentUser).not.toHaveBeenCalled();
  });
});

describe("AppModule app initializer wiring (integration)", () => {
  let jwt: MockedObject<JwtService>;
  let user: MockedObject<UserService>;

  function bootstrapAppModule(): Promise<unknown> {
    TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [
        { provide: JwtService, useValue: jwt },
        { provide: UserService, useValue: user },
      ],
    });
    return TestBed.inject(ApplicationInitStatus).donePromise;
  }

  beforeEach(() => {
    jwt = {
      getToken: vi.fn().mockName("JwtService.getToken"),
    } as unknown as MockedObject<JwtService>;
    user = {
      getCurrentUser: vi.fn().mockName("UserService.getCurrentUser"),
    } as unknown as MockedObject<UserService>;
  });

  it("loads the current user during app initialization when a token exists", async () => {
    jwt.getToken.mockReturnValue("tok");
    user.getCurrentUser.mockReturnValue(of({ user: {} as any }));

    await bootstrapAppModule();

    expect(jwt.getToken).toHaveBeenCalledTimes(1);
    expect(user.getCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("does not call the API during app initialization when there is no token", async () => {
    jwt.getToken.mockReturnValue(undefined as any);

    await bootstrapAppModule();

    expect(jwt.getToken).toHaveBeenCalledTimes(1);
    expect(user.getCurrentUser).not.toHaveBeenCalled();
  });
});
