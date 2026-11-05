import type { MockedObject } from "vitest";
import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { Subject, of } from "rxjs";
import { User } from "../../core/models/user.model";
import { UserService } from "../../core/services/user.service";
import { SettingsComponent } from "./settings.component";

// Zoneless regression specs: no fixture.detectChanges(). The fixture
// auto-detects by default under zoneless; every assertion reads the DOM after
// an async emission that happens after the first render.
describe("SettingsComponent (zoneless)", () => {
  let userService: MockedObject<UserService>;
  let fixture: ComponentFixture<SettingsComponent>;

  const el = (): HTMLElement => fixture.nativeElement;
  const formFieldset = (): HTMLFieldSetElement =>
    el().querySelector("form > fieldset")!;
  const errorItems = (): string[] =>
    Array.from(el().querySelectorAll(".error-messages li")).map((li) =>
      li.textContent!.trim()
    );

  it("lists the errors and re-enables the form after an async update error", async () => {
    userService = {
      getCurrentUser: vi.fn().mockName("UserService.getCurrentUser"),
      update: vi.fn().mockName("UserService.update"),
      logout: vi.fn().mockName("UserService.logout"),
    } as unknown as MockedObject<UserService>;
    userService.getCurrentUser.mockReturnValue(of({ user: {} as User }));
    TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: UserService, useValue: userService },
        {
          provide: Router,
          useValue: { navigate: vi.fn().mockResolvedValue(true) },
        },
      ],
    });
    fixture = TestBed.createComponent(SettingsComponent);
    await fixture.whenStable();
    const response = new Subject<{ user: User }>();
    userService.update.mockReturnValue(response);
    el().querySelector("form")!.dispatchEvent(new Event("submit"));
    await fixture.whenStable();
    expect(formFieldset().disabled).toBe(true);

    response.error({ errors: { email: "has already been taken" } });
    await fixture.whenStable();

    expect(errorItems()).toEqual(["email has already been taken"]);
    expect(formFieldset().disabled).toBe(false);
  });
});
