import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { Observable, Subject, of, throwError } from "rxjs";
import { User } from "../models/user.model";
import { UserService } from "../services/user.service";
import { AuthComponent } from "./auth.component";

describe("AuthComponent (characterization)", () => {
  const user: User = {
    email: "a@b.c",
    token: "t",
    username: "alice",
    bio: "",
    image: "",
  };

  let userService: jasmine.SpyObj<UserService>;
  let router: Router;
  let fixture: ComponentFixture<AuthComponent>;
  let component: AuthComponent;

  function create(path: string): void {
    TestBed.configureTestingModule({
      imports: [AuthComponent, RouterTestingModule],
      providers: [
        { provide: UserService, useValue: userService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { url: [{ path: "x" }, { path }] } },
        },
      ],
    });
    router = TestBed.inject(Router);
    spyOn(router, "navigate").and.resolveTo(true);
    fixture = TestBed.createComponent(AuthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    userService = jasmine.createSpyObj<UserService>("UserService", [
      "login",
      "register",
    ]);
  });

  describe("login page", () => {
    beforeEach(() => create("login"));

    it("uses the last url segment as authType and titles it 'Sign in'", () => {
      expect(component.authType).toBe("login");
      expect(component.title).toBe("Sign in");
      expect(fixture.nativeElement.querySelector("h1").textContent).toBe(
        "Sign in"
      );
    });

    it("has only email and password controls, both required", () => {
      expect(Object.keys(component.authForm.controls)).toEqual([
        "email",
        "password",
      ]);
      expect(component.authForm.valid).toBeFalse();

      component.authForm.setValue({ email: "a@b.c", password: "pw" });

      expect(component.authForm.valid).toBeTrue();
    });

    it("logs in with the form value and navigates to / on success", () => {
      userService.login.and.returnValue(of({ user }));
      component.authForm.setValue({ email: "a@b.c", password: "pw" });

      component.submitForm();

      expect(userService.login).toHaveBeenCalledOnceWith({
        email: "a@b.c",
        password: "pw",
      });
      expect(userService.register).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledOnceWith(["/"]);
    });

    it("stores the error and re-enables the form on failure", () => {
      const err = { errors: { "email or password": "is invalid" } };
      userService.login.and.returnValue(throwError(() => err));

      component.submitForm();

      expect(component.errors).toBe(err);
      expect(component.isSubmitting).toBeFalse();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("stays in submitting state and clears old errors while the request is pending", () => {
      userService.login.and.returnValue(new Subject() as Observable<any>);
      component.errors = { errors: { old: "error" } };

      component.submitForm();

      expect(component.isSubmitting).toBeTrue();
      expect(component.errors).toEqual({ errors: {} });
    });

    it("stops listening to the pending request after destroy", () => {
      const pending = new Subject<{ user: User }>();
      userService.login.and.returnValue(pending);

      component.submitForm();
      fixture.destroy();
      pending.next({ user });

      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe("register page", () => {
    beforeEach(() => create("register"));

    it("titles it 'Sign up' and adds a required username control", () => {
      expect(component.authType).toBe("register");
      expect(component.title).toBe("Sign up");
      expect(Object.keys(component.authForm.controls)).toEqual([
        "email",
        "password",
        "username",
      ]);

      component.authForm.patchValue({ email: "a@b.c", password: "pw" });
      expect(component.authForm.valid).toBeFalse();
    });

    it("registers with the form value and navigates to / on success", () => {
      userService.register.and.returnValue(of({ user }));
      component.authForm.setValue({
        email: "a@b.c",
        password: "pw",
        username: "alice",
      });

      component.submitForm();

      expect(userService.register).toHaveBeenCalledOnceWith({
        email: "a@b.c",
        password: "pw",
        username: "alice",
      });
      expect(userService.login).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledOnceWith(["/"]);
    });
  });

  it("treats any non-login last segment as sign up (no other validation)", () => {
    create("anything");

    expect(component.title).toBe("Sign up");
    expect(component.authForm.contains("username")).toBeFalse();
  });
});
