import { ApplicationInitStatus } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { EMPTY, of } from "rxjs";
import { AppModule, initAuth } from "./app.module";
import { JwtService } from "./core/services/jwt.service";
import { UserService } from "./core/services/user.service";

describe("initAuth (characterization)", () => {
  let jwt: jasmine.SpyObj<JwtService>;
  let user: jasmine.SpyObj<UserService>;

  beforeEach(() => {
    jwt = jasmine.createSpyObj<JwtService>("JwtService", ["getToken"]);
    user = jasmine.createSpyObj<UserService>("UserService", ["getCurrentUser"]);
  });

  it("returns a factory and does not touch services until it is invoked", () => {
    const factory = initAuth(jwt, user);

    expect(typeof factory).toBe("function");
    expect(jwt.getToken).not.toHaveBeenCalled();
  });

  it("fetches the current user when a token exists", () => {
    const current$ = of({ user: {} as any });
    jwt.getToken.and.returnValue("tok");
    user.getCurrentUser.and.returnValue(current$);

    const result = initAuth(jwt, user)();

    expect(result).toBe(current$);
    expect(user.getCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("returns EMPTY without calling the API when there is no token", () => {
    jwt.getToken.and.returnValue(undefined as any);

    const result = initAuth(jwt, user)();

    expect(result).toBe(EMPTY);
    expect(user.getCurrentUser).not.toHaveBeenCalled();
  });
});

describe("AppModule app initializer wiring (integration)", () => {
  let jwt: jasmine.SpyObj<JwtService>;
  let user: jasmine.SpyObj<UserService>;

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
    jwt = jasmine.createSpyObj<JwtService>("JwtService", ["getToken"]);
    user = jasmine.createSpyObj<UserService>("UserService", ["getCurrentUser"]);
  });

  it("loads the current user during app initialization when a token exists", async () => {
    jwt.getToken.and.returnValue("tok");
    user.getCurrentUser.and.returnValue(of({ user: {} as any }));

    await bootstrapAppModule();

    expect(jwt.getToken).toHaveBeenCalledTimes(1);
    expect(user.getCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("does not call the API during app initialization when there is no token", async () => {
    jwt.getToken.and.returnValue(undefined as any);

    await bootstrapAppModule();

    expect(jwt.getToken).toHaveBeenCalledTimes(1);
    expect(user.getCurrentUser).not.toHaveBeenCalled();
  });
});
