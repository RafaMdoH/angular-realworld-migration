import { EMPTY, of } from "rxjs";
import { initAuth } from "./app.module";
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
