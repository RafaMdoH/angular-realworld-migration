import type { MockedObject } from "vitest";
import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router, provideRouter } from "@angular/router";
import { Subject } from "rxjs";
import { User } from "../models/user.model";
import { UserService } from "../services/user.service";
import { AuthComponent } from "./auth.component";

// Zoneless regression specs: no fixture.detectChanges(). The fixture
// auto-detects by default under zoneless; every assertion reads the DOM after
// an async emission that happens after the first render.
describe("AuthComponent (zoneless)", () => {
  let userService: MockedObject<UserService>;
  let fixture: ComponentFixture<AuthComponent>;

  const el = (): HTMLElement => fixture.nativeElement;
  const formFieldset = (): HTMLFieldSetElement =>
    el().querySelector("form > fieldset")!;
  const errorItems = (): string[] =>
    Array.from(el().querySelectorAll(".error-messages li")).map((li) =>
      li.textContent!.trim()
    );

  async function create(): Promise<void> {
    userService = {
      login: vi.fn().mockName("UserService.login"),
      register: vi.fn().mockName("UserService.register"),
    } as unknown as MockedObject<UserService>;
    TestBed.configureTestingModule({
      imports: [AuthComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: UserService, useValue: userService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { url: [{ path: "login" }] } },
        },
      ],
    });
    vi.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
    fixture = TestBed.createComponent(AuthComponent);
    await fixture.whenStable();
  }

  it("re-enables the form and lists the errors after an async login error", async () => {
    await create();
    const response = new Subject<{ user: User }>();
    userService.login.mockReturnValue(response);
    fixture.componentInstance.authForm.setValue({
      email: "a@b.c",
      password: "pw",
    });
    el().querySelector("form")!.dispatchEvent(new Event("submit"));
    await fixture.whenStable();
    expect(formFieldset().disabled).toBe(true);

    response.error({ errors: { "email or password": "is invalid" } });
    await fixture.whenStable();

    expect(formFieldset().disabled).toBe(false);
    expect(errorItems()).toEqual(["email or password is invalid"]);
  });
});
