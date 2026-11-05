import type { MockedObject } from "vitest";
import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { Observable } from "rxjs";
import { User } from "../../core/models/user.model";
import { UserService } from "../../core/services/user.service";
import { SettingsComponent } from "./settings.component";

describe("SettingsComponent (characterization)", () => {
  const user: User = {
    email: "a@b.c",
    token: "t",
    username: "alice",
    bio: "Alice's bio",
    image: "alice.png",
  };

  it("KNOWN BUG (locked): settings form is never filled because getCurrentUser() Observable is passed to patchValue without subscribing", () => {
    const subscribed = vi.fn().mockName("getCurrentUser subscription");
    const userService = {
      getCurrentUser: vi.fn().mockName("UserService.getCurrentUser"),
    } as unknown as MockedObject<UserService>;
    userService.getCurrentUser.mockReturnValue(
      new Observable<{ user: User }>((subscriber) => {
        subscribed();
        subscriber.next({ user });
      })
    );
    TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        { provide: UserService, useValue: userService },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(SettingsComponent);

    fixture.detectChanges();

    // ngOnInit hands the Observable itself to patchValue: its keys match no
    // control, and nothing ever subscribes, so the HTTP call never runs.
    expect(userService.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(subscribed).not.toHaveBeenCalled();
    expect(fixture.componentInstance.settingsForm.getRawValue()).toEqual({
      image: "",
      username: "",
      bio: "",
      email: "",
      password: "",
    });
    const inputs = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement
      >("form input, form textarea")
    );
    expect(inputs.map((input) => input.value)).toEqual(["", "", "", "", ""]);
  });
});
